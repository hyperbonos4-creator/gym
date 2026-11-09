/**
 * Cola persistente de sincronización puerta (setDoorUntil).
 * Si el backend de acceso falla, se reintenta y el estado queda visible.
 */
import path from "path";
import { setDoorUntil } from "./accessBackend";
import { readJsonFile, updateJsonFileSync, writeJsonFile } from "./jsonStore";

const FILE = path.join(process.cwd(), "data", "door-outbox.json");

export type DoorOutboxItem = {
  id: string;
  gymId: string;
  socioId: string;
  membershipId?: string;
  stamp?: string;
  validUntil: string;
  schedule: { days?: number[]; from?: string; to?: string } | null;
  attempts: number;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "done" | "failed";
};

type Db = { items: DoorOutboxItem[] };

function readDb(): Db {
  const db = readJsonFile<Db>(FILE, { items: [] });
  if (!Array.isArray(db.items)) return { items: [] };
  return db;
}

function writeDb(db: Db) {
  writeJsonFile(FILE, db);
}

function idOf(socioId: string, stamp: string) {
  return `${socioId}:${stamp || "na"}`;
}

export function enqueueDoorSync(input: {
  gymId: string;
  socioId: string;
  membershipId?: string;
  stamp?: string;
  validUntil: string;
  schedule: { days?: number[]; from?: string; to?: string } | null;
}): DoorOutboxItem {
  const now = new Date().toISOString();
  const id = idOf(input.socioId, input.stamp || input.validUntil);
  let row: DoorOutboxItem = {
    id,
    gymId: input.gymId,
    socioId: input.socioId,
    membershipId: input.membershipId,
    stamp: input.stamp,
    validUntil: input.validUntil,
    schedule: input.schedule,
    attempts: 0,
    lastError: null,
    createdAt: now,
    updatedAt: now,
    status: "pending",
  };
  updateJsonFileSync<Db>(FILE, { items: [] }, (db) => {
    const i = db.items.findIndex((x) => x.id === id);
    if (i >= 0) {
      row = {
        ...db.items[i]!,
        ...row,
        attempts: db.items[i]!.attempts,
        createdAt: db.items[i]!.createdAt,
        status: "pending",
      };
      db.items[i] = row;
    } else {
      db.items.push(row);
    }
  });
  return row;
}

export function listDoorOutbox(gymId?: string, limit = 50): DoorOutboxItem[] {
  const items = readDb().items.filter((x) => (gymId ? x.gymId === gymId : true));
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}

export function pendingDoorOutbox(limit = 20): DoorOutboxItem[] {
  return readDb()
    .items.filter((x) => x.status === "pending" || x.status === "failed")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, limit);
}

export async function flushDoorOutbox(limit = 20): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  for (const item of pendingDoorOutbox(limit)) {
    try {
      await setDoorUntil(item.socioId, item.validUntil, item.schedule);
      updateJsonFileSync<Db>(FILE, { items: [] }, (db) => {
        const i = db.items.findIndex((x) => x.id === item.id);
        if (i < 0) return;
        db.items[i] = {
          ...db.items[i]!,
          status: "done",
          attempts: db.items[i]!.attempts + 1,
          lastError: null,
          updatedAt: new Date().toISOString(),
        };
      });
      ok += 1;
      console.info("[door-outbox] synced", item.socioId, item.validUntil);
    } catch (e: any) {
      fail += 1;
      const msg = String(e?.message || e).slice(0, 300);
      updateJsonFileSync<Db>(FILE, { items: [] }, (db) => {
        const i = db.items.findIndex((x) => x.id === item.id);
        if (i < 0) return;
        const attempts = db.items[i]!.attempts + 1;
        db.items[i] = {
          ...db.items[i]!,
          status: attempts >= 8 ? "failed" : "pending",
          attempts,
          lastError: msg,
          updatedAt: new Date().toISOString(),
        };
      });
      console.warn("[door-outbox] fail", item.socioId, msg);
    }
  }
  return { ok, fail };
}
