/**
 * Invitaciones de un pase de invitados. Cada una es una persona, un ingreso.
 * Crear el enlace aparta un cupo. Se descuenta cuando el invitado registra
 * el rostro. Si la puerta falla antes de ese registro, el cupo vuelve.
 */
import fs from "fs";
import path from "path";
import { readJsonFile, writeJsonFile, updateJsonFileSync } from "./jsonStore";
import { randomInt, randomUUID } from "crypto";
import { guestWallet, releaseGuestCredit, reserveGuestCredit } from "./memberships";

const FILE = path.join(process.cwd(), "data", "invitations.json");

export type InvitationStatus = "pending" | "used" | "cancelled" | "expired";

export type Invitation = {
  id: string;
  gymId: string;
  membershipId: string;
  ownerSocioId: string;
  ownerName: string;
  guestName: string;
  guestDoc: string;
  pin: string;
  token: string;
  status: InvitationStatus;
  subjectId?: string | null;
  enrollUrl?: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
  entryVia?: "pin" | "rostro" | null;
  /** Cupos que quedaron en el pase del titular justo después de descontar este ingreso. */
  creditsLeftAfter?: number | null;
  /** El cupo se descuenta cuando el invitado registra el rostro, no al crear el enlace. */
  settled?: boolean;
  enrolledAt?: string | null;
};

function readAll(): Invitation[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows: Invitation[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  writeJsonFile(FILE, rows);
}

function freshPin(rows: Invitation[]): string {
  const taken = new Set(rows.filter((r) => r.status === "pending").map((r) => r.pin));
  for (let i = 0; i < 30; i++) {
    const pin = String(randomInt(1000, 10000));
    if (!taken.has(pin)) return pin;
  }
  throw new Error("sin_pin");
}

export function retargetInvitationOwner(oldId: string, newId: string) {
  if (!oldId || !newId || oldId === newId) return;
  const rows = readAll();
  let changed = false;
  for (const row of rows) {
    if (row.ownerSocioId !== oldId) continue;
    row.ownerSocioId = newId;
    changed = true;
  }
  if (changed) writeAll(rows);
}

export function invitationSubjectGyms(): { gymId: string; subjectId: string }[] {
  return readAll().flatMap((r) => (r.subjectId ? [{ gymId: r.gymId, subjectId: r.subjectId }] : []));
}

export function listGymInvitations(gymId: string): Invitation[] {
  return readAll()
    .filter((r) => r.gymId === gymId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listOwnerInvitations(gymId: string, ownerSocioId: string): Invitation[] {
  return readAll()
    .filter((r) => r.gymId === gymId && r.ownerSocioId === ownerSocioId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createInvitation(input: {
  gymId: string;
  ownerSocioId: string;
  ownerName: string;
  guestName: string;
  guestDoc: string;
  expiresAt: string;
}): Invitation {
  const guestName = input.guestName.trim();
  const guestDoc = input.guestDoc.trim();
  if (guestName.length < 3) throw new Error("nombre_invitado");
  if (guestDoc.length < 5) throw new Error("documento_invitado");
  const wallet = guestWallet(input.gymId, input.ownerSocioId);
  if (!wallet.spend) throw new Error("sin_creditos");
  const rows = readAll();
  const row: Invitation = {
    id: randomUUID(),
    gymId: input.gymId,
    membershipId: wallet.spend.id,
    ownerSocioId: input.ownerSocioId,
    ownerName: input.ownerName,
    guestName,
    guestDoc,
    pin: freshPin(rows),
    token: randomUUID().replace(/-/g, ""),
    status: "pending",
    subjectId: null,
    enrollUrl: null,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt,
    usedAt: null,
    entryVia: null,
    creditsLeftAfter: null,
    settled: false,
    enrolledAt: null,
  };
  const holds = rows.filter((r) => r.gymId === input.gymId && r.ownerSocioId === input.ownerSocioId && r.status === "pending" && !r.settled).length;
  if (wallet.left - holds < 1) throw new Error("sin_creditos");
  rows.push(row);
  writeAll(rows);
  return row;
}

/** Enlaces enviados que todavía no registran el rostro. Apartan un cupo sin descontarlo. */
export function openHolds(gymId: string, ownerSocioId: string) {
  return readAll().filter((r) => r.gymId === gymId && r.ownerSocioId === ownerSocioId && r.status === "pending" && !r.settled).length;
}

export function attachGuestSubject(id: string, subjectId: string, enrollUrl?: string) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return;
  rows[i] = { ...rows[i], subjectId, enrollUrl: enrollUrl || rows[i].enrollUrl || null };
  writeAll(rows);
}

export function cancelInvitation(gymId: string, ownerSocioId: string, id: string): Invitation | null {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id && r.gymId === gymId && r.ownerSocioId === ownerSocioId);
  if (i < 0) return null;
  if (rows[i].status !== "pending") return rows[i];
  if (rows[i].settled || rows[i].enrolledAt) return rows[i];
  rows[i] = { ...rows[i], status: "cancelled" };
  writeAll(rows);
  return rows[i];
}

function settle(row: Invitation): Invitation {
  if (row.settled) return row;
  reserveGuestCredit(row.gymId, row.membershipId);
  const left = guestWallet(row.gymId, row.ownerSocioId).left;
  return { ...row, settled: true, creditsLeftAfter: left };
}

/** Marca usadas las invitaciones cuyo rostro ya abrió la puerta. */
export function markFaceUsed(subjectIds: Set<string>, usedAt: string) {
  if (!subjectIds.size) return;
  const rows = readAll();
  let changed = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.status !== "pending" || !row.subjectId || !subjectIds.has(row.subjectId)) continue;
    const settled = settle(row);
    rows[i] = { ...settled, status: "used", usedAt, entryVia: "rostro" };
    changed = true;
  }
  if (changed) writeAll(rows);
}

export type Claim = Invitation | "missing" | "used" | "expired";

/** Pasa de pendiente a usada en un solo paso, antes de abrir la puerta. */
export function claimInvitation(code: string): Claim {
  const key = String(code || "").trim();
  if (!key) return "missing";
  const rows = readAll();
  const i = rows.findIndex((r) => r.pin === key);
  if (i < 0) return "missing";
  const row = rows[i];
  if (row.status === "used") return "used";
  if (row.status !== "pending") return "used";
  if (Date.parse(row.expiresAt) < Date.now()) {
    rows[i] = { ...row, status: "expired" };
    writeAll(rows);
    return "expired";
  }
  const settled = settle(row);
  rows[i] = { ...settled, status: "used", usedAt: new Date().toISOString(), entryVia: "pin" };
  writeAll(rows);
  return rows[i];
}

/** La puerta no abrió: el código vuelve a servir y el cupo regresa. */
export function unclaimInvitation(id: string) {
  const rows = readAll();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0 || rows[i].status !== "used") return;
  const row = rows[i];
  const keepCharge = Boolean(row.enrolledAt);
  rows[i] = {
    ...row,
    status: "pending",
    usedAt: null,
    entryVia: null,
    settled: keepCharge,
    creditsLeftAfter: keepCharge ? row.creditsLeftAfter : null,
  };
  writeAll(rows);
  if (!keepCharge && row.settled) releaseGuestCredit(row.gymId, row.membershipId);
}

/** Descuenta el ingreso y marca el registro facial. Si ya estaba registrado, no vuelve a cobrar. */
export function markGuestEnrolled(subjectId: string): Invitation | null {
  const rows = readAll();
  const i = rows.findIndex((r) => r.subjectId === subjectId && !r.enrolledAt && (r.status === "pending" || r.status === "used"));
  if (i < 0) return readAll().find((r) => r.subjectId === subjectId && r.enrolledAt) || null;
  const settled = settle(rows[i]);
  rows[i] = { ...settled, enrolledAt: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}
