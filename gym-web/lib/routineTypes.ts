export type RoutineLevel = "Inicio" | "Intermedio" | "Avanzado";
export type BlockKind = "ejercicio" | "superserie" | "circuito" | "calentamiento";

/** Lo que el entrenador prescribe. No es el resultado de una sesión real. */
export type PrescribedExercise = {
  id: string;
  exerciseId: string;
  sets: number;
  reps: string;
  restSec: number;
  load: string;
  effort: string;
  tempo: string;
  alternativeId: string;
  note: string;
};

export type RoutineBlock = {
  id: string;
  kind: BlockKind;
  items: PrescribedExercise[];
};

export type RoutineDay = {
  id: string;
  label: string;
  title: string;
  rest: boolean;
  blocks: RoutineBlock[];
};

export type RoutineVersion = {
  id: string;
  number: number;
  status: "borrador" | "publicada";
  createdAt: string;
  publishedAt: string | null;
  days: RoutineDay[];
};

export type RoutineTemplate = {
  id: string;
  gymId: string;
  name: string;
  goal: string;
  level: RoutineLevel;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  versions: RoutineVersion[];
};

export const ROUTINE_GOALS = ["Hipertrofia", "Fuerza", "Resistencia", "Técnica", "Acondicionamiento"] as const;

export function safeVersions(t: Pick<RoutineTemplate, "versions"> | null | undefined): RoutineVersion[] {
  return Array.isArray(t?.versions) ? t.versions : [];
}

export function draftOf(t: RoutineTemplate) {
  return safeVersions(t).find((v) => v.status === "borrador") || null;
}

export function latestPublished(t: RoutineTemplate) {
  return [...safeVersions(t)].reverse().find((v) => v.status === "publicada") || null;
}

export function trainingDays(days: RoutineDay[]) {
  return days.filter((d) => !d.rest).length;
}

export function exerciseCount(days: RoutineDay[]) {
  return days.reduce((n, d) => n + d.blocks.reduce((m, b) => m + b.items.length, 0), 0);
}
