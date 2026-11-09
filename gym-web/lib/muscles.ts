export type MuscleId =
  | "pectorales"
  | "espalda"
  | "deltoides"
  | "biceps"
  | "triceps"
  | "antebrazos"
  | "abdomen"
  | "core"
  | "cuadriceps"
  | "isquiotibiales"
  | "gluteos"
  | "aductores"
  | "pantorrillas"
  | "full-body";

export type MuscleMeta = {
  id: MuscleId;
  name: string;
  zone: "superior" | "core" | "inferior" | "full";
  view: "front" | "back" | "both";
};

export const MUSCLES: MuscleMeta[] = [
  { id: "pectorales", name: "Pectorales", zone: "superior", view: "front" },
  { id: "espalda", name: "Espalda", zone: "superior", view: "back" },
  { id: "deltoides", name: "Deltoides", zone: "superior", view: "both" },
  { id: "biceps", name: "Bíceps", zone: "superior", view: "front" },
  { id: "triceps", name: "Tríceps", zone: "superior", view: "back" },
  { id: "antebrazos", name: "Antebrazos", zone: "superior", view: "both" },
  { id: "abdomen", name: "Abdomen", zone: "core", view: "front" },
  { id: "core", name: "Core", zone: "core", view: "both" },
  { id: "cuadriceps", name: "Cuádriceps", zone: "inferior", view: "front" },
  { id: "isquiotibiales", name: "Isquiotibiales", zone: "inferior", view: "back" },
  { id: "gluteos", name: "Glúteos", zone: "inferior", view: "back" },
  { id: "aductores", name: "Aductores", zone: "inferior", view: "front" },
  { id: "pantorrillas", name: "Pantorrillas", zone: "inferior", view: "both" },
  { id: "full-body", name: "Full body", zone: "full", view: "both" },
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m])) as Record<MuscleId, MuscleMeta>;
