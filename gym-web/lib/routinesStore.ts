import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { randomUUID } from "crypto";
import { EXERCISES } from "./exercisesCatalog";
import type { BlockKind, PrescribedExercise, RoutineBlock, RoutineDay, RoutineLevel, RoutineTemplate, RoutineVersion } from "./routineTypes";

const FILE = path.join(dataDir(), "routines.json");
const LEVELS: RoutineLevel[] = ["Inicio", "Intermedio", "Avanzado"];
const KINDS: BlockKind[] = ["ejercicio", "superserie", "circuito", "calentamiento"];
const known = new Set(EXERCISES.map((e) => e.id));

function readAll(): RoutineTemplate[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows: RoutineTemplate[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), "utf-8");
}

function text(v: unknown, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

function exercise(raw: any): PrescribedExercise | null {
  const exerciseId = text(raw?.exerciseId, 80);
  if (!known.has(exerciseId)) return null;
  const alternativeId = text(raw?.alternativeId, 80);
  return {
    id: text(raw?.id, 80) || randomUUID(),
    exerciseId,
    sets: Math.min(20, Math.max(1, Math.round(Number(raw?.sets) || 3))),
    reps: text(raw?.reps, 24) || "8-12",
    restSec: Math.min(600, Math.max(0, Math.round(Number(raw?.restSec) || 0))),
    load: text(raw?.load, 40),
    effort: text(raw?.effort, 40),
    tempo: text(raw?.tempo, 24),
    alternativeId: alternativeId && known.has(alternativeId) && alternativeId !== exerciseId ? alternativeId : "",
    note: text(raw?.note, 280),
  };
}

export function sanitizeDays(raw: unknown): RoutineDay[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 14).map((day: any, i) => {
    const blocks: RoutineBlock[] = [];
    if (!day?.rest && Array.isArray(day?.blocks)) {
      for (const block of day.blocks.slice(0, 24)) {
        const items = (Array.isArray(block?.items) ? block.items : []).map(exercise).filter(Boolean) as PrescribedExercise[];
        if (!items.length) continue;
        const kind = KINDS.includes(block?.kind) ? block.kind : items.length > 1 ? "superserie" : "ejercicio";
        blocks.push({
          id: text(block?.id, 80) || randomUUID(),
          kind: kind === "ejercicio" && items.length > 1 ? "superserie" : kind,
          items: kind === "ejercicio" ? items.slice(0, 1) : items.slice(0, 8),
        });
      }
    }
    return {
      id: text(day?.id, 80) || randomUUID(),
      label: text(day?.label, 24) || `Día ${i + 1}`,
      title: text(day?.title, 48) || (day?.rest ? "Descanso" : "Sesión"),
      rest: Boolean(day?.rest),
      blocks: day?.rest ? [] : blocks,
    };
  });
}

export function blankDays(): RoutineDay[] {
  return sanitizeDays([
    { label: "Día 1", title: "Tren superior", rest: false, blocks: [] },
    { label: "Día 2", title: "Tren inferior", rest: false, blocks: [] },
    { label: "Día 3", title: "Descanso", rest: true, blocks: [] },
    { label: "Día 4", title: "Tren superior", rest: false, blocks: [] },
    { label: "Día 5", title: "Tren inferior", rest: false, blocks: [] },
  ]);
}

export function listRoutines(gymId: string) {
  return readAll()
    .filter((t) => t.gymId === gymId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function getRoutine(gymId: string, id: string) {
  return readAll().find((t) => t.gymId === gymId && t.id === id) || null;
}

export function createRoutine(input: {
  gymId: string;
  name: string;
  goal: string;
  level: string;
  by: string;
  days?: unknown;
}): RoutineTemplate {
  const name = text(input.name, 80);
  if (!name) throw new Error("nombre_requerido");
  const now = new Date().toISOString();
  const version: RoutineVersion = {
    id: randomUUID(),
    number: 1,
    status: "borrador",
    createdAt: now,
    publishedAt: null,
    days: input.days ? sanitizeDays(input.days) : blankDays(),
  };
  const template: RoutineTemplate = {
    id: randomUUID(),
    gymId: input.gymId,
    name,
    goal: text(input.goal, 40) || "Hipertrofia",
    level: LEVELS.includes(input.level as RoutineLevel) ? (input.level as RoutineLevel) : "Intermedio",
    createdAt: now,
    updatedAt: now,
    createdBy: input.by || "entrenador",
    versions: [version],
  };
  const rows = readAll();
  rows.push(template);
  writeAll(rows);
  return template;
}

export function saveDraft(
  gymId: string,
  id: string,
  patch: { name?: string; goal?: string; level?: string; days?: unknown },
): RoutineTemplate {
  const rows = readAll();
  const i = rows.findIndex((t) => t.gymId === gymId && t.id === id);
  if (i < 0) throw new Error("rutina_no_encontrada");
  const draft = rows[i].versions.findIndex((v) => v.status === "borrador");
  if (draft < 0) throw new Error("sin_borrador");
  const name = patch.name != null ? text(patch.name, 80) : rows[i].name;
  if (!name) throw new Error("nombre_requerido");
  const versions = rows[i].versions.slice();
  versions[draft] = {
    ...versions[draft],
    days: patch.days != null ? sanitizeDays(patch.days) : versions[draft].days,
  };
  rows[i] = {
    ...rows[i],
    name,
    goal: patch.goal != null ? text(patch.goal, 40) || rows[i].goal : rows[i].goal,
    level: patch.level && LEVELS.includes(patch.level as RoutineLevel) ? (patch.level as RoutineLevel) : rows[i].level,
    updatedAt: new Date().toISOString(),
    versions,
  };
  writeAll(rows);
  return rows[i];
}

export function publishRoutine(gymId: string, id: string): RoutineTemplate {
  const rows = readAll();
  const i = rows.findIndex((t) => t.gymId === gymId && t.id === id);
  if (i < 0) throw new Error("rutina_no_encontrada");
  const draft = rows[i].versions.findIndex((v) => v.status === "borrador");
  if (draft < 0) throw new Error("sin_borrador");
  const days = rows[i].versions[draft].days;
  const hasExercise = days.some((d) => d.blocks.some((b) => b.items.length));
  if (!rows[i].name || !hasExercise) throw new Error("borrador_vacio");
  const versions = rows[i].versions.slice();
  versions[draft] = { ...versions[draft], status: "publicada", publishedAt: new Date().toISOString() };
  rows[i] = { ...rows[i], updatedAt: new Date().toISOString(), versions };
  writeAll(rows);
  return rows[i];
}

export function openDraft(gymId: string, id: string): RoutineTemplate {
  const rows = readAll();
  const i = rows.findIndex((t) => t.gymId === gymId && t.id === id);
  if (i < 0) throw new Error("rutina_no_encontrada");
  if (rows[i].versions.some((v) => v.status === "borrador")) return rows[i];
  const source = [...rows[i].versions].reverse().find((v) => v.status === "publicada");
  if (!source) throw new Error("sin_version");
  const now = new Date().toISOString();
  const copy: RoutineVersion = {
    id: randomUUID(),
    number: source.number + 1,
    status: "borrador",
    createdAt: now,
    publishedAt: null,
    days: JSON.parse(JSON.stringify(source.days)),
  };
  rows[i] = { ...rows[i], updatedAt: now, versions: [...rows[i].versions, copy] };
  writeAll(rows);
  return rows[i];
}

export function appendExercise(gymId: string, id: string, exerciseId: string): RoutineTemplate {
  const chosen = text(exerciseId, 80);
  if (!known.has(chosen)) throw new Error("ejercicio_desconocido");
  const rows = readAll();
  const i = rows.findIndex((t) => t.gymId === gymId && t.id === id);
  if (i < 0) throw new Error("rutina_no_encontrada");
  const draft = rows[i].versions.findIndex((v) => v.status === "borrador");
  if (draft < 0) throw new Error("sin_borrador");
  const days = JSON.parse(JSON.stringify(rows[i].versions[draft].days)) as RoutineDay[];
  const day = days.find((d) => !d.rest);
  if (!day) throw new Error("sin_dia");
  day.blocks.push({
    id: randomUUID(),
    kind: "ejercicio",
    items: [{
      id: randomUUID(),
      exerciseId: chosen,
      sets: 3,
      reps: "8-12",
      restSec: 90,
      load: "",
      effort: "",
      tempo: "",
      alternativeId: "",
      note: "",
    }],
  });
  const versions = rows[i].versions.slice();
  versions[draft] = { ...versions[draft], days };
  rows[i] = { ...rows[i], updatedAt: new Date().toISOString(), versions };
  writeAll(rows);
  return rows[i];
}

export function deleteRoutine(gymId: string, id: string) {
  const rows = readAll();
  const next = rows.filter((t) => !(t.gymId === gymId && t.id === id));
  if (next.length === rows.length) throw new Error("rutina_no_encontrada");
  writeAll(next);
}
