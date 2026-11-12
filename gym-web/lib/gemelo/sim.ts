import { DEMO_SOCIOS, SEDE_IDS } from "./demoSocios";
/**
 * Gemelo digital VISIONYX — simulación pura (sin three.js).
 * Todo es ficticio: nombres, planes y montos son datos de demostración.
 * Determinista: RNG con semilla, sin Date.now() dentro de la simulación.
 */

export type Zone = "pesas" | "cardio" | "funcional";
export type StationKind = "cinta" | "bici" | "banco" | "rack" | "mancuernas" | "tapete" | "cajon" | "estira";
export type Phase =
  | "fuera"
  | "llegando"
  | "fila"
  | "validando"
  | "recepcion_ir"
  | "recepcion"
  | "caminando"
  | "entrenando"
  | "saliendo"
  | "staff";

export type Station = { x: number; z: number; rot: number; kind: StationKind; zone: Zone; occ: number };
export type ZoneRect = { zone: Zone | "lobby"; label: string; x0: number; z0: number; x1: number; z1: number };
export type Gate = { x: number; z: number; queue: number[]; busy: boolean; open: number; flash: number; flashOk: boolean };

export type Layout = {
  index: number;
  name: string;
  city: string;
  accent: string;
  accent2: string;
  mirror: 1 | -1;
  capacity: number;
  stations: Station[];
  gates: Gate[];
  exitX: number;
  reception: { x: number; z: number };
  kiosk: { x: number; z: number };
  zones: ZoneRect[];
};

export type Member = {
  id: number;
  name: string;
  plan: string;
  planPrice: number;
  daysLeft: number;
  routine: string;
  /** Acceso real: rostro. Invitados sin rostro: PIN de un solo uso en /ingreso */
  method: "Facial" | "PIN";
  pref: Zone;
  shirt: string;
  pants: string;
  skin: string;
  x: number;
  z: number;
  y: number;
  h: number;
  phase: Phase;
  path: { x: number; z: number }[];
  timer: number;
  session: number;
  station: number; // index o -1
  gate: number;
  vencida: boolean;
  speedMul: number;
  moving: boolean;
  anim: number;
  kind: StationKind | "walk" | "idle";
  visits: number;
  willRenew: boolean;
  /** id real en la base demo (para "Ver en el panel"), si corresponde */
  socioId?: string;
};

export type SimEvent = {
  id: number;
  t: number;
  kind: "ok" | "deny" | "renew" | "sale" | "lost" | "exit";
  name: string;
  detail: string;
  amount?: number;
  x: number;
  z: number;
  member: number;
};

export type Stats = {
  aforo: number;
  ingresosHoy: number;
  accesosOk: number;
  accesosNeg: number;
  renovaciones: number;
  porVencer: number;
  dineroRiesgo: number;
  ventasPos: number;
};

export const SEDES = [
  { name: "VISIONYX Norte", city: "Bogotá · Norte", accent: "#38BDF8", accent2: "#7C3AED", mirror: 1 as const, seed: 11, mix: [16, 10, 8] },
  { name: "VISIONYX Centro", city: "Bogotá · Centro", accent: "#A78BFA", accent2: "#22D3EE", mirror: -1 as const, seed: 23, mix: [12, 14, 8] },
  { name: "VISIONYX Sur", city: "Bogotá · Sur", accent: "#A3E635", accent2: "#38BDF8", mirror: 1 as const, seed: 37, mix: [12, 8, 14] },
];

export const PLANS = [
  { name: "Mensual", price: 120000, days: 30, w: 0.55 },
  { name: "Trimestral", price: 320000, days: 90, w: 0.22 },
  { name: "Anual", price: 990000, days: 365, w: 0.11 },
  { name: "Pase del día", price: 15000, days: 1, w: 0.12 },
];

const FIRST = [
  "Laura", "Andrés", "Valentina", "Santiago", "Camila", "Juan Pablo", "Mariana", "Sebastián", "Daniela", "Mateo",
  "Sofía", "Alejandro", "Isabella", "Felipe", "Natalia", "Tomás", "Paula", "Esteban", "Manuela", "Julián",
  "Sara", "David", "Luciana", "Samuel", "Gabriela", "Nicolás", "Juliana", "Miguel", "Catalina", "Simón",
  "Antonia", "Emilio", "Valeria", "Martín", "Ana María", "Jerónimo",
];
const LAST = ["G.", "R.", "M.", "P.", "C.", "H.", "V.", "O.", "Z.", "A.", "B.", "L.", "T.", "S.", "J."];
const ROUTINES: Record<Zone, string[]> = {
  pesas: ["Pierna · Sentadilla 4×10", "Empuje · Press banca 4×8", "Tirón · Remo 4×10", "Hombro · Press militar 3×12", "Glúteo · Hip thrust 4×12"],
  cardio: ["Cardio HIIT · 20 min", "Zona 2 · 35 min", "Intervalos 10×1 min", "Bici · 30 min"],
  funcional: ["Full body · Circuito", "Core + movilidad", "Box jumps 5×8", "Kettlebell swing 5×15"],
};
const SHIRTS = ["#38BDF8", "#A78BFA", "#F472B6", "#A3E635", "#FBBF24", "#F87171", "#34D399", "#E8EEFC", "#60A5FA", "#FB923C", "#22D3EE", "#C084FC"];
const PANTS = ["#1F2937", "#111827", "#334155", "#3B2F63", "#0F3A4A", "#27272A"];
const SKINS = ["#F1C27D", "#E0AC69", "#C68642", "#8D5524", "#FFDBAC", "#D29B6C"];
const SALES = [
  { item: "Agua", price: 4000 },
  { item: "Bebida hidratante", price: 9000 },
  { item: "Barra de proteína", price: 12000 },
  { item: "Proteína 2 lb", price: 145000 },
  { item: "Creatina", price: 98000 },
  { item: "Toalla", price: 25000 },
];

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAX_MEMBERS = 78;

/** Ocupación objetivo (0..1) según la hora del día. */
export function occupancyCurve(hour: number): number {
  if (hour < 5 || hour >= 22) return 0;
  const g = (mu: number, s: number, a: number) => a * Math.exp(-((hour - mu) ** 2) / (2 * s * s));
  return Math.min(1, 0.16 + g(6.6, 0.9, 0.62) + g(12.4, 1.0, 0.3) + g(18.6, 1.3, 0.8));
}

export function formatCOP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");
}

export function formatClock(t: number): string {
  const s = ((t % 86400) + 86400) % 86400;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function buildLayout(index: number): Layout {
  const S = SEDES[index];
  const m = S.mirror;
  const st: Station[] = [];
  const add = (x: number, z: number, rot: number, kind: StationKind, zone: Zone) =>
    st.push({ x: x * m, z, rot: m === 1 ? rot : -rot, kind, zone, occ: -1 });
  const [nP, nC, nF] = S.mix;
  // Pesas (lado izquierdo en la sede base)
  const racksX = [-15.5, -12.5, -9.5, -6.5];
  racksX.forEach((x) => add(x, -10.6, 0, "rack", "pesas"));
  const benchCols = nP >= 14 ? [-15, -12, -9, -6] : [-14.5, -10.5, -6.5];
  for (const z of [-5.5, -1.5]) benchCols.forEach((x) => add(x, z, 0, "banco", "pesas"));
  const dbCount = Math.max(2, nP - racksX.length - benchCols.length * 2);
  for (let i = 0; i < dbCount; i++) add(-15 + i * (10 / Math.max(1, dbCount - 1)), 3.6, Math.PI, "mancuernas", "pesas");
  // Cardio (derecha, fondo)
  const cRow = Math.ceil(nC / 2);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < cRow && st.filter((s) => s.zone === "cardio").length < nC; i++) {
      const x = 4.6 + i * (11.4 / Math.max(1, cRow - 1));
      add(x, r === 0 ? -10.8 : -6.6, Math.PI, r === 0 ? "cinta" : i % 2 ? "bici" : "cinta", "cardio");
    }
  }
  // Funcional (derecha, frente)
  const fCols = Math.ceil(nF / 2);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < fCols && st.filter((s) => s.zone === "funcional").length < nF; i++) {
      const x = 4.8 + i * (11 / Math.max(1, fCols - 1));
      const kind: StationKind = i === fCols - 1 && r === 1 ? "cajon" : i === 0 && r === 0 && nF > 10 ? "cajon" : "tapete";
      add(x, r === 0 ? -1.2 : 3.2, Math.PI * 0.5 * (r === 0 ? 0 : 0), kind, "funcional");
    }
  }
  const zones: ZoneRect[] = ([
    { zone: "pesas", label: "Pesas", x0: -17.4 * m, z0: -12.4, x1: -3.2 * m, z1: 5.4 },
    { zone: "cardio", label: "Cardio", x0: 3.2 * m, z0: -12.4, x1: 17.4 * m, z1: -4.4 },
    { zone: "funcional", label: "Funcional", x0: 3.2 * m, z0: -3.0, x1: 17.4 * m, z1: 5.4 },
    { zone: "lobby", label: "Recepción", x0: -17.4, z0: 8.4, x1: 17.4, z1: 12.8 },
  ] as ZoneRect[]).map((r) => ({ ...r, x0: Math.min(r.x0, r.x1), x1: Math.max(r.x0, r.x1) }));
  const gates: Gate[] = [-1, 0, 1].map((x) => ({ x, z: 8, queue: [], busy: false, open: 0, flash: 0, flashOk: true }));
  return {
    index,
    name: S.name,
    city: S.city,
    accent: S.accent,
    accent2: S.accent2,
    mirror: m,
    capacity: 120,
    stations: st,
    gates,
    exitX: 4.4 * m,
    reception: { x: -5 * m, z: 10.4 },
    kiosk: { x: 6.8 * m, z: 9.4 },
    zones,
  };
}

export class GemeloSim {
  t = 17.75 * 3600; // 17:45 — hora pico
  speed = 10;
  layout: Layout;
  members: Member[] = [];
  events: SimEvent[] = [];
  eventSeq = 0;
  stats: Stats;
  history: { t: number; aforo: number }[] = [];
  private rng: () => number;
  private spawnCd = 0;
  private saleCd = 30;
  private histCd = 0;
  forceDenyNext = false;
  /** Carril reservado por el recorrido guiado (-1 = ninguno). */
  reservedGate = -1;
  version = 0;

  constructor(sede = 0) {
    this.layout = buildLayout(sede);
    this.rng = mulberry32(SEDES[sede].seed);
    this.stats = this.baseStats(sede);
    this.initMembers();
  }

  private baseStats(sede: number): Stats {
    const k = [1, 1.25, 0.85][sede] ?? 1;
    return {
      aforo: 0,
      ingresosHoy: Math.round(3_180_000 * k / 1000) * 1000,
      accesosOk: Math.round(312 * k),
      accesosNeg: Math.round(9 * k),
      renovaciones: Math.round(11 * k),
      porVencer: Math.round(23 * k),
      dineroRiesgo: Math.round(23 * k) * 120000,
      ventasPos: Math.round(41 * k),
    };
  }

  setSede(i: number) {
    const speed = this.speed;
    const t = this.t;
    this.layout = buildLayout(i);
    this.rng = mulberry32(SEDES[i].seed);
    this.stats = this.baseStats(i);
    this.members = [];
    this.events = [];
    this.history = [];
    this.t = t;
    this.speed = speed;
    this.initMembers();
    this.version++;
  }

  r(a = 0, b = 1) {
    return a + (b - a) * this.rng();
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rng() * arr.length) % arr.length];
  }

  private newIdentity(m: Partial<Member>) {
    const r = this.rng();
    let acc = 0;
    let plan = PLANS[0];
    for (const p of PLANS) {
      acc += p.w;
      if (r <= acc) {
        plan = p;
        break;
      }
    }
    const pref = this.pick<Zone>(["pesas", "pesas", "cardio", "funcional"]);
    const mr = this.rng();
    const real = m.id !== undefined && m.id >= 1 && m.id <= 14 ? DEMO_SOCIOS[SEDE_IDS[this.layout.index]]?.[m.id - 1] : undefined;
    Object.assign(m, {
      socioId: real ? real[0] : undefined,
      name: real ? `${real[1].split(" ")[0]} ${real[1].split(" ")[1]?.charAt(0) ?? ""}.` : `${this.pick(FIRST)} ${this.pick(LAST)}`,
      plan: plan.name,
      planPrice: plan.price,
      daysLeft: Math.max(1, Math.round(this.r(1, plan.days))),
      routine: this.pick(ROUTINES[pref]),
      method: !real && mr > 0.94 ? "PIN" : "Facial",
      pref,
      shirt: this.pick(SHIRTS),
      pants: this.pick(PANTS),
      skin: this.pick(SKINS),
      vencida: this.rng() < 0.1,
      willRenew: this.rng() < 0.72,
      speedMul: this.r(0.85, 1.2),
    });
    // invitado: entra una sola vez con el PIN que le dio el socio que lo invitó
    if (m.method === "PIN") m.vencida = false;
  }

  private initMembers() {
    const L = this.layout;
    for (let i = 0; i < MAX_MEMBERS; i++) {
      const m = {
        id: i, x: 0, z: 20, y: 0, h: Math.PI, phase: "fuera", path: [], timer: 0, session: 0, station: -1, gate: -1,
        moving: false, anim: this.r(0, 10), kind: "idle", visits: 0,
      } as unknown as Member;
      this.newIdentity(m);
      this.members.push(m);
    }
    // Recepcionista (staff)
    const staff = this.members[0];
    staff.name = "Recepción · Turno tarde";
    staff.phase = "staff";
    staff.x = L.reception.x;
    staff.z = L.reception.z - 1.1;
    staff.h = 0;
    staff.shirt = "#0EA5E9";
    staff.vencida = false;
    // Arranque en caliente: gente ya entrenando
    const target = Math.round(this.targetInside() * 0.92);
    let placed = 0;
    for (let i = 1; i < MAX_MEMBERS && placed < target; i++) {
      const m = this.members[i];
      m.vencida = false;
      const s = this.chooseStation(m);
      if (s < 0) break;
      const S = L.stations[s];
      S.occ = m.id;
      m.station = s;
      m.x = S.x;
      m.z = S.z;
      m.h = S.rot;
      m.phase = "entrenando";
      m.kind = S.kind;
      m.timer = this.r(30, 420);
      m.session = this.r(300, 3600);
      placed++;
    }
    // Algunos caminando adentro
    for (let i = 0; i < 6; i++) {
      const m = this.members.find((mm) => mm.phase === "fuera");
      if (!m) break;
      m.vencida = false;
      m.x = this.r(-1.5, 1.5);
      m.z = this.r(-6, 6);
      m.session = this.r(600, 3000);
      this.goToStation(m);
    }
    this.history = [];
    for (let k = 0; k <= 30; k++) {
      const tt = this.t - (30 - k) * 600;
      this.history.push({ t: tt, aforo: Math.round(occupancyCurve(tt / 3600) * 62 + Math.sin(k * 1.7) * 2) });
    }
    this.recount();
  }

  targetInside() {
    return Math.round(occupancyCurve(this.hour()) * 62);
  }
  hour() {
    return (this.t % 86400) / 3600;
  }

  emit(e: Omit<SimEvent, "id" | "t">) {
    const ev = { ...e, id: ++this.eventSeq, t: this.t };
    this.events.push(ev);
    if (this.events.length > 40) this.events.shift();
    return ev;
  }

  private recount() {
    let n = 0;
    for (const m of this.members) {
      if (m.phase === "caminando" || m.phase === "entrenando" || (m.phase === "saliendo" && m.z < 8)) n++;
    }
    this.stats.aforo = n;
  }

  chooseStation(m: Member): number {
    const L = this.layout;
    const free = L.stations.map((s, i) => ({ s, i })).filter(({ s }) => s.occ === -1);
    if (!free.length) return -1;
    const pref = free.filter(({ s }) => s.zone === m.pref);
    const pool = pref.length && this.rng() < 0.8 ? pref : free;
    return pool[Math.floor(this.rng() * pool.length) % pool.length].i;
  }

  private goToStation(m: Member) {
    const L = this.layout;
    const s = this.chooseStation(m);
    const aisle = this.r(-0.9, 0.9);
    let tx: number, tz: number, rot: number, kind: StationKind;
    if (s >= 0) {
      const S = L.stations[s];
      S.occ = m.id;
      m.station = s;
      tx = S.x;
      tz = S.z;
      rot = S.rot;
      kind = S.kind;
      if (S.zone !== m.pref && this.rng() < 0.5) m.routine = this.pick(ROUTINES[S.zone]);
    } else {
      m.station = -1;
      const fz = L.zones.find((z) => z.zone === "funcional")!;
      tx = this.r(fz.x0 + 1, fz.x1 - 1);
      tz = this.r(fz.z0 + 1, fz.z1 - 1);
      rot = this.r(-3, 3);
      kind = "estira";
    }
    const approachZ = tz + 1.5;
    m.path = [
      { x: aisle, z: Math.min(m.z, 6.5) },
      { x: aisle, z: approachZ },
      { x: tx, z: approachZ },
      { x: tx, z: tz },
    ];
    if (m.z > 7.5) m.path.unshift({ x: m.x, z: 6.8 });
    m.phase = "caminando";
    m.kind = kind;
    (m as any)._rot = rot;
  }

  private goExit(m: Member) {
    const L = this.layout;
    if (m.station >= 0) L.stations[m.station].occ = -1;
    m.station = -1;
    const ex = L.exitX;
    m.path = [
      { x: this.r(-0.8, 0.8), z: Math.min(Math.max(m.z, -10), 5) + 1.2 },
      { x: ex, z: 6.6 },
      { x: ex, z: 9.4 },
      { x: ex * 0.9, z: 13.6 },
      { x: this.r(-15, 15), z: 19.5 },
    ];
    m.phase = "saliendo";
    m.kind = "walk";
  }

  private spawn() {
    const m = this.members.find((mm, i) => i > 0 && mm.phase === "fuera");
    if (!m) return;
    this.newIdentity(m);
    if (this.forceDenyNext) {
      m.vencida = true;
      m.willRenew = true;
      this.forceDenyNext = false;
    }
    m.x = this.r(-15, 15) * (this.rng() < 0.5 ? 1 : 0.6);
    m.z = 19.5;
    m.visits = 0;
    const L = this.layout;
    const g = this.pickGate();
    m.gate = g;
    m.path = [{ x: this.r(-2.5, 2.5), z: 13.8 }];
    m.phase = "llegando";
    m.kind = "walk";
    m.session = this.r(1800, 4200);
  }

  pickGate(): number {
    const L = this.layout;
    let g = -1;
    for (let i = 0; i < L.gates.length; i++) {
      if (i === this.reservedGate) continue;
      if (g < 0 || L.gates[i].queue.length < L.gates[g].queue.length) g = i;
    }
    return Math.max(0, g);
  }

  /** Reserva un carril para el recorrido: reubica a quien esté en esa fila. */
  reserveGate(i: number) {
    this.reservedGate = i;
    if (i < 0) return;
    const g = this.layout.gates[i];
    for (const id of g.queue) {
      const m = this.members[id];
      if (m.phase !== "fila") continue;
      const ng = this.pickGate();
      m.gate = ng;
      this.layout.gates[ng].queue.push(id);
    }
    g.queue = g.queue.filter((id) => this.members[id].phase === "validando");
    for (const m of this.members) if (m.phase === "llegando" && m.gate === i) m.gate = this.pickGate();
  }

  /** Mueve hacia (tx,tz). Devuelve true si llegó. */
  private move(m: Member, tx: number, tz: number, dist: number): boolean {
    const dx = tx - m.x;
    const dz = tz - m.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.02) {
      m.x = tx;
      m.z = tz;
      return true;
    }
    const want = Math.atan2(dx, dz);
    let dh = want - m.h;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    m.h += dh * Math.min(1, dist * 3.5);
    m.moving = true;
    if (d <= dist) {
      m.x = tx;
      m.z = tz;
      return true;
    }
    m.x += (dx / d) * dist;
    m.z += (dz / d) * dist;
    return false;
  }

  private followPath(m: Member, dist: number): boolean {
    while (m.path.length && dist > 0) {
      const p = m.path[0];
      const d = Math.hypot(p.x - m.x, p.z - m.z);
      if (this.move(m, p.x, p.z, dist)) {
        m.path.shift();
        dist -= d;
      } else return false;
    }
    return m.path.length === 0;
  }

  motionMul() {
    return this.speed >= 60 ? 3.2 : this.speed >= 10 ? 1.5 : 1;
  }

  /** Avanza la simulación `realDt` segundos reales (se subdivide). */
  step(realDt: number) {
    let remaining = Math.min(realDt, 0.5);
    while (remaining > 1e-6) {
      const d = Math.min(remaining, 1 / 30);
      this.subStep(d);
      remaining -= d;
    }
  }

  private subStep(dt: number) {
    const clockDt = dt * this.speed;
    const mdt = dt * this.motionMul();
    this.t += clockDt;
    const L = this.layout;
    const S = this.stats;

    // Llegadas según la curva de ocupación
    this.spawnCd -= clockDt;
    if (this.spawnCd <= 0) {
      let incoming = 0;
      for (const m of this.members) if (m.phase === "llegando" || m.phase === "fila") incoming++;
      if (this.stats.aforo + incoming < this.targetInside() + 4 && incoming < 14) this.spawn();
      this.spawnCd = this.r(2, 6) * Math.max(1, this.speed / 10) * 0.6 + 0.4;
    }

    // Ventas POS en recepción
    this.saleCd -= clockDt;
    if (this.saleCd <= 0) {
      const sale = this.pick(SALES);
      S.ingresosHoy += sale.price;
      S.ventasPos++;
      this.emit({ kind: "sale", name: "Caja", detail: `Venta POS · ${sale.item}`, amount: sale.price, x: L.reception.x, z: L.reception.z, member: -1 });
      this.saleCd = this.r(120, 420);
    }

    // Puertas
    for (const g of L.gates) {
      g.open = Math.max(0, g.open - dt);
      g.flash = Math.max(0, g.flash - dt);
      g.queue = g.queue.filter((id) => this.members[id].phase === "fila" || this.members[id].phase === "validando");
    }

    for (const m of this.members) {
      m.moving = false;
      switch (m.phase) {
        case "fuera":
        case "staff":
          break;
        case "llegando": {
          if (this.followPath(m, 1.35 * m.speedMul * mdt)) {
            m.phase = "fila";
            L.gates[m.gate].queue.push(m.id);
          }
          break;
        }
        case "fila": {
          const g = L.gates[m.gate];
          const idx = g.queue.indexOf(m.id);
          const tz = g.z + 1.15 + idx * 0.85;
          this.move(m, g.x, tz, 1.3 * mdt);
          if (idx === 0 && !g.busy && Math.abs(m.z - tz) < 0.05) {
            g.busy = true;
            m.phase = "validando";
            m.timer = 0.75;
          }
          break;
        }
        case "validando": {
          const g = L.gates[m.gate];
          m.h += (Math.PI - m.h) * 0.2;
          m.timer -= mdt;
          if (m.timer <= 0) {
            g.flash = 1.1;
            g.queue = g.queue.filter((id) => id !== m.id);
            if (!m.vencida) {
              g.flashOk = true;
              g.open = 1.5;
              S.accesosOk++;
              m.visits++;
              this.emit({ kind: "ok", name: m.name, detail: m.method === "PIN" ? "Invitado · PIN de un solo uso" : `Acceso facial · ${m.plan} · ${m.daysLeft} días`, x: g.x, z: g.z, member: m.id });
              m.path = [{ x: g.x, z: g.z - 1.2 }];
              this.goToStationAfterGate(m);
              setTimeoutLike(g);
            } else {
              g.flashOk = false;
              S.accesosNeg++;
              this.emit({ kind: "deny", name: m.name, detail: "Membresía vencida o sin plan", x: g.x, z: g.z, member: m.id });
              g.busy = false;
              m.path = [
                { x: g.x, z: g.z + 1.6 },
                { x: L.reception.x + this.r(-1.2, 1.2), z: L.reception.z + 1.4 },
              ];
              m.phase = "recepcion_ir";
              m.kind = "walk";
            }
          }
          break;
        }
        case "recepcion_ir": {
          if (this.followPath(m, 1.3 * m.speedMul * mdt)) {
            m.phase = "recepcion";
            m.timer = 2.4;
            m.kind = "idle";
          }
          break;
        }
        case "recepcion": {
          m.h += (Math.PI - m.h) * 0.1;
          m.h = Math.PI + (m.h - Math.PI);
          m.timer -= mdt;
          if (m.timer <= 0) {
            if (m.willRenew) {
              m.vencida = false;
              const plan = PLANS.find((p) => p.name === m.plan) || PLANS[0];
              m.daysLeft = plan.days;
              S.ingresosHoy += m.planPrice;
              S.renovaciones++;
              S.porVencer = Math.max(0, S.porVencer - 1);
              S.dineroRiesgo = Math.max(0, S.dineroRiesgo - m.planPrice);
              this.emit({ kind: "renew", name: m.name, detail: `Renovación ${m.plan}`, amount: m.planPrice, x: L.reception.x, z: L.reception.z, member: m.id });
              const g = this.pickGate();
              m.gate = g;
              m.path = [{ x: L.gates[g].x, z: 12.2 }];
              m.phase = "llegando";
              m.kind = "walk";
            } else {
              S.dineroRiesgo += m.planPrice;
              S.porVencer++;
              this.emit({ kind: "lost", name: m.name, detail: `No renovó · ${formatCOP(m.planPrice)} en riesgo`, amount: m.planPrice, x: L.reception.x, z: L.reception.z, member: m.id });
              m.path = [{ x: this.r(-3, 3), z: 13.8 }, { x: this.r(-15, 15), z: 19.5 }];
              m.phase = "saliendo";
              m.kind = "walk";
            }
          }
          break;
        }
        case "caminando": {
          if (this.followPath(m, 1.35 * m.speedMul * mdt)) {
            m.phase = "entrenando";
            m.h = (m as any)._rot ?? m.h;
            m.timer = this.r(240, 600);
          }
          break;
        }
        case "entrenando": {
          m.timer -= clockDt;
          m.session -= clockDt;
          if (m.timer <= 0) {
            if (m.session <= 0 || this.hour() >= 22) this.goExit(m);
            else {
              if (m.station >= 0) L.stations[m.station].occ = -1;
              m.station = -1;
              this.goToStation(m);
            }
          }
          break;
        }
        case "saliendo": {
          if (this.followPath(m, 1.4 * m.speedMul * mdt)) {
            m.phase = "fuera";
            m.kind = "idle";
          }
          break;
        }
      }
      if (m.phase !== "entrenando") m.anim += mdt * (m.moving ? 7 : 2);
      else m.anim += dt * (this.speed >= 60 ? 2.2 : 1.2) * 4;
    }
    // libera torniquetes tras el paso
    for (const g of L.gates) {
      if (g.busy && (g as any)._release !== undefined) {
        (g as any)._release -= mdt;
        if ((g as any)._release <= 0) {
          g.busy = false;
          delete (g as any)._release;
        }
      }
    }

    this.histCd -= clockDt;
    if (this.histCd <= 0) {
      this.history.push({ t: this.t, aforo: this.stats.aforo });
      if (this.history.length > 60) this.history.shift();
      this.histCd = 300;
    }
    this.recount();
  }

  private goToStationAfterGate(m: Member) {
    const g = this.layout.gates[m.gate];
    m.x = g.x;
    this.goToStation(m);
    m.path.unshift({ x: g.x, z: g.z - 1.0 });
  }

  /** Socio que está por validar (para seguirlo en cámara). */
  nextAtGate(): number {
    let best = -1;
    let bestScore = 1e9;
    for (const m of this.members) {
      if (m.phase === "validando") return m.id;
      if (m.phase === "fila") {
        const idx = this.layout.gates[m.gate].queue.indexOf(m.id);
        if (idx < bestScore) {
          bestScore = idx;
          best = m.id;
        }
      }
      if (m.phase === "llegando" && best < 0) best = m.id;
    }
    return best;
  }

  trainingIn(zone: Zone): number {
    const c = this.members.filter((m) => m.phase === "entrenando" && m.station >= 0 && this.layout.stations[m.station].zone === zone);
    return c.length ? c[Math.floor(c.length / 2)].id : -1;
  }
}

function setTimeoutLike(g: Gate) {
  (g as any)._release = 0.9;
}

export function phaseLabel(m: Member, L: Layout): string {
  switch (m.phase) {
    case "llegando":
      return "Llegando a la sede";
    case "fila":
      return "En fila para ingresar";
    case "validando":
      return m.method === "PIN" ? "Invitado · digitando PIN…" : "Validando rostro…";
    case "recepcion_ir":
    case "recepcion":
      return m.vencida ? "En recepción · renovando" : "En recepción";
    case "caminando":
      return "Yendo a su estación";
    case "entrenando": {
      const s = m.station >= 0 ? L.stations[m.station] : null;
      if (!s) return "Estiramiento";
      const zl = s.zone === "pesas" ? "Pesas" : s.zone === "cardio" ? "Cardio" : "Funcional";
      return `Entrenando · ${zl}`;
    }
    case "saliendo":
      return "Saliendo";
    case "staff":
      return "Equipo VISIONYX";
    default:
      return "";
  }
}
