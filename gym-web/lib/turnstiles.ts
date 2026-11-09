/**
 * Torniquetes por sede. La identidad es el chip, no la IP.
 * Cuando el ESP32 anuncia otra dirección, se actualiza la puerta.
 */
import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { readJsonFile, writeJsonFile, updateJsonFileSync } from "./jsonStore";

const FILE = path.join(dataDir(), "turnstiles.json");

export type Turnstile = {
  id: string;
  gymId: string;
  name: string;
  token: string;
  pointId: string | null;
  ssid: string;
  lastIp: string | null;
  lastSeen: string | null;
  fw: string | null;
  rssi: number | null;
  syncedIp: string | null;
  /** Ultimo inbox con Bearer que no coincide con la llave guardada. */
  keyInvalidAt: string | null;
};

export type SeenTurnstile = {
  id: string;
  name: string;
  ip: string;
  fw: string;
  rssi: number | null;
  lastSeen: string;
};

type Db = { devices: Turnstile[]; seen: SeenTurnstile[] };

function readDb(): Db {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return {
      devices: Array.isArray(raw.devices) ? raw.devices : [],
      seen: Array.isArray(raw.seen) ? raw.seen : [],
    };
  } catch {
    return { devices: [], seen: [] };
  }
}

function writeDb(db: Db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  writeJsonFile(FILE, db);
}

export function listTurnstiles(gymId: string): Turnstile[] {
  return readDb().devices.filter((d) => d.gymId === gymId);
}

export function turnstileDoors(): { gymId: string; pointId: string }[] {
  return readDb().devices.flatMap((d) => (d.pointId ? [{ gymId: d.gymId, pointId: d.pointId }] : []));
}

export function unassignedSeen(): SeenTurnstile[] {
  const db = readDb();
  const taken = new Set(db.devices.map((d) => d.id));
  return db.seen.filter((s) => !taken.has(s.id));
}

export function saveTurnstile(input: {
  id: string;
  gymId: string;
  name: string;
  token: string;
  pointId?: string | null;
  ssid?: string;
  ip?: string | null;
  fw?: string | null;
}): Turnstile {
  const db = readDb();
  const id = input.id.trim().toUpperCase();
  const now = new Date().toISOString();
  const prev = db.devices.find((d) => d.id === id);
  const row: Turnstile = {
    id,
    gymId: input.gymId,
    name: input.name.trim() || prev?.name || "Torniquete",
    token: input.token || prev?.token || "",
    pointId: input.pointId === undefined ? prev?.pointId || null : input.pointId,
    ssid: input.ssid ?? prev?.ssid ?? "",
    lastIp: input.ip ?? prev?.lastIp ?? null,
    lastSeen: input.ip ? now : prev?.lastSeen || null,
    fw: input.fw ?? prev?.fw ?? null,
    rssi: prev?.rssi ?? null,
    syncedIp: prev?.syncedIp || null,
    keyInvalidAt: null,
  };
  db.devices = db.devices.filter((d) => d.id !== id);
  db.devices.push(row);
  db.seen = db.seen.filter((s) => s.id !== id);
  writeDb(db);
  return row;
}

/** El chip avisa que está en la red del gimnasio. No abre la puerta. */
function signal(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value >= 0 || value < -120) return null;
  return Math.round(value);
}

export function announceDevice(input: { id: string; token: string; ip: string; fw?: string; rssi?: number | null }): { pointId: string | null; changed: boolean } | null {
  const db = readDb();
  const id = input.id.trim().toUpperCase();
  const row = db.devices.find((d) => d.id === id);
  if (!row || row.token !== input.token || input.token.length < 8) return null;
  const now = new Date().toISOString();
  const changed = row.lastIp !== input.ip;
  row.lastIp = input.ip;
  row.lastSeen = now;
  row.keyInvalidAt = null;
  if (input.fw) row.fw = input.fw;
  const rssi = signal(input.rssi);
  if (rssi != null) row.rssi = rssi;
  writeDb(db);
  return { pointId: row.pointId, changed };
}

export function tokenKnown(token: string): boolean {
  if (token.length < 8) return false;
  return readDb().devices.some((d) => d.token === token);
}

export function deviceForPulse(pointId: string, token: string): { ip: string } | null {
  if (token.length < 8) return null;
  const row = readDb().devices.find((d) => d.pointId === pointId && d.token === token);
  if (!row?.lastIp) return null;
  return { ip: row.lastIp };
}

/** Chip conocido, pero el Bearer del inbox no es la llave guardada en la sede. */
export function noteKeyInvalid(id: string): boolean {
  const db = readDb();
  const row = db.devices.find((d) => d.id === id.trim().toUpperCase());
  if (!row) return false;
  row.keyInvalidAt = new Date().toISOString();
  writeDb(db);
  return true;
}

export function markSynced(id: string, ip: string) {
  const db = readDb();
  const row = db.devices.find((d) => d.id === id);
  if (!row) return;
  row.syncedIp = ip;
  row.lastIp = ip;
  writeDb(db);
}

export function forgetTurnstile(gymId: string, id: string) {
  const db = readDb();
  db.devices = db.devices.filter((d) => !(d.id === id && d.gymId === gymId));
  writeDb(db);
}

/** Aviso del chip en la red. Devuelve el registro si hay que actualizar la puerta. */
export function noteSeen(input: { id: string; name?: string; ip: string; fw?: string; rssi?: number | null }): Turnstile | null {
  const db = readDb();
  const id = input.id.trim().toUpperCase();
  const now = new Date().toISOString();
  const seen: SeenTurnstile = {
    id,
    name: input.name || "Torniquete",
    ip: input.ip,
    fw: input.fw || "",
    rssi: input.rssi ?? null,
    lastSeen: now,
  };
  db.seen = [seen, ...db.seen.filter((s) => s.id !== id)].slice(0, 40);
  const row = db.devices.find((d) => d.id === id);
  let sync: Turnstile | null = null;
  if (row) {
    const changed = row.lastIp !== input.ip || row.syncedIp !== input.ip;
    row.lastIp = input.ip;
    row.lastSeen = now;
    row.fw = input.fw || row.fw;
    const rssi = signal(input.rssi);
    if (rssi != null) row.rssi = rssi;
    if (input.name && row.name === "Torniquete") row.name = input.name;
    if (changed && row.pointId && row.token) sync = { ...row };
  }
  writeDb(db);
  return sync;
}
