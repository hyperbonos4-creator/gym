export type AssessmentKind = "inicial" | "seguimiento" | "cierre";
export type AssessmentStatus = "borrador" | "cerrada";
export type TestCategory = "muscular" | "resistencia" | "movilidad";
export type PhotoView = "frontal" | "lateral" | "posterior";

export type BodyMeasures = {
  weightKg: number | null;
  heightCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  chestCm: number | null;
  armRelaxedCm: number | null;
  armFlexedCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
  compositionMethod: string;
  compositionValue: string;
  compositionNote: string;
  note: string;
};

export type PerformanceTest = {
  id: string;
  category: TestCategory;
  exerciseId: string;
  name: string;
  protocol: string;
  result: string;
  unit: string;
  note: string;
};

export type AssessmentPhoto = {
  id: string;
  view: PhotoView;
  at: string;
  note: string;
};

export type Assessment = {
  id: string;
  gymId: string;
  socioId: string;
  kind: AssessmentKind;
  status: AssessmentStatus;
  createdAt: string;
  updatedAt: string;
  measuredAt: string;
  measuredBy: string;
  goal: string;
  notes: string;
  limitations: string;
  screeningChecked: boolean;
  measures: BodyMeasures;
  tests: PerformanceTest[];
  photos: AssessmentPhoto[];
  photoConsent: boolean;
  objectives: string;
  nextReview: string;
  routineTemplateId: string;
  routineName: string;
  routineVersion: number | null;
  routineNote: string;
};

export const KIND_LABEL: Record<AssessmentKind, string> = {
  inicial: "Evaluación inicial",
  seguimiento: "Evaluación de seguimiento",
  cierre: "Evaluación de cierre de programa",
};

export const GOAL_OPTIONS = [
  "Ganar fuerza y rendimiento",
  "Desarrollar masa muscular",
  "Cambiar la composición corporal",
  "Mejorar condición física general",
  "Otro objetivo acordado",
];

export const MEASURE_FIELDS: { key: keyof BodyMeasures; label: string; unit: string; hint: string }[] = [
  { key: "weightKg", label: "Peso", unit: "kg", hint: "Evolución en contexto, no un veredicto por sí solo." },
  { key: "heightCm", label: "Estatura", unit: "cm", hint: "Referencia antropométrica." },
  { key: "waistCm", label: "Cintura", unit: "cm", hint: "Repite el mismo punto anatómico." },
  { key: "hipCm", label: "Cadera", unit: "cm", hint: "Repite el mismo punto anatómico." },
  { key: "chestCm", label: "Pecho", unit: "cm", hint: "Opcional, según el objetivo." },
  { key: "armRelaxedCm", label: "Brazo relajado", unit: "cm", hint: "Opcional." },
  { key: "armFlexedCm", label: "Brazo contraído", unit: "cm", hint: "Opcional." },
  { key: "thighCm", label: "Muslo", unit: "cm", hint: "Opcional." },
  { key: "calfCm", label: "Pantorrilla", unit: "cm", hint: "Opcional." },
];

export const TEST_CATEGORY_LABEL: Record<TestCategory, string> = {
  muscular: "Capacidad muscular",
  resistencia: "Resistencia",
  movilidad: "Movilidad y patrón",
};

export const PHOTO_LABEL: Record<PhotoView, string> = {
  frontal: "Frontal",
  lateral: "Lateral",
  posterior: "Posterior",
};

export function emptyMeasures(): BodyMeasures {
  return {
    weightKg: null,
    heightCm: null,
    waistCm: null,
    hipCm: null,
    chestCm: null,
    armRelaxedCm: null,
    armFlexedCm: null,
    thighCm: null,
    calfCm: null,
    compositionMethod: "",
    compositionValue: "",
    compositionNote: "",
    note: "",
  };
}

export type CompareRow = {
  label: string;
  unit: string;
  before: string;
  after: string;
  delta: string;
  caution: string;
};

function num(value: number | null) {
  return value == null || Number.isNaN(value) ? null : value;
}

function delta(before: number, after: number, unit: string) {
  const diff = Math.round((after - before) * 10) / 10;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff} ${unit}`;
}

export function compareAssessments(before: Assessment, after: Assessment): CompareRow[] {
  const rows: CompareRow[] = [];
  for (const field of MEASURE_FIELDS) {
    const a = num(before.measures[field.key] as number | null);
    const b = num(after.measures[field.key] as number | null);
    if (a == null && b == null) continue;
    rows.push({
      label: field.label,
      unit: field.unit,
      before: a == null ? "—" : `${a} ${field.unit}`,
      after: b == null ? "—" : `${b} ${field.unit}`,
      delta: a == null || b == null ? "—" : delta(a, b, field.unit),
      caution: "",
    });
  }
  if (before.measures.compositionValue || after.measures.compositionValue) {
    const methodChanged = before.measures.compositionMethod.trim() !== after.measures.compositionMethod.trim();
    rows.push({
      label: "Composición corporal",
      unit: "",
      before: before.measures.compositionValue ? `${before.measures.compositionValue} · ${before.measures.compositionMethod || "sin método"}` : "—",
      after: after.measures.compositionValue ? `${after.measures.compositionValue} · ${after.measures.compositionMethod || "sin método"}` : "—",
      delta: "—",
      caution: methodChanged ? "El método cambió. No compares estos resultados como si fueran la misma medición." : "Estimación del método registrado. No es una medición exacta.",
    });
  }
  for (const test of after.tests) {
    const prev = before.tests.find((item) => item.category === test.category && item.unit === test.unit && (test.exerciseId ? item.exerciseId === test.exerciseId : item.name === test.name));
    if (!prev) continue;
    const a = Number(prev.result);
    const b = Number(test.result);
    const both = prev.result.trim() && test.result.trim() && Number.isFinite(a) && Number.isFinite(b);
    const protocolChanged = prev.protocol.trim() !== test.protocol.trim();
    rows.push({
      label: test.name || TEST_CATEGORY_LABEL[test.category],
      unit: test.unit,
      before: prev.result ? `${prev.result} ${prev.unit}`.trim() : "—",
      after: test.result ? `${test.result} ${test.unit}`.trim() : "—",
      delta: both ? delta(a, b, test.unit) : "—",
      caution: protocolChanged ? "El protocolo cambió. No son la misma prueba." : "",
    });
  }
  return rows;
}

export function seriesFor(items: Assessment[], key: keyof BodyMeasures) {
  return items
    .filter((item) => item.status === "cerrada")
    .slice()
    .sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1))
    .flatMap((item) => {
      const value = item.measures[key];
      if (typeof value !== "number") return [];
      return [{ date: item.measuredAt, value, id: item.id }];
    });
}
