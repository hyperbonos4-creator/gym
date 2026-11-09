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


const LEVEL_ALIASES: Record<string, RoutineLevel> = {
  inicio: "Inicio",
  principiante: "Inicio",
  intermedio: "Intermedio",
  medio: "Intermedio",
  avanzado: "Avanzado",
};

const LEGACY_EXERCISE: Record<string, string> = {
  "ex-sentadilla": "sentadilla",
  "ex-press": "press-banca",
  "ex-remo": "remo-barra",
  "ex-peso": "peso-muerto-rumano",
  "ex-pressm": "press-militar",
  "ex-dominada": "dominadas-supino",
  "ex-fondo": "fondos",
  "ex-curl": "curl-mancuernas",
};

function mapLevel(raw: unknown): RoutineLevel {
  const s = String(raw ?? "").trim();
  if (LEVELS.includes(s as RoutineLevel)) return s as RoutineLevel;
  return LEVEL_ALIASES[s.toLowerCase()] || "Intermedio";
}

function normalizeVersion(raw: any, fallbackNumber: number): RoutineVersion | null {
  if (!raw || typeof raw !== "object") return null;
  const status = raw.status === "publicada" ? "publicada" : "borrador";
  const number = Math.max(1, Math.round(Number(raw.number) || fallbackNumber));
  return {
    id: text(raw.id, 80) || randomUUID(),
    number,
    status,
    createdAt: text(raw.createdAt, 40) || new Date().toISOString(),
    publishedAt: status === "publicada" ? text(raw.publishedAt, 40) || new Date().toISOString() : null,
    days: sanitizeDays(raw.days),
  };
}

/** Garantiza RoutineTemplate con versions:[] aunque el JSON sea legado o incompleto. */
export function normalizeTemplate(raw: any): RoutineTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const id = text(raw.id, 80);
  const gymId = text(raw.gymId, 80);
  if (!id || !gymId) return null;
  const now = new Date().toISOString();
  let versions: RoutineVersion[] = [];
  if (Array.isArray(raw.versions)) {
    versions = raw.versions
      .map((v: any, i: number) => normalizeVersion(v, i + 1))
      .filter(Boolean) as RoutineVersion[];
  } else if (Array.isArray(raw.bloques) || Array.isArray(raw.dias) || raw.nombre || raw.name) {
    const legacyBlocks = Array.isArray(raw.bloques) ? raw.bloques : [];
    const items = legacyBlocks
      .map((b: any) => {
        const eid = LEGACY_EXERCISE[text(b?.ejercicioId || b?.exerciseId, 80)] || text(b?.ejercicioId || b?.exerciseId, 80);
        return exercise({
          exerciseId: eid,
          sets: b?.series ?? b?.sets ?? 3,
          reps: b?.reps || "8-12",
          restSec: b?.restSec ?? 90,
        });
      })
      .filter(Boolean);
    // Build days via sanitizeDays with proper block shape
    const dayRaw = Array.isArray(raw.dias) && raw.dias.length
      ? raw.dias.map((d: any, i: number) => ({
          label: String(d),
          title: i === 0 ? "Sesion" : `Dia ${i + 1}`,
          rest: false,
          blocks: i === 0 && items.length
            ? items.map((it: any) => ({ kind: "ejercicio", items: [it] }))
            : [],
        }))
      : [{
          label: "Dia 1",
          title: "Sesion",
          rest: false,
          blocks: items.map((it: any) => ({ kind: "ejercicio", items: [it] })),
        }];
    versions = [{
      id: randomUUID(),
      number: 1,
      status: "publicada",
      createdAt: now,
      publishedAt: now,
      days: sanitizeDays(dayRaw),
    }];
  }
  return {
    id,
    gymId,
    name: text(raw.name || raw.nombre, 80) || "Sin nombre",
    goal: text(raw.goal, 40) || "Hipertrofia",
    level: mapLevel(raw.level || raw.nivel),
    createdAt: text(raw.createdAt, 40) || now,
    updatedAt: text(raw.updatedAt, 40) || now,
    createdBy: text(raw.createdBy, 80) || "sistema",
    versions,
  };
}


function readAll(): RoutineTemplate[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    if (!Array.isArray(raw)) return [];
    let dirty = false;
    const out: RoutineTemplate[] = [];
    for (const row of raw) {
      if (!Array.isArray((row as any)?.versions)) dirty = true;
      const n = normalizeTemplate(row);
      if (n) out.push(n);
    }
    if (dirty) {
      try { writeAll(out); } catch { /* heal best-effort */ }
    }
    return out;
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
  const draft = (Array.isArray(rows[i].versions) ? rows[i].versions : []).findIndex((v) => v.status === "borrador");
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
  const draft = (Array.isArray(rows[i].versions) ? rows[i].versions : []).findIndex((v) => v.status === "borrador");
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
  const vers = Array.isArray(rows[i].versions) ? rows[i].versions : [];
  if (vers.some((v) => v.status === "borrador")) return rows[i];
  const source = [...vers].reverse().find((v) => v.status === "publicada");
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
  rows[i] = { ...rows[i], updatedAt: now, versions: [...vers, copy] };
  writeAll(rows);
  return rows[i];
}

export function appendExercise(gymId: string, id: string, exerciseId: string): RoutineTemplate {
  const chosen = text(exerciseId, 80);
  if (!known.has(chosen)) throw new Error("ejercicio_desconocido");
  const rows = readAll();
  const i = rows.findIndex((t) => t.gymId === gymId && t.id === id);
  if (i < 0) throw new Error("rutina_no_encontrada");
  const draft = (Array.isArray(rows[i].versions) ? rows[i].versions : []).findIndex((v) => v.status === "borrador");
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
