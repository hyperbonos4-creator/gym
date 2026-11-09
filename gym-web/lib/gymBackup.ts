import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";

const DATA = dataDir();
const FILES = [
  "socios.json",
  "memberships.json",
  "retail.json",
  "routines.json",
  "routine-assignments.json",
  "exercise-assignments.json",
  "assessments.json",
  "invitations.json",
  "turnstiles.json",
  "mobile-payments.json",
  "motion-studio.json",
  "facturacion-sedes.json",
  "nutrition-foods.json",
  "nutrition-recipes.json",
  "nutrition-plans.json",
  "nutrition-assignments.json",
  "nutrition-profiles.json",
  "nutrition-logs.json",
];

function ofGym(value: unknown, gymId: string): unknown {
  if (Array.isArray(value)) {
    return value.filter((row) => row && typeof row === "object" && (row as { gymId?: string }).gymId === gymId);
  }
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const arrays = Object.entries(obj).filter(([, v]) => Array.isArray(v));
  if (arrays.length) {
    const out: Record<string, unknown> = {};
    for (const [key, rows] of arrays) out[key] = ofGym(rows, gymId);
    return out;
  }
  if (Object.prototype.hasOwnProperty.call(obj, gymId)) return { [gymId]: obj[gymId] };
  return null;
}

export function exportGym(gymId: string) {
  const data: Record<string, unknown> = {};
  for (const name of FILES) {
    const file = path.join(DATA, name);
    if (!fs.existsSync(file)) continue;
    try {
      const slice = ofGym(JSON.parse(fs.readFileSync(file, "utf-8")), gymId);
      if (slice && (Array.isArray(slice) ? slice.length : Object.keys(slice as object).length)) data[name] = slice;
    } catch {
      /* un archivo dañado no vacía el resto de la copia */
    }
  }
  return {
    gymId,
    exportedAt: new Date().toISOString(),
    note: "Copia de esta sede. No incluye certificados DIAN ni contraseñas.",
    data,
  };
}
