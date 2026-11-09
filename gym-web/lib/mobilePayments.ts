import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { randomUUID } from "crypto";
import { assignMembership, currentMembership, doorSchedule, doorUntil, listPlans } from "./memberships";
import { recordServiceSale } from "./retailStore";
import { getSocio } from "./sociosStore";
import { setDoorUntil } from "./accessBackend";

const FILE = path.join(dataDir(), "mobile-payments.json");

export type MobilePayment = {
  id: string;
  gymId: string;
  socioId: string;
  planId: string;
  planName: string;
  amount: number;
  reference: string;
  status: "pendiente" | "aprobado" | "rechazado";
  wompiId?: string | null;
  createdAt: string;
  approvedAt?: string | null;
};

function readAll(): MobilePayment[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows: MobilePayment[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), "utf-8");
}

export function listMobilePayments(gymId: string, socioId: string) {
  return readAll()
    .filter((p) => p.gymId === gymId && p.socioId === socioId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createMobilePayment(gymId: string, socioId: string, planId: string): MobilePayment {
  const plan = listPlans(gymId).find((p) => p.id === planId && p.active);
  if (!plan) throw new Error("plan_no_disponible");
  if (plan.price < 50) throw new Error("monto_invalido");
  const row: MobilePayment = {
    id: randomUUID(),
    gymId,
    socioId,
    planId: plan.id,
    planName: plan.name,
    amount: plan.price,
    reference: `FE-${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`,
    status: "pendiente",
    wompiId: null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
  };
  const rows = readAll();
  rows.push(row);
  writeAll(rows);
  return row;
}

export function findByReference(reference: string) {
  return readAll().find((p) => p.reference === reference) || null;
}

/** Solo se llama cuando Wompi confirma APPROVED. No marca un pago a mano. */
export async function approveMobilePayment(reference: string, wompiId = ""): Promise<MobilePayment | null> {
  const rows = readAll();
  const i = rows.findIndex((p) => p.reference === reference);
  if (i < 0) return null;
  if (rows[i].status === "aprobado") return rows[i];
  const row = rows[i];
  const socio = getSocio(row.socioId);
  if (!socio || socio.deletedAt) return null;
  assignMembership(row.gymId, row.socioId, row.planId, { payState: "pagada", method: "wompi" });
  recordServiceSale({
    gymId: row.gymId,
    cashier: "Wompi",
    name: `${row.planName} · ${socio.nombre}`,
    amount: row.amount,
    method: "tarjeta",
    note: `Wompi ${wompiId || row.reference}`,
  });
  try {
    const current = currentMembership(row.gymId, row.socioId);
    await setDoorUntil(row.socioId, doorUntil(row.gymId, row.socioId), current ? doorSchedule(current) : null);
  } catch {
    /* el pago quedó. La puerta se alinea en el siguiente cobro. */
  }
  rows[i] = { ...row, status: "aprobado", wompiId: wompiId || row.wompiId || null, approvedAt: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}

export function rejectMobilePayment(reference: string, wompiId = "") {
  const rows = readAll();
  const i = rows.findIndex((p) => p.reference === reference);
  if (i < 0 || rows[i].status === "aprobado") return rows[i] || null;
  rows[i] = { ...rows[i], status: "rechazado", wompiId: wompiId || rows[i].wompiId || null };
  writeAll(rows);
  return rows[i];
}
