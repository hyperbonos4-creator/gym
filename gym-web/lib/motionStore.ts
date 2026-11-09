import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { EXERCISES } from "./exercisesCatalog";
import {
  sanitizeKeys,
  starterKeys,
  type MotionClip,
  type MotionKeyframe,
  type MotionPiece,
  type PublishedSnapshot,
} from "./motionModel";

const FILE = path.join(process.cwd(), "data", "motion-studio.json");
const known = new Set(EXERCISES.map((e) => e.id));

function readAll(): MotionPiece[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw.filter(isPiece) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: MotionPiece[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf-8");
  fs.renameSync(tmp, FILE);
}

function isPiece(raw: unknown): raw is MotionPiece {
  return Boolean(raw && typeof raw === "object" && typeof (raw as MotionPiece).id === "string");
}

function text(v: unknown, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

function exerciseIdOf(v: unknown) {
  const id = text(v, 80);
  return id && known.has(id) ? id : "";
}

export function listPieces(gymId: string) {
  return readAll()
    .filter((p) => p.gymId === gymId)
    .map((p) => ({
      id: p.id,
      name: p.name,
      exerciseId: p.exerciseId,
      equipment: p.equipment,
      status: p.published ? "publicado" as const : "borrador" as const,
      version: p.published?.version || 0,
      updatedAt: p.updatedAt,
    }));
}

export function getPiece(gymId: string, id: string) {
  return readAll().find((p) => p.gymId === gymId && p.id === id) || null;
}

export function publishedClip(exerciseId: string): MotionClip | null {
  const id = exerciseIdOf(exerciseId);
  if (!id) return null;
  const hits = readAll().filter((p) => p.exerciseId === id && p.published && p.published.keys.length >= 2);
  hits.sort((a, b) => String(b.published?.at).localeCompare(String(a.published?.at)));
  const piece = hits[0];
  if (!piece?.published) return null;
  return {
    pieceId: piece.id,
    name: piece.name,
    exerciseId: piece.exerciseId,
    version: piece.published.version,
    author: piece.published.author,
    publishedAt: piece.published.at,
    keys: piece.published.keys,
  };
}

export function createPiece(input: { gymId: string; name: string; exerciseId: string; author: string }) {
  const name = text(input.name, 80);
  if (!name) throw new Error("nombre_requerido");
  const now = new Date().toISOString();
  const piece: MotionPiece = {
    id: randomUUID(),
    gymId: text(input.gymId, 80) || "fuerza-elite",
    name,
    exerciseId: exerciseIdOf(input.exerciseId),
    equipment: "",
    muscles: "",
    technique: "",
    mistakes: "",
    sets: "",
    reps: "",
    draft: starterKeys(exerciseIdOf(input.exerciseId)),
    published: null,
    history: [],
    author: text(input.author, 80),
    updatedAt: now,
  };
  const rows = readAll();
  rows.push(piece);
  writeAll(rows);
  return piece;
}

export function savePiece(
  gymId: string,
  id: string,
  patch: {
    name?: unknown;
    exerciseId?: unknown;
    equipment?: unknown;
    muscles?: unknown;
    technique?: unknown;
    mistakes?: unknown;
    sets?: unknown;
    reps?: unknown;
    draft?: unknown;
  },
) {
  const rows = readAll();
  const piece = rows.find((p) => p.gymId === gymId && p.id === id);
  if (!piece) throw new Error("no_encontrado");
  const name = text(patch.name ?? piece.name, 80);
  if (!name) throw new Error("nombre_requerido");
  piece.name = name;
  piece.exerciseId = exerciseIdOf(patch.exerciseId ?? piece.exerciseId);
  piece.equipment = text(patch.equipment ?? piece.equipment, 80);
  piece.muscles = text(patch.muscles ?? piece.muscles, 160);
  piece.technique = text(patch.technique ?? piece.technique, 600);
  piece.mistakes = text(patch.mistakes ?? piece.mistakes, 600);
  piece.sets = text(patch.sets ?? piece.sets, 24);
  piece.reps = text(patch.reps ?? piece.reps, 24);
  piece.draft = sanitizeKeys(patch.draft ?? piece.draft);
  piece.updatedAt = new Date().toISOString();
  writeAll(rows);
  return piece;
}

export function publishPiece(gymId: string, id: string, author: string) {
  const rows = readAll();
  const piece = rows.find((p) => p.gymId === gymId && p.id === id);
  if (!piece) throw new Error("no_encontrado");
  const keys = sanitizeKeys(piece.draft);
  if (sameStanding(keys)) throw new Error("sin_movimiento");
  const version = (piece.published?.version || 0) + 1;
  if (piece.published) piece.history = [...piece.history, piece.published].slice(-8);
  const snap: PublishedSnapshot = {
    version,
    at: new Date().toISOString(),
    author: text(author, 80) || piece.author,
    keys,
  };
  piece.published = snap;
  piece.draft = keys;
  piece.updatedAt = snap.at;
  if (piece.exerciseId) {
    for (const other of rows) {
      if (other.id !== piece.id && other.gymId === gymId && other.exerciseId === piece.exerciseId && other.published) {
        other.history = [...other.history, other.published].slice(-8);
        other.published = null;
        other.updatedAt = snap.at;
      }
    }
  }
  writeAll(rows);
  return piece;
}

export function restorePrevious(gymId: string, id: string) {
  const rows = readAll();
  const piece = rows.find((p) => p.gymId === gymId && p.id === id);
  if (!piece) throw new Error("no_encontrado");
  if (!piece.history.length) throw new Error("sin_historial");
  const previous = piece.history[piece.history.length - 1];
  const rest = piece.history.slice(0, -1);
  if (piece.published) rest.push(piece.published);
  piece.history = rest.slice(-8);
  piece.published = previous;
  piece.draft = sanitizeKeys(previous.keys);
  piece.updatedAt = new Date().toISOString();
  writeAll(rows);
  return piece;
}

export function unpublishPiece(gymId: string, id: string) {
  const rows = readAll();
  const piece = rows.find((p) => p.gymId === gymId && p.id === id);
  if (!piece) throw new Error("no_encontrado");
  if (piece.published) {
    piece.history = [...piece.history, piece.published].slice(-8);
    piece.published = null;
    piece.updatedAt = new Date().toISOString();
    writeAll(rows);
  }
  return piece;
}

function sameStanding(keys: MotionKeyframe[]) {
  return keys.every((key) =>
    Object.values(key.pose).every((angle) => Math.abs(angle.flex) < 1 && Math.abs(angle.open) < 1),
  );
}
