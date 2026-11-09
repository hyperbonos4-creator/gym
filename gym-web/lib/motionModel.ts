/** Modelo del editor. El profesor marca cada pose. El sistema solo interpola entre esas poses. */

export const JOINTS = [
  { id: "columna", label: "Columna", group: "Tronco", min: -20, max: 50, open: false },
  { id: "pecho", label: "Pecho", group: "Tronco", min: -15, max: 35, open: false },
  { id: "cabeza", label: "Cabeza", group: "Tronco", min: -30, max: 40, open: false },
  { id: "brazo-izq", label: "Hombro izquierdo", group: "Brazos", min: -15, max: 170, open: true },
  { id: "codo-izq", label: "Codo izquierdo", group: "Brazos", min: 0, max: 150, open: false },
  { id: "brazo-der", label: "Hombro derecho", group: "Brazos", min: -15, max: 170, open: true },
  { id: "codo-der", label: "Codo derecho", group: "Brazos", min: 0, max: 150, open: false },
  { id: "cadera-izq", label: "Cadera izquierda", group: "Piernas", min: -20, max: 120, open: false },
  { id: "rodilla-izq", label: "Rodilla izquierda", group: "Piernas", min: 0, max: 145, open: false },
  { id: "cadera-der", label: "Cadera derecha", group: "Piernas", min: -20, max: 120, open: false },
  { id: "rodilla-der", label: "Rodilla derecha", group: "Piernas", min: 0, max: 145, open: false },
] as const;

export type JointId = (typeof JOINTS)[number]["id"];

export type JointAngle = { flex: number; open: number };

export type Pose = Record<JointId, JointAngle>;

export type MotionKeyframe = {
  id: string;
  t: number;
  label: string;
  pose: Pose;
};

export type PublishedSnapshot = {
  version: number;
  at: string;
  author: string;
  keys: MotionKeyframe[];
};

export type MotionPiece = {
  id: string;
  gymId: string;
  name: string;
  exerciseId: string;
  equipment: string;
  muscles: string;
  technique: string;
  mistakes: string;
  sets: string;
  reps: string;
  draft: MotionKeyframe[];
  published: PublishedSnapshot | null;
  history: PublishedSnapshot[];
  author: string;
  updatedAt: string;
};

export type MotionClip = {
  pieceId: string;
  name: string;
  exerciseId: string;
  version: number;
  author: string;
  publishedAt: string;
  keys: MotionKeyframe[];
};

const OPEN_MAX = 90;

export function standingPose(): Pose {
  const pose = {} as Pose;
  for (const joint of JOINTS) pose[joint.id] = { flex: 0, open: 0 };
  return pose;
}

export function clampPose(raw: unknown): Pose {
  const src = raw && typeof raw === "object" ? (raw as Record<string, { flex?: unknown; open?: unknown }>) : {};
  const pose = standingPose();
  for (const joint of JOINTS) {
    const cell = src[joint.id];
    const flex = Number(cell?.flex);
    const open = Number(cell?.open);
    pose[joint.id] = {
      flex: clamp(Number.isFinite(flex) ? flex : 0, joint.min, joint.max),
      open: joint.open ? clamp(Number.isFinite(open) ? open : 0, 0, OPEN_MAX) : 0,
    };
  }
  return pose;
}

export function sanitizeKeys(raw: unknown): MotionKeyframe[] {
  if (!Array.isArray(raw)) return defaultKeys();
  const keys = raw.slice(0, 24).map((item, i) => {
    const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const t = Number(row.t);
    return {
      id: String(row.id || `pose-${i + 1}`).slice(0, 80),
      t: clamp(Number.isFinite(t) ? t : i / Math.max(1, raw.length - 1), 0, 1),
      label: String(row.label || `Pose ${i + 1}`).trim().slice(0, 40) || `Pose ${i + 1}`,
      pose: clampPose(row.pose),
    };
  });
  return keys.length >= 2 ? keys : defaultKeys();
}

export function defaultKeys(): MotionKeyframe[] {
  return starterKeys("");
}

/** Plantilla que ya se mueve, para corregir. El profesor la ajusta antes de publicar. */
export function starterKeys(exerciseId: string): MotionKeyframe[] {
  const id = exerciseId || "";
  if (["sentadilla", "zancadas", "extension-pierna", "femoral-maquina", "hip-thrust", "elevacion-pantorrilla"].includes(id) || !id) {
    return keys([
      ["De pie", {}],
        ["Abajo", { "cadera-izq": 58, "cadera-der": 58, "rodilla-izq": 88, "rodilla-der": 88, columna: 14, pecho: 6 }],
      ["De pie", {}],
    ]);
  }
  if (id === "peso-muerto-rumano") {
    return keys([
      ["De pie", {}],
      ["Abajo", { "cadera-izq": 70, "cadera-der": 70, "rodilla-izq": 18, "rodilla-der": 18, columna: 30, pecho: 12, "brazo-izq": 8, "brazo-der": 8 }],
      ["De pie", {}],
    ]);
  }
  if (["press-banca", "press-militar", "fondos", "aperturas", "elevacion-frontal", "elevacion-lateral"].includes(id)) {
    return keys([
      ["Abajo", { "brazo-izq": 75, "brazo-der": 75, "codo-izq": 110, "codo-der": 110 }],
      ["Arriba", { "brazo-izq": 150, "brazo-der": 150, "codo-izq": 18, "codo-der": 18 }],
      ["Abajo", { "brazo-izq": 75, "brazo-der": 75, "codo-izq": 110, "codo-der": 110 }],
    ], { "brazo-izq": 55, "brazo-der": 55 });
  }
  if (["remo-barra", "jalon-abierto", "jalon-cerrado", "dominadas-supino"].includes(id)) {
    return keys([
      ["Estirado", { pecho: 28, columna: 16, "brazo-izq": 20, "brazo-der": 20, "codo-izq": 12, "codo-der": 12 }],
      ["Cerca", { pecho: 28, columna: 16, "brazo-izq": 15, "brazo-der": 15, "codo-izq": 120, "codo-der": 120 }],
      ["Estirado", { pecho: 28, columna: 16, "brazo-izq": 20, "brazo-der": 20, "codo-izq": 12, "codo-der": 12 }],
    ]);
  }
  if (id === "plancha") {
    return keys([
      ["Alta", { columna: 8 }],
      ["Baja", { "codo-izq": 90, "codo-der": 90, "brazo-izq": 70, "brazo-der": 70, columna: 12 }],
      ["Alta", { columna: 8 }],
    ]);
  }
  if (id === "encogimiento-hombros") {
    return keys([
      ["Abajo", {}],
      ["Arriba", { pecho: 12, cabeza: -8 }],
      ["Abajo", {}],
    ]);
  }
  return keys([
    ["Abajo", { "codo-izq": 12, "codo-der": 12 }],
    ["Arriba", { "codo-izq": 140, "codo-der": 140, "brazo-izq": 12, "brazo-der": 12 }],
    ["Abajo", { "codo-izq": 12, "codo-der": 12 }],
  ]);
}

function keys(
  steps: [string, Partial<Record<JointId, number>>][],
  open: Partial<Record<JointId, number>> = {},
): MotionKeyframe[] {
  const ids = ["inicio", "medio", "final"];
  return steps.map(([label, flex], i) => ({
    id: ids[i] || `pose-${i + 1}`,
    t: steps.length === 1 ? 0 : i / (steps.length - 1),
    label,
    pose: poseFrom(flex, open),
  }));
}

function poseFrom(flex: Partial<Record<JointId, number>>, open: Partial<Record<JointId, number>>): Pose {
  const pose = standingPose();
  for (const joint of JOINTS) {
    pose[joint.id] = {
      flex: flex[joint.id] ?? 0,
      open: open[joint.id] ?? 0,
    };
  }
  return clampPose(pose);
}

export function poseAt(keys: MotionKeyframe[], t: number): Pose {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  if (!sorted.length) return standingPose();
  const time = clamp(t, 0, 1);
  if (time <= sorted[0].t) return sorted[0].pose;
  const last = sorted[sorted.length - 1];
  if (time >= last.t) return last.pose;
  let b = sorted[1];
  let a = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].t >= time) {
      a = sorted[i - 1];
      b = sorted[i];
      break;
    }
  }
  const span = b.t - a.t || 1;
  const raw = (time - a.t) / span;
  const u = raw * raw * (3 - 2 * raw);
  const pose = standingPose();
  for (const joint of JOINTS) {
    pose[joint.id] = {
      flex: a.pose[joint.id].flex + (b.pose[joint.id].flex - a.pose[joint.id].flex) * u,
      open: a.pose[joint.id].open + (b.pose[joint.id].open - a.pose[joint.id].open) * u,
    };
  }
  return pose;
}

export function nearestLabel(keys: MotionKeyframe[], t: number) {
  if (!keys.length) return "";
  return [...keys].sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0]?.label || "";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
