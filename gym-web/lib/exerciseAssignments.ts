import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { randomUUID } from "crypto";

const FILE = path.join(dataDir(), "exercise-assignments.json");

export type ExerciseAssignment = {
  id: string;
  gymId: string;
  socioId: string;
  exerciseId: string;
  sentAt: string;
  sentBy: string;
};

function readAll(): ExerciseAssignment[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows: ExerciseAssignment[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), "utf-8");
}

/** Lo que el entrenador envió a esta persona. El más reciente queda primero. */
export function listAssignedExercises(gymId: string, socioId: string) {
  return readAll()
    .filter((r) => r.gymId === gymId && r.socioId === socioId)
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
}

export function assignExercises(gymId: string, socioIds: string[], exerciseId: string, sentBy: string) {
  const rows = readAll();
  const now = new Date().toISOString();
  let count = 0;
  for (const socioId of socioIds) {
    const i = rows.findIndex((r) => r.gymId === gymId && r.socioId === socioId && r.exerciseId === exerciseId);
    if (i >= 0) rows[i] = { ...rows[i], sentAt: now, sentBy };
    else rows.push({ id: randomUUID(), gymId, socioId, exerciseId, sentAt: now, sentBy });
    count += 1;
  }
  writeAll(rows);
  return count;
}
