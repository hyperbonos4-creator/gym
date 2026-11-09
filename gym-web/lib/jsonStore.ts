/**
 * Lectura/escritura atómica y serializada de JSON en disco.
 * Evita que dos requests concurrentes se pisen (read-modify-write).
 */
import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

const chains = new Map<string, Promise<unknown>>();

function enqueue<T>(file: string, job: () => T): Promise<T> {
  const prev = chains.get(file) || Promise.resolve();
  const next = prev.then(job, job);
  chains.set(
    file,
    next.then(
      () => undefined,
      () => undefined,
    ),
  );
  return next;
}

function atomicWrite(file: string, contents: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.${randomBytes(6).toString("hex")}.tmp`;
  fs.writeFileSync(tmp, contents, "utf-8");
  try {
    fs.renameSync(tmp, file);
  } catch {
    // Windows: rename falla si el destino existe.
    try {
      fs.copyFileSync(tmp, file);
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

export function readJsonFile<T>(file: string, fallback: T): T {
  try {
    const raw = fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(file: string, data: unknown) {
  atomicWrite(file, JSON.stringify(data, null, 2));
}

/** Mutación serializada: lee → muta → escribe atómico. */
export async function updateJsonFile<T>(file: string, fallback: T, mutator: (data: T) => T | void): Promise<T> {
  return enqueue(file, () => {
    const current = readJsonFile<T>(file, fallback);
    const clone = structuredClone(current);
    const result = mutator(clone);
    const next = (result === undefined ? clone : result) as T;
    writeJsonFile(file, next);
    return next;
  });
}

/** Versión síncrona para código legacy que aún no es async. Serializa con lock en proceso. */
const syncLocks = new Map<string, boolean>();

export function updateJsonFileSync<T>(file: string, fallback: T, mutator: (data: T) => T | void): T {
  while (syncLocks.get(file)) {
    // spin muy corto; Node es single-threaded salvo que se mezclen workers.
  }
  syncLocks.set(file, true);
  try {
    const current = readJsonFile<T>(file, fallback);
    const clone =
      typeof structuredClone === "function"
        ? structuredClone(current)
        : (JSON.parse(JSON.stringify(current)) as T);
    const result = mutator(clone);
    const next = (result === undefined ? clone : result) as T;
    writeJsonFile(file, next);
    return next;
  } finally {
    syncLocks.set(file, false);
  }
}

export function readJsonFileLocked<T>(file: string, fallback: T): T {
  return readJsonFile(file, fallback);
}
