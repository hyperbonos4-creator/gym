/**
 * Planes y membresías por sede. La vigencia que guarda aquí es la que la
 * puerta consulta en cada reconocimiento (validUntil). Si ya pasó y no se
 * renovó, el torniquete niega aunque el rostro coincida.
 */
import path from "path";
import { dataDir } from "./dataDir";
import { readJsonFile, writeJsonFile, updateJsonFileSync } from "./jsonStore";
import { randomUUID } from "crypto";

const FILE = path.join(dataDir(), "memberships.json");

export type AccessWindow = "completo" | "manana" | "noche" | "personalizado";

export type PricePoint = { price: number; from: string };

export type Plan = {
  id: string;
  gymId: string;
  name: string;
  description?: string;
  /** Líneas comerciales que escribió el administrador. No se inventan. */
  benefits?: string[];
  price: number;
  durationDays: number;
  /** completo = todo el día. mañana, noche o personalizado limitan la puerta. */
  accessWindow?: AccessWindow;
  /** 0=domingo … 6=sábado. Vacío = todos los días. */
  accessDays?: number[] | null;
  accessFrom?: string | null;
  accessTo?: string | null;
  /** Cobro automático no está activo. Toda renovación se hace en recepción. */
  renewal?: "manual";
  priceHistory?: PricePoint[];
  /** Precio que entra a regir en `from`, sin reescribir membresías ya vendidas. */
  nextPrice?: { price: number; from: string } | null;
  /** membresia = entra mientras el calendario siga vigente. tiquetera = ingresos contados del titular. */
  kind?: "membresia" | "tiquetera";
  /** Ingresos incluidos. En una tiquetera se gastan al entrar el titular o un invitado. */
  guestCredits?: number;
  active: boolean;
  createdAt: string;
};

export type PayMethod = "efectivo" | "tarjeta" | "transferencia" | "wompi";
export type PayState = "pagada" | "pendiente";

export type Membership = {
  id: string;
  gymId: string;
  socioId: string;
  planId: string;
  planName: string;
  price: number;
  durationDays: number;
  startsOn: string;
  endsOn: string;
  /** Instante en que la puerta deja de abrir. Fin del día de endsOn, Bogotá. */
  validUntil: string;
  accessWindow?: AccessWindow;
  accessDays?: number[] | null;
  accessFrom?: string | null;
  accessTo?: string | null;
  /** Día (Bogotá) en que se avisó el vencimiento por WhatsApp. */
  lastNoticeOn?: string | null;
  status: "activa" | "suspendida" | "cancelada";
  /** Sin este campo el cobro no quedó registrado. No se inventa un pago. */
  payState?: PayState | null;
  method?: PayMethod | null;
  cancelReason?: string | null;
  kind?: "membresia" | "tiquetera";
  /** Ingresos al vender la tiquetera. No aplica a una membresía de calendario. */
  creditsTotal?: number;
  creditsLeft?: number;
  /** Reconocimientos ya descontados, para no cobrar dos veces el mismo ingreso. */
  usedEntries?: string[];
  /** Último estado ya escrito en la puerta. */
  pushed?: string | null;
  createdAt: string;
};

type Db = { plans: Plan[]; memberships: Membership[] };

const STARTER: { name: string; durationDays: number; price: number }[] = [
  { name: "Pase del día", durationDays: 1, price: 1500 },
  { name: "Mensual", durationDays: 30, price: 1500 },
  { name: "Trimestral", durationDays: 90, price: 1500 },
  { name: "Anual", durationDays: 365, price: 1500 },
];

function readDb(): Db {
  try {
    const raw = readJsonFile<any>(FILE, { plans: [], memberships: [] });
    return {
      plans: Array.isArray(raw.plans) ? raw.plans : [],
      memberships: Array.isArray(raw.memberships) ? raw.memberships : [],
    };
  } catch {
    return { plans: [], memberships: [] };
  }
}

function writeDb(db: Db) {
  writeJsonFile(FILE, db);
}

export function bogotaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function endOfBogotaDay(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T23:59:59-05:00`).toISOString();
}

export function doorSchedule(source?: {
  accessWindow?: AccessWindow;
  accessDays?: number[] | null;
  accessFrom?: string | null;
  accessTo?: string | null;
} | null): { days?: number[]; from?: string; to?: string } | null {
  if (!source) return null;
  let from: string | undefined;
  let to: string | undefined;
  if (source.accessWindow === "manana") {
    from = "05:00";
    to = "12:00";
  } else if (source.accessWindow === "noche") {
    from = "17:00";
    to = "22:00";
  } else if (source.accessWindow === "personalizado" && source.accessFrom && source.accessTo) {
    from = source.accessFrom;
    to = source.accessTo;
  }
  const days = source.accessDays?.filter((d) => d >= 0 && d <= 6);
  const limitedDays = days && days.length > 0 && days.length < 7 ? [...new Set(days)] : undefined;
  if (!from && !limitedDays) return null;
  return {
    ...(limitedDays ? { days: limitedDays } : {}),
    ...(from && to ? { from, to } : {}),
  };
}

export function daysLeft(endsOn: string, today = bogotaToday()): number {
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = endsOn.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export type LiveMembership = Membership & { live: "activa" | "vencida" | "suspendida" | "cancelada"; days: number };

export function liveOf(m: Membership, today = bogotaToday()): LiveMembership["live"] {
  if (m.status === "cancelada") return "cancelada";
  if (m.status === "suspendida") return "suspendida";
  if (m.kind === "tiquetera" && (m.creditsLeft ?? 0) < 1) return "vencida";
  return m.endsOn >= today ? "activa" : "vencida";
}

function decorate(m: Membership, today = bogotaToday()): LiveMembership {
  return { ...m, live: liveOf(m, today), days: daysLeft(m.endsOn, today) };
}

export function ensurePlans(gymId: string): Plan[] {
  const db = readDb();
  if (db.plans.some((p) => p.gymId === gymId)) return db.plans.filter((p) => p.gymId === gymId);
  const now = new Date().toISOString();
  const created = STARTER.map((s) => ({
    id: randomUUID(),
    gymId,
    name: s.name,
    price: s.price,
    durationDays: s.durationDays,
    active: true,
    createdAt: now,
  }));
  db.plans.push(...created);
  writeDb(db);
  return created;
}

function cleanLines(lines: string[] | undefined): string[] {
  return [...new Set((lines || []).map((s) => s.trim()).filter((s) => s.length > 1))].slice(0, 6);
}

function cleanDays(days: number[] | null | undefined): number[] | null {
  if (!days?.length) return null;
  const unique = [...new Set(days.filter((d) => d >= 0 && d <= 6))].sort((a, b) => a - b);
  return unique.length && unique.length < 7 ? unique : null;
}

function clockOk(value: string | null | undefined): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function applyDuePrices(db: Db): boolean {
  const today = bogotaToday();
  let changed = false;
  for (const plan of db.plans) {
    if (!plan.nextPrice || plan.nextPrice.from > today) continue;
    const history = plan.priceHistory?.length
      ? plan.priceHistory
      : [{ price: plan.price, from: (plan.createdAt || today).slice(0, 10) }];
    history.push({ price: plan.nextPrice.price, from: plan.nextPrice.from });
    plan.priceHistory = history;
    plan.price = plan.nextPrice.price;
    plan.nextPrice = null;
    changed = true;
  }
  return changed;
}

export function listPlans(gymId: string): Plan[] {
  ensurePlans(gymId);
  const db = readDb();
  if (applyDuePrices(db)) writeDb(db);
  return db.plans.filter((p) => p.gymId === gymId).sort((a, b) => a.durationDays - b.durationDays);
}

export type PlanInput = {
  name: string;
  description?: string;
  benefits?: string[];
  price: number;
  durationDays: number;
  accessWindow?: AccessWindow;
  accessDays?: number[] | null;
  accessFrom?: string | null;
  accessTo?: string | null;
  active?: boolean;
  nextPrice?: { price: number; from: string } | null;
  kind?: "membresia" | "tiquetera";
  guestCredits?: number;
};

function ticketOf(input: PlanInput): Pick<Plan, "kind" | "guestCredits"> {
  if (input.kind !== "tiquetera") return { kind: "membresia" };
  const n = Math.round(Number(input.guestCredits || 0));
  if (n < 1 || n > 200) throw new Error("invitados_invalidos");
  return { kind: "tiquetera", guestCredits: n };
}

function accessOf(input: PlanInput): Pick<Plan, "accessWindow" | "accessDays" | "accessFrom" | "accessTo"> {
  const window: AccessWindow =
    input.accessWindow === "manana" || input.accessWindow === "noche" || input.accessWindow === "personalizado"
      ? input.accessWindow
      : "completo";
  const from = clockOk(input.accessFrom) ? input.accessFrom : null;
  const to = clockOk(input.accessTo) ? input.accessTo : null;
  if (window === "personalizado" && (!from || !to || from >= to)) throw new Error("horario_invalido");
  return {
    accessWindow: window,
    accessDays: cleanDays(input.accessDays),
    accessFrom: window === "personalizado" ? from : null,
    accessTo: window === "personalizado" ? to : null,
  };
}

export function createPlan(gymId: string, input: PlanInput): Plan {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("nombre_corto");
  const durationDays = Math.round(input.durationDays);
  const price = Math.round(input.price);
  if (durationDays < 1 || durationDays > 3660) throw new Error("duracion_invalida");
  if (price < 0) throw new Error("precio_invalido");
  ensurePlans(gymId);
  const access = accessOf(input);
  const today = bogotaToday();
  const plan: Plan = {
    id: randomUUID(),
    gymId,
    name,
    description: input.description?.trim() || "",
    benefits: cleanLines(input.benefits),
    price,
    durationDays,
    ...access,
    renewal: "manual",
    priceHistory: [{ price, from: today }],
    nextPrice: null,
    ...ticketOf(input),
    active: input.active !== false,
    createdAt: new Date().toISOString(),
  };
  const fresh = readDb();
  fresh.plans.push(plan);
  writeDb(fresh);
  return plan;
}

export function updatePlan(gymId: string, id: string, patch: Partial<PlanInput> & { active?: boolean }): Plan {
  const db = readDb();
  const i = db.plans.findIndex((p) => p.id === id && p.gymId === gymId);
  if (i < 0) throw new Error("plan_no_encontrado");
  const cur = db.plans[i];
  if (patch.name != null) {
    const name = patch.name.trim();
    if (name.length < 2) throw new Error("nombre_corto");
    cur.name = name;
  }
  if (patch.description != null) cur.description = patch.description.trim();
  if (patch.benefits != null) cur.benefits = cleanLines(patch.benefits);
  if (patch.price != null) {
    const price = Math.max(0, Math.round(patch.price));
    if (price !== cur.price) {
      const today = bogotaToday();
      const history = cur.priceHistory?.length
        ? cur.priceHistory
        : [{ price: cur.price, from: (cur.createdAt || today).slice(0, 10) }];
      history.push({ price, from: today });
      cur.priceHistory = history;
      cur.price = price;
    }
  }
  if (patch.durationDays != null) {
    const d = Math.round(patch.durationDays);
    if (d < 1) throw new Error("duracion_invalida");
    cur.durationDays = d;
  }
  if (patch.accessWindow != null || patch.accessDays !== undefined || patch.accessFrom !== undefined || patch.accessTo !== undefined) {
    Object.assign(cur, accessOf({ ...cur, ...patch, name: cur.name, price: cur.price, durationDays: cur.durationDays }));
  }
  if (patch.nextPrice !== undefined) {
    if (!patch.nextPrice) cur.nextPrice = null;
    else {
      const from = String(patch.nextPrice.from || "");
      const price = Math.max(0, Math.round(patch.nextPrice.price));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || from <= bogotaToday()) throw new Error("precio_futuro_invalido");
      cur.nextPrice = { price, from };
    }
  }
  if (patch.active != null) cur.active = !!patch.active;
  if (patch.kind != null || patch.guestCredits != null) {
    const kind = patch.kind === "tiquetera" || (patch.kind == null && cur.kind === "tiquetera") ? "tiquetera" : "membresia";
    if (kind === "tiquetera") {
      const n = Math.round(Number(patch.guestCredits ?? cur.guestCredits ?? 0));
      if (n < 1 || n > 200) throw new Error("invitados_invalidos");
      cur.kind = "tiquetera";
      cur.guestCredits = n;
    } else {
      cur.kind = "membresia";
    }
  }
  cur.renewal = "manual";
  db.plans[i] = cur;
  writeDb(db);
  return cur;
}

export function planCatalog(gymId: string) {
  const plans = listPlans(gymId);
  const today = bogotaToday();
  const month = today.slice(0, 7);
  const rows = listMemberships(gymId);
  const inMonth = (iso: string) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return false;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit" }).format(new Date(t));
    return parts === month;
  };
  const governing = new Map<string, LiveMembership>();
  for (const m of rows) {
    if (m.status === "cancelada") continue;
    const prev = governing.get(m.socioId);
    if (!prev || prev.endsOn < m.endsOn) governing.set(m.socioId, m);
  }
  const byPlan = plans.map((plan) => {
    const mine = rows.filter((m) => m.planId === plan.id);
    const active = [...governing.values()].filter((m) => m.planId === plan.id && m.live === "activa").length;
    const thisMonth = mine.filter((m) => inMonth(m.createdAt));
    const renewals = thisMonth.filter((m) => rows.some((older) => older.socioId === m.socioId && older.createdAt < m.createdAt)).length;
    const paid = thisMonth.filter((m) => m.payState === "pagada").reduce((sum, m) => sum + (m.price || 0), 0);
    return { id: plan.id, active, renewals, paid };
  });
  const membresiasActivas = [...governing.values()].filter((m) => m.live === "activa").length;
  const ranked = [...byPlan].sort((a, b) => b.active - a.active);
  const popularId = ranked[0] && ranked[0].active > 0 && ranked[0].active > (ranked[1]?.active || 0) ? ranked[0].id : null;
  return {
    plans,
    byPlan,
    popularId,
    disponibles: plans.filter((p) => p.active).length,
    ocultos: plans.filter((p) => !p.active).length,
    membresiasActivas,
    renovacionesMes: byPlan.reduce((sum, p) => sum + p.renewals, 0),
    cobradoMes: byPlan.reduce((sum, p) => sum + p.paid, 0),
  };
}

export function listMemberships(gymId: string): LiveMembership[] {
  const today = bogotaToday();
  return readDb()
    .memberships.filter((m) => m.gymId === gymId)
    .map((m) => decorate(m, today))
    .sort((a, b) => (a.endsOn < b.endsOn ? 1 : -1));
}

/** Plan de calendario. La tiquetera no alarga ni aplaza este plazo. */
function calendarMembership(gymId: string, socioId: string): LiveMembership | null {
  const rows = listMemberships(gymId).filter((m) => m.socioId === socioId && m.status !== "cancelada" && m.kind !== "tiquetera");
  if (!rows.length) return null;
  return rows.sort((a, b) => (a.endsOn < b.endsOn ? 1 : -1))[0];
}

function openTicket(gymId: string, socioId: string): LiveMembership | null {
  const rows = listMemberships(gymId).filter(
    (m) => m.socioId === socioId && m.kind === "tiquetera" && m.status !== "cancelada" && m.live === "activa" && (m.creditsLeft ?? 0) > 0,
  );
  if (!rows.length) return null;
  return rows.sort((a, b) => (a.endsOn < b.endsOn ? -1 : 1))[0];
}

/**
 * Lo que la ficha y la puerta deben obedecer.
 * Una mensual vigente manda. Si no hay calendario vigente, manda la tiquetera con ingresos.
 * Si esa también se acabó, queda el plan de calendario aunque esté vencido.
 */
export function currentMembership(gymId: string, socioId: string): LiveMembership | null {
  const calendar = calendarMembership(gymId, socioId);
  if (calendar?.live === "activa") return calendar;
  return openTicket(gymId, socioId) || calendar;
}

/** Si el plan que manda sigue en calendario, el siguiente empieza al día siguiente. */
function nextStart(current: LiveMembership | null, today: string): { startsOn: string; stacks: boolean } {
  const stacks = !!(current && current.live !== "cancelada" && current.live !== "vencida" && current.endsOn >= today);
  return { startsOn: stacks && current ? addDays(current.endsOn, 1) : today, stacks };
}

export function previewMembership(gymId: string, socioId: string, planId: string) {
  const plan = listPlans(gymId).find((p) => p.id === planId && p.active);
  if (!plan) throw new Error("plan_no_disponible");
  const today = bogotaToday();
  const current = plan.kind === "tiquetera" ? null : calendarMembership(gymId, socioId);
  const { startsOn, stacks } = nextStart(current, today);
  return {
    planId: plan.id,
    planName: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    startsOn,
    endsOn: addDays(startsOn, plan.durationDays - 1),
    stacks,
    currentEndsOn: current && current.live !== "cancelada" ? current.endsOn : null,
  };
}

export function assignMembership(
  gymId: string,
  socioId: string,
  planId: string,
  opts?: { payState?: PayState; method?: PayMethod | null },
): LiveMembership {
  const db = readDb();
  const plan = db.plans.find((p) => p.id === planId && p.gymId === gymId && p.active);
  if (!plan) throw new Error("plan_no_disponible");
  const today = bogotaToday();
  const ticket = plan.kind === "tiquetera";
  const credits = ticket ? Math.round(plan.guestCredits || 0) : 0;
  if (ticket && (credits < 1 || credits > 200)) throw new Error("invitados_invalidos");
  const current = ticket ? null : calendarMembership(gymId, socioId);
  const { startsOn } = nextStart(current, today);
  const endsOn = addDays(startsOn, plan.durationDays - 1);
  const row: Membership = {
    id: randomUUID(),
    gymId,
    socioId,
    planId: plan.id,
    planName: plan.name,
    price: plan.price,
    durationDays: plan.durationDays,
    startsOn,
    endsOn,
    validUntil: endOfBogotaDay(endsOn),
    accessWindow: plan.accessWindow || "completo",
    accessDays: plan.accessDays || null,
    accessFrom: plan.accessFrom || null,
    accessTo: plan.accessTo || null,
    status: "activa",
    payState: opts?.payState || null,
    method: opts?.payState === "pagada" ? opts.method || null : null,
    ...(ticket ? { kind: "tiquetera" as const, creditsTotal: credits, creditsLeft: credits } : {}),
    createdAt: new Date().toISOString(),
  };
  const fresh = readDb();
  fresh.memberships.push(row);
  writeDb(fresh);
  return decorate(row, today);
}

export function cancelMembership(gymId: string, socioId: string, reason = ""): LiveMembership | null {
  const current = currentMembership(gymId, socioId);
  if (!current || (current.live !== "activa" && current.live !== "suspendida")) return current;
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === current.id);
  if (i < 0) return null;
  db.memberships[i] = {
    ...db.memberships[i],
    status: "cancelada",
    cancelReason: reason.trim() || null,
    validUntil: new Date().toISOString(),
  };
  writeDb(db);
  return decorate(db.memberships[i]);
}

export function suspendMembership(gymId: string, socioId: string): LiveMembership | null {
  const current = currentMembership(gymId, socioId);
  if (!current || current.live !== "activa") return current;
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === current.id);
  if (i < 0) return null;
  db.memberships[i] = {
    ...db.memberships[i],
    status: "suspendida",
    validUntil: new Date().toISOString(),
  };
  writeDb(db);
  return decorate(db.memberships[i]);
}

export function resumeMembership(gymId: string, socioId: string): LiveMembership | null {
  const current = currentMembership(gymId, socioId);
  if (!current || current.live !== "suspendida") return current;
  if (current.endsOn < bogotaToday()) throw new Error("ya_vencida");
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === current.id);
  if (i < 0) return null;
  db.memberships[i] = {
    ...db.memberships[i],
    status: "activa",
    validUntil: endOfBogotaDay(current.endsOn),
  };
  writeDb(db);
  return decorate(db.memberships[i]);
}

export function markPaid(gymId: string, membershipId: string, method: PayMethod): LiveMembership {
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === membershipId && m.gymId === gymId);
  if (i < 0) throw new Error("membresia_no_encontrada");
  if (db.memberships[i].payState !== "pendiente") throw new Error("no_esta_pendiente");
  db.memberships[i] = { ...db.memberships[i], payState: "pagada", method };
  writeDb(db);
  return decorate(db.memberships[i]);
}

/** Pase de invitados vigente. Se gasta primero el que vence antes. */
export function guestWallet(gymId: string, socioId: string) {
  const rows = listMemberships(gymId).filter((m) => m.socioId === socioId && m.kind === "tiquetera" && m.status !== "cancelada" && m.live === "activa");
  const spend = [...rows].filter((m) => (m.creditsLeft ?? 0) > 0).sort((a, b) => (a.endsOn < b.endsOn ? -1 : 1))[0] || null;
  return {
    left: rows.reduce((sum, m) => sum + (m.creditsLeft ?? 0), 0),
    total: rows.reduce((sum, m) => sum + (m.creditsTotal ?? 0), 0),
    until: rows.reduce((max, m) => (m.endsOn > max ? m.endsOn : max), ""),
    spend,
  };
}

export function reserveGuestCredit(gymId: string, membershipId: string): LiveMembership {
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === membershipId && m.gymId === gymId && m.kind === "tiquetera");
  if (i < 0) throw new Error("sin_pase");
  const left = db.memberships[i].creditsLeft ?? 0;
  if (left < 1) throw new Error("sin_creditos");
  db.memberships[i] = { ...db.memberships[i], creditsLeft: left - 1 };
  writeDb(db);
  return decorate(db.memberships[i]);
}

export function releaseGuestCredit(gymId: string, membershipId: string) {
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === membershipId && m.gymId === gymId && m.kind === "tiquetera");
  if (i < 0) return;
  const row = db.memberships[i];
  const total = row.creditsTotal ?? row.creditsLeft ?? 0;
  const left = Math.min(total, (row.creditsLeft ?? 0) + 1);
  db.memberships[i] = { ...row, creditsLeft: left };
  writeDb(db);
}

/**
 * Cada reconocimiento del titular descuenta un ingreso de la tiquetera.
 * El mismo evento no se cobra dos veces. Una mensual vigente no gasta la tiquetera.
 * Devuelve los socios cuyo cupo cambió.
 */
export function takeHolderEntries(
  gymId: string,
  events: { subjectId?: string; subject_id?: string; recordedAt?: string; recorded_at?: string; decision?: string; reason?: string }[],
): string[] {
  const db = readDb();
  const today = bogotaToday();
  const changed = new Set<string>();
  for (const ev of events) {
    const decision = String(ev?.decision || "").toUpperCase();
    const reason = String(ev?.reason || "").toUpperCase();
    if (decision !== "GRANTED" || reason !== "MATCHED") continue;
    const socioId = String(ev?.subjectId || ev?.subject_id || "");
    const at = String(ev?.recordedAt || ev?.recorded_at || "");
    if (!socioId || !at) continue;
    const calendar = db.memberships
      .filter((m) => m.gymId === gymId && m.socioId === socioId && m.status !== "cancelada" && m.kind !== "tiquetera")
      .map((m) => decorate(m, today))
      .sort((a, b) => (a.endsOn < b.endsOn ? 1 : -1))[0];
    if (calendar?.live === "activa") continue;
    const key = `${socioId}|${at}`;
    const rows = db.memberships.filter((m) => m.gymId === gymId && m.socioId === socioId && m.kind === "tiquetera" && m.status !== "cancelada");
    if (rows.some((m) => (m.usedEntries || []).includes(key))) continue;
    const open = rows
      .map((m) => decorate(m, today))
      .filter((m) => m.live === "activa" && (m.creditsLeft ?? 0) > 0)
      .sort((a, b) => (a.endsOn < b.endsOn ? -1 : 1))[0];
    if (!open) continue;
    const i = db.memberships.findIndex((m) => m.id === open.id);
    const row = db.memberships[i];
    db.memberships[i] = {
      ...row,
      creditsLeft: Math.max(0, (row.creditsLeft ?? 0) - 1),
      usedEntries: [...(row.usedEntries || []), key].slice(-40),
      pushed: null,
    };
    changed.add(socioId);
  }
  if (changed.size) writeDb(db);
  return [...changed];
}

/** Tiqueteras cuyo cupo o vencimiento todavía no está escrito en la puerta. */
export function ticketsNeedingDoor(gymId: string): { id: string; socioId: string; stamp: string }[] {
  const socios = new Set(listMemberships(gymId).filter((m) => m.kind === "tiquetera").map((m) => m.socioId));
  const out: { id: string; socioId: string; stamp: string }[] = [];
  for (const socioId of socios) {
    const current = currentMembership(gymId, socioId);
    if (!current || current.kind !== "tiquetera") continue;
    const stamp = `${current.live}|${current.creditsLeft ?? 0}|${current.validUntil}`;
    if (current.pushed === stamp) continue;
    out.push({ id: current.id, socioId, stamp });
  }
  return out;
}

export function retargetMembershipSocio(oldId: string, newId: string) {
  if (!oldId || !newId || oldId === newId) return;
  const db = readDb();
  let changed = false;
  for (const row of db.memberships) {
    if (row.socioId !== oldId) continue;
    row.socioId = newId;
    changed = true;
  }
  if (changed) writeDb(db);
}

export function markDoorPushed(gymId: string, membershipId: string, stamp: string) {
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === membershipId && m.gymId === gymId);
  if (i < 0) return;
  db.memberships[i] = { ...db.memberships[i], pushed: stamp };
  writeDb(db);
}

/** Fecha que debe obedecer la puerta ahora. Pasada si el plan que manda no está vigente. */
export function doorUntil(gymId: string, socioId: string): string {
  const current = currentMembership(gymId, socioId);
  if (current && current.live === "activa") return current.validUntil;
  return new Date(Date.now() - 1000).toISOString();
}

function governing(gymId: string): LiveMembership[] {
  const rows = listMemberships(gymId).filter((m) => m.status !== "cancelada");
  const bySocio = new Map<string, LiveMembership>();
  for (const m of rows) {
    const prev = bySocio.get(m.socioId);
    if (!prev || prev.endsOn < m.endsOn) bySocio.set(m.socioId, m);
  }
  return [...bySocio.values()];
}

export function renewalBoard(gymId: string) {
  const pack = (rows: LiveMembership[]) => ({
    count: rows.length,
    amount: rows.reduce((sum, m) => sum + (m.price || 0), 0),
  });
  const active = governing(gymId).filter((m) => m.live === "activa");
  return {
    hoy: pack(active.filter((m) => m.days === 0)),
    manana: pack(active.filter((m) => m.days === 1)),
    semana: pack(active.filter((m) => m.days >= 2 && m.days <= 7)),
  };
}

/** Solo si el mismo plan aparece al menos dos veces en el historial real. */
export function suggestRenewal(gymId: string, socioId: string) {
  const rows = listMemberships(gymId).filter((m) => m.socioId === socioId && m.status !== "cancelada");
  if (rows.length < 2) return null;
  const planId = rows[0].planId;
  const times = rows.filter((m) => m.planId === planId).length;
  if (times < 2) return null;
  const plan = listPlans(gymId).find((p) => p.id === planId && p.active);
  if (!plan) return null;
  return { planId: plan.id, planName: plan.name, price: plan.price, times };
}

export function accessCoverage(gymId: string, socioIds: string[]) {
  const summary = membershipSummary(gymId);
  const latest = new Map<string, LiveMembership>();
  for (const m of listMemberships(gymId)) {
    if (m.status === "cancelada") continue;
    const prev = latest.get(m.socioId);
    if (!prev || prev.endsOn < m.endsOn) latest.set(m.socioId, m);
  }
  let sinPlan = 0;
  for (const id of socioIds) {
    const c = latest.get(id);
    if (!c || c.live !== "activa") sinPlan += 1;
  }
  const bloqueados = socioIds
    .filter((id) => {
      const c = latest.get(id);
      return !c || c.live !== "activa";
    })
    .map((id) => {
      const c = latest.get(id);
      return { id, endsOn: c?.endsOn || null, live: c?.live || "sin_plan" };
    });
  return { ...summary, sinPlan, bloqueados };
}

export function membershipSummary(gymId: string) {
  const current = governing(gymId);
  const board = renewalBoard(gymId);
  return {
    activas: current.filter((m) => m.live === "activa").length,
    vencidas: current.filter((m) => m.live === "vencida").length,
    porVencer: current.filter((m) => m.live === "activa" && m.days <= 7).length,
    renovacionesHoy: board.hoy.count + board.manana.count,
    ingresosHoy: board.hoy.amount + board.manana.amount,
  };
}

/** Vigentes que vencen en 3 días o menos y aún no se avisaron hoy. */
export function dueNotices(gymId: string): LiveMembership[] {
  const today = bogotaToday();
  const latest = new Map<string, LiveMembership>();
  for (const m of listMemberships(gymId)) {
    if (m.live !== "activa") continue;
    const prev = latest.get(m.socioId);
    if (!prev || prev.endsOn < m.endsOn) latest.set(m.socioId, m);
  }
  return [...latest.values()].filter((m) => m.days >= 0 && m.days <= 3 && m.lastNoticeOn !== today);
}

export function markNoticed(gymId: string, id: string) {
  const db = readDb();
  const i = db.memberships.findIndex((m) => m.id === id && m.gymId === gymId);
  if (i < 0) return;
  db.memberships[i] = { ...db.memberships[i], lastNoticeOn: bogotaToday() };
  writeDb(db);
}
