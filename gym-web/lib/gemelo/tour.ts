/**
 * Recorrido guiado "Inscripción": una persona llega caminando, recepción la
 * registra en Clientes, le llega el enlace de registro facial al celular,
 * registra su rostro desde su propio móvil y entra por el torniquete.
 * Todo determinista a partir del tiempo del recorrido (sirve para la página
 * interactiva y para grabar el comercial cuadro a cuadro). Datos inventados.
 */
import type { GemeloSim } from "./sim";

export type TourPhase =
  | "off"
  | "walk_in"
  | "form"
  | "registered"
  | "plan"
  | "phone"
  | "enrolled"
  | "to_gate"
  | "gate"
  | "enter"
  | "app"
  | "train"
  | "coach"
  | "food"
  | "to_desk"
  | "to_fridge"
  | "aviso"
  | "invite"
  | "guest_enroll"
  | "ana_gate"
  | "gate_g"
  | "ana_in"
  | "invite2"
  | "to_pin"
  | "pin"
  | "camilo_in"
  | "ledger"
  | "g_end"
  | "gate_deny"
  | "to_recep"
  | "accesos"
  | "renew"
  | "login"
  | "wompi"
  | "back_gate"
  | "fridge"
  | "to_counter"
  | "scan"
  | "fact"
  | "cliente"
  | "items"
  | "files"
  | "pos"
  | "dian"
  | "stock"
  | "order"
  | "close"
  | "desk_end"
  | "training";

/** Capítulos del recorrido: 1 = Inscripción, 2 = Entrenamiento (rutina en la app, maniquí 3D, Motion Studio, valoración y nutrición). */
export type TourChapter = 1 | 2 | 3 | 4 | 5;

export const TOUR_PERSON = {
  nombre: "Valentina Ríos Gómez",
  first: "Valentina",
  docTipo: "CC",
  doc: "1020456789",
  cel: "312 456 7890",
  email: "valentina.rios@correo.com",
  plan: "Mensual",
  price: 120000,
  code: "K7Q2M9",
  routine: "Brazo + hombro · Mancuernas 4×12",
};

type Pt = { x: number; z: number };

const WALK = 1.45; // m/s, paso natural
/**
 * Ritmo del recorrido: lento a propósito para que se lea cada campo y cada
 * pantalla del registro facial (mismo ritmo en la página y en el comercial).
 */
const DUR: Record<string, number> = { form: 12.0, registered: 3.4, plan: 8.4, phone: 37.4, enrolled: 2.6, gate: 2.4 };
const DUR_FAST: Record<string, number> = DUR;
/** Parte 2 · Entrenamiento: tiempos del celular y del panel del entrenador (s). Ver TourPanels2.tsx. */
export const DUR2: Record<string, number> = { gate: 2.4, app: 18.2, train: 6.4, coach: 31.2, food: 8.4 };
/** Parte 3 · Caja y ventas: punto de venta, factura DIAN, inventario, pedido al proveedor y cierre de caja (s). Ver TourPanels3.tsx. */
/** Parte 4 · Membresía vencida: aviso por WhatsApp, rechazo en la puerta, renovación en caja y reingreso (s). Ver TourPanels4.tsx. */
export const DUR4: Record<string, number> = { aviso: 8.0, gate_deny: 5.6, accesos: 6.4, login: 9.4, wompi: 16.0, gate: 2.6 };
/** Parte 5 · Invitados y kiosko: invitación desde la app, rostro del invitado, PIN de respaldo en /ingreso (s). Ver TourPanels5.tsx. */
export const DUR5: Record<string, number> = { invite: 10.0, guest_enroll: 9.0, gate_g: 2.8, invite2: 9.0, pin: 9.0, ledger: 8.0 };
/** Invitados de la Parte 5 (nombres y documentos de demostración) */
export const GUESTS = [
  { nombre: "Ana Torres", doc: "1015332871", first: "Ana" },
  { nombre: "Camilo Pérez", doc: "79865412", first: "Camilo" },
];
/** Puesto de ingreso de invitados (tableta con /ingreso) junto a los torniquetes */
export function pinStand(L: { mirror: number; gates: { x: number; z: number }[] }) {
  const m = L.mirror;
  return { x: -2.3 * m, z: L.gates[0].z + 1.0 };
}
type Walker = { x: number; z: number; h: number; walk: number; moving: boolean; on: boolean };
export const DUR3: Record<string, number> = {
  fridge: 5.0, scan: 6.0, pos: 10.6, fact: 7.0, cliente: 9.0, items: 7.4, dian: 7.0, files: 6.4, stock: 8.6, order: 10.0, close: 8.4,
};

function pathLen(p: Pt[]) {
  let d = 0;
  for (let i = 1; i < p.length; i++) d += Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
  return d;
}

function along(p: Pt[], dist: number): { x: number; z: number; h: number } {
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (dist <= L || i === p.length - 1) {
      const k = L > 0 ? Math.min(1, dist / L) : 1;
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, h: Math.atan2(b.x - a.x, b.z - a.z) };
    }
    dist -= L;
  }
  return { x: p[0].x, z: p[0].z, h: 0 };
}

/** Nevera de bebidas junto a recepción (Parte 3): centro, frente (+z) y dónde se para Valentina. */
export function fridgeSpot(L: { mirror: number; reception: { x: number; z: number } }) {
  const m = L.mirror;
  const x = L.reception.x - 3.6 * m;
  const z = L.reception.z;
  return { x, z, front: z + 0.375, standX: x + 0.3 * m, standZ: z + 1.0 };
}

export class Tour {
  active = false;
  t = 0;
  phase: TourPhase = "off";
  phaseT = 0;
  phaseDur = 0;
  x = 0;
  z = 0;
  h = 0;
  moving = false;
  walk = 0; // fase del ciclo de marcha (rad)
  gate = 1;
  station = -1;
  spot = { x: 0, z: 0, rot: Math.PI };
  /** marca de inicio por fase (s desde el inicio del recorrido) */
  private marks: { phase: TourPhase; t0: number; t1: number; path?: Pt[] }[] = [];
  private sim: GemeloSim | null = null;

  chapter: TourChapter = 1;
  /** Parte 5: Ana (0) y Camilo (1) */
  guests: Walker[] = [
    { x: 0, z: 0, h: 0, walk: 0, moving: false, on: false },
    { x: 0, z: 0, h: 0, walk: 0, moving: false, on: false },
  ];
  /** torniquete que abre el PIN (el más cercano al puesto de ingreso) */
  gate2 = 0;
  private gpaths: Partial<Record<TourPhase, { i: number; p: Pt[] }>> = {};
  /** inicio del ciclo del curl (s del recorrido); se alinea con el maniquí cuando éste carga */
  curl0 = 0;
  /** pausa el recorrido (p. ej. mientras carga el maniquí 3D de la lección) */
  hold = false;
  private dur = DUR;
  start(sim: GemeloSim, opts: { compact?: boolean; chapter?: TourChapter } = {}) {
    this.stop();
    this.chapter = opts.chapter === 2 || opts.chapter === 3 || opts.chapter === 4 || opts.chapter === 5 ? opts.chapter : 1;
    this.dur = this.chapter === 2 ? DUR2 : this.chapter === 3 ? DUR3 : this.chapter === 4 ? DUR4 : this.chapter === 5 ? DUR5 : opts.compact ? DUR_FAST : DUR;
    this.guests.forEach((w) => (w.on = false));
    (this as any)._paid = false;
    this.gpaths = {};
    const D = this.dur;
    this.sim = sim;
    const L = sim.layout;
    const m = L.mirror;
    this.gate = Math.min(1, L.gates.length - 1);
    const g = L.gates[this.gate];
    sim.reserveGate(this.gate);
    // Zona de mancuernas más cercana a los torniquetes: se ubica en el piso libre junto al rack
    let best = -1;
    let bd = 1e9;
    L.stations.forEach((s, i) => {
      if (s.kind !== "mancuernas") return;
      const d = Math.hypot(s.x - g.x, s.z - g.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    this.station = best;
    this.spot = { x: -5 * m, z: 3.6, rot: Math.PI };
    if (best >= 0) {
      const s0 = L.stations[best];
      for (const dx of [-1.65, 1.65, -3.3, 3.3]) {
        const x = s0.x + dx;
        if (L.stations.every((o) => Math.hypot(o.x - x, o.z - s0.z) > 1.2)) {
          this.spot = { x, z: s0.z, rot: s0.rot };
          break;
        }
      }
    }
    const rx = L.reception.x;
    const rz = L.reception.z;
    const counter: Pt = { x: rx + 1.0 * m, z: rz + 1.45 };
    const walkIn: Pt[] = [
      { x: (opts.compact ? 3.4 : 4.6) * m, z: 15.3 },
      { x: 1.2 * m, z: 14.6 },
      { x: 0.4 * m, z: 13.0 },
      { x: rx + 1.6 * m, z: rz + 1.9 },
      counter,
    ];
    const toGate: Pt[] = [counter, { x: g.x, z: g.z + 2.2 }, { x: g.x, z: g.z + 1.15 }];
    const st = this.spot;
    const enter: Pt[] = [
      { x: g.x, z: g.z + 1.15 },
      { x: g.x, z: g.z - 1.3 },
      { x: st.x, z: st.z + 1.2 },
      { x: st.x, z: st.z },
    ];
    let t = 0;
    const push = (phase: TourPhase, dur: number, path?: Pt[]) => {
      this.marks.push({ phase, t0: t, t1: t + dur, path });
      t += dur;
    };
    if (this.chapter === 3) {
      // Parte 3: saca una bebida de la nevera, la cajera la escanea con la pistola, cobra, factura paso a paso,
      // cuadra inventario, pide al proveedor y cierra caja.
      const fr = fridgeSpot(L);
      const toFridge: Pt[] = [
        { x: 0.6 * m, z: 14.2 },
        { x: rx + 1.6 * m, z: rz + 2.2 },
        { x: rx - 1.5 * m, z: rz + 2.1 },
        { x: fr.standX, z: fr.standZ },
      ];
      const c3: Pt = { x: rx + 1.0 * m, z: rz + 1.0 };
      const toCounter: Pt[] = [{ x: fr.standX, z: fr.standZ }, { x: rx - 1.5 * m, z: rz + 1.9 }, { x: c3.x - 0.5 * m, z: rz + 1.5 }, c3];
      this.h = -Math.PI / 2 * m;
      push("to_fridge", pathLen(toFridge) / WALK, toFridge);
      push("fridge", D.fridge);
      push("to_counter", pathLen(toCounter) / WALK, toCounter);
      push("scan", D.scan);
      for (const p of ["pos", "fact", "cliente", "items", "dian", "files", "stock", "order", "close"] as TourPhase[]) push(p, D[p]);
      push("desk_end", 1e9);
      // la recepcionista de la simulación cede su puesto a la cajera del recorrido
      const staff = sim.members.find((mm) => mm.phase === "staff");
      if (staff) staff.x = 900;
      this.active = true;
      this.t = 0;
      this.walk = 0;
      this.update(0);
      return;
    }
    if (this.chapter === 5) {
      // Parte 5: Valentina invita a Ana (entra por rostro) y a Camilo, sin celular (entra con el PIN de respaldo en /ingreso).
      const S = pinStand(L);
      let pg = 0;
      L.gates.forEach((gg, i) => {
        if (Math.abs(gg.x - S.x) < Math.abs(L.gates[pg].x - S.x)) pg = i;
      });
      this.gate2 = pg;
      const g2 = L.gates[pg];
      const V0 = { x: g.x + 0.9 * m, z: g.z + 5.0 };
      const A0 = { x: g.x + 1.7 * m, z: g.z + 5.5 };
      const C0 = { x: g.x + 0.1 * m, z: g.z + 5.7 };
      this.x = V0.x;
      this.z = V0.z;
      this.h = Math.PI;
      const [ana, cam] = this.guests;
      Object.assign(ana, { x: A0.x, z: A0.z, h: Math.PI + 0.3 * m, walk: 0, moving: false, on: true });
      Object.assign(cam, { x: C0.x, z: C0.z, h: Math.PI - 0.3 * m, walk: 0, moving: false, on: true });
      const anaGate: Pt[] = [A0, { x: g.x, z: g.z + 2.2 }, { x: g.x, z: g.z + 1.15 }];
      const anaIn: Pt[] = [{ x: g.x, z: g.z + 1.15 }, { x: g.x, z: g.z - 1.3 }, { x: g.x + 0.7 * m, z: g.z - 3.2 }];
      const toPin: Pt[] = [C0, { x: S.x + 0.5 * m, z: S.z + 1.6 }, { x: S.x, z: S.z + 0.75 }];
      const camIn: Pt[] = [{ x: S.x, z: S.z + 0.75 }, { x: g2.x, z: g2.z + 1.2 }, { x: g2.x, z: g2.z - 1.3 }, { x: g2.x - 0.6 * m, z: g2.z - 3.4 }];
      push("invite", D.invite);
      push("guest_enroll", D.guest_enroll);
      this.gpaths.ana_gate = { i: 0, p: anaGate };
      push("ana_gate", pathLen(anaGate) / WALK);
      push("gate_g", D.gate_g);
      this.gpaths.ana_in = { i: 0, p: anaIn };
      push("ana_in", pathLen(anaIn) / WALK + 1.2);
      push("invite2", D.invite2);
      this.gpaths.to_pin = { i: 1, p: toPin };
      push("to_pin", pathLen(toPin) / WALK);
      push("pin", D.pin);
      this.gpaths.camilo_in = { i: 1, p: camIn };
      push("camilo_in", pathLen(camIn) / WALK + 0.8);
      push("ledger", D.ledger);
      push("g_end", 1e9);
      this.active = true;
      this.t = 0;
      this.walk = 0;
      this.update(0);
      return;
    }
    if (this.chapter === 4) {
      // Parte 4: le llega el aviso por WhatsApp, días después la puerta la rechaza, entra a la app
      // (documento + WhatsApp + código), paga el plan con Wompi (simulado) y vuelve a entrar.
      const start: Pt = { x: g.x + 0.9 * m, z: g.z + 6.6 };
      const arrive: Pt[] = [start, { x: g.x, z: g.z + 2.2 }, { x: g.x, z: g.z + 1.15 }];
      const c4: Pt = { x: g.x + 0.9 * m, z: g.z + 2.9 };
      const toRecep: Pt[] = [{ x: g.x, z: g.z + 1.15 }, { x: g.x + 0.3 * m, z: g.z + 2.2 }, c4];
      const back: Pt[] = [c4, { x: g.x, z: g.z + 2.2 }, { x: g.x, z: g.z + 1.15 }];
      this.x = start.x;
      this.z = start.z;
      this.h = Math.PI;
      push("aviso", D.aviso);
      push("to_gate", pathLen(arrive) / WALK, arrive);
      push("gate_deny", D.gate_deny);
      push("to_recep", pathLen(toRecep) / WALK, toRecep);
      push("accesos", D.accesos);
      push("login", D.login);
      push("wompi", D.wompi);
      push("back_gate", pathLen(back) / WALK, back);
      push("gate", D.gate);
      push("enter", pathLen(enter) / WALK, enter);
      push("training", 1e9);
      this.curl0 = this.startOf("training");
      this.active = true;
      this.t = 0;
      this.walk = 0;
      this.update(0);
      return;
    }
    if (this.chapter === 2) {
      // Parte 2: ya es socia. Llega por la entrada, pasa con su rostro y va a su zona.
      const arrive: Pt[] = [{ x: g.x + 0.9 * m, z: g.z + 6.6 }, { x: g.x, z: g.z + 2.2 }, { x: g.x, z: g.z + 1.15 }];
      this.h = Math.PI;
      push("to_gate", pathLen(arrive) / WALK, arrive);
      push("gate", D.gate);
      push("enter", pathLen(enter) / WALK, enter);
      push("app", D.app);
      push("train", D.train);
      push("coach", D.coach);
      push("food", D.food);
      push("training", 1e9);
      this.curl0 = this.startOf("train");
      this.active = true;
      this.t = 0;
      this.walk = 0;
      this.update(0);
      return;
    }
    push("walk_in", pathLen(walkIn) / WALK, walkIn);
    push("form", D.form);
    push("registered", D.registered);
    push("plan", D.plan);
    push("phone", D.phone);
    push("enrolled", D.enrolled);
    push("to_gate", pathLen(toGate) / WALK, toGate);
    push("gate", D.gate);
    push("enter", pathLen(enter) / WALK, enter);
    push("training", 1e9);
    this.curl0 = this.startOf("training");
    this.active = true;
    this.t = 0;
    this.walk = 0;
    this.update(0);
  }

  stop() {
    if (this.sim) {
      this.sim.reserveGate(-1);
      const staff = this.sim.members.find((mm) => mm.phase === "staff");
      if (staff) staff.x = this.sim.layout.reception.x;
    }
    this.active = false;
    this.hold = false;
    this.guests.forEach((w) => (w.on = false));
    this.phase = "off";
    this.marks = [];
    this.station = -1;
  }

  /** inicio (s) de una fase, para coreografía de cámara y del comercial */
  startOf(p: TourPhase): number {
    return this.marks.find((mk) => mk.phase === p)?.t0 ?? 0;
  }

  step(dt: number) {
    if (!this.active || this.hold) return;
    this.update(dt);
  }

  private update(dt: number) {
    this.t += dt;
    const mk = this.marks.find((k) => this.t < k.t1) || this.marks[this.marks.length - 1];
    this.phase = mk.phase;
    this.phaseT = this.t - mk.t0;
    this.phaseDur = mk.t1 - mk.t0;
    // invitados de la Parte 5: caminan por su propia ruta en ciertas fases
    for (const w of this.guests) w.moving = false;
    const gp = this.gpaths[mk.phase];
    if (gp) {
      const w = this.guests[gp.i];
      const len = pathLen(gp.p);
      const d = Math.min(len, this.phaseT * WALK);
      const p = along(gp.p, d);
      w.x = p.x;
      w.z = p.z;
      let dh = p.h - w.h;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      w.h += dh * Math.min(1, dt * 7 + (dt === 0 ? 1 : 0));
      w.moving = d < len - 0.02;
      if (w.moving) w.walk += dt * (WALK / 1.32) * Math.PI * 2;
    }
    for (const w of this.guests) {
      if (w.moving) continue;
      const r = w.walk % Math.PI;
      if (r > 0.05) w.walk += Math.min(Math.PI - r, dt * 6);
    }
    const sim = this.sim!;
    const L = sim.layout;
    const g = L.gates[this.gate];
    this.moving = false;
    if (mk.path) {
      const p = along(mk.path, this.phaseT * WALK);
      this.x = p.x;
      this.z = p.z;
      // giro suave
      let dh = p.h - this.h;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.h += dh * Math.min(1, dt * 7 + (dt === 0 ? 1 : 0));
      this.moving = this.phaseT < this.phaseDur - 0.02;
      if (this.moving) this.walk += dt * (WALK / 1.32) * Math.PI * 2;
    } else {
      // de frente al mostrador / torniquete / equipo
      let want = Math.PI;
      if (this.phase === "training" || this.phase === "app" || this.phase === "train" || this.phase === "coach" || this.phase === "food") want = this.spot.rot;
      let dh = want - this.h;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.h += dh * Math.min(1, dt * 5);
      // termina la zancada con suavidad
      const r = this.walk % Math.PI;
      if (r > 0.05) this.walk += Math.min(Math.PI - r, dt * 6);
    }
    // puerta: reconoce y abre
    if (this.phase === "gate") {
      g.busy = true;
      if (this.nt >= 0.95) {
        if (g.flash <= 0 || !(g as any)._tour) {
          g.flash = 1.1;
          g.flashOk = true;
          (g as any)._tour = 1;
          sim.stats.accesosOk++;
          sim.emit({ kind: "ok", name: TOUR_PERSON.first + " R.", detail: `Acceso facial · ${TOUR_PERSON.plan} · 30 días`, x: g.x, z: g.z, member: -3 });
        }
        g.open = 1.6;
      }
    } else if (this.phase === "gate_deny") {
      // reconoce el rostro, pero la membresía está vencida: luz roja, el vidrio no abre
      g.busy = true;
      if (this.phaseT >= 1.2 && !(g as any)._deny) {
        (g as any)._deny = 1;
        g.flash = 1.1;
        g.flashOk = false;
        sim.emit({ kind: "deny", name: TOUR_PERSON.first + " R.", detail: "Membresía vencida o sin plan", x: g.x, z: g.z, member: -3 });
      }
      if (this.phaseT >= 1.2 && this.phaseT < 4.6) g.flash = Math.max(g.flash, 0.5);
    } else if (this.phase === "gate_g") {
      g.busy = true;
      if (this.nt >= 0.95) {
        if (!(g as any)._g) {
          (g as any)._g = 1;
          g.flash = 1.1;
          g.flashOk = true;
          sim.stats.accesosOk++;
          sim.emit({ kind: "ok", name: GUESTS[0].first + " T.", detail: `Invitada de ${TOUR_PERSON.first} R. · acceso facial`, x: g.x, z: g.z, member: -3 });
        }
        g.open = 1.6;
      }
    } else if (this.phase === "ana_in") {
      if (this.phaseT < 1.7) g.open = Math.max(g.open, 0.6);
      else g.busy = false;
      delete (g as any)._g;
    } else if (this.phase === "pin" || this.phase === "camilo_in") {
      const g2 = L.gates[this.gate2];
      if (this.phase === "pin" && this.phaseT >= 3.2) {
        g2.busy = true;
        if (!(g2 as any)._pin) {
          (g2 as any)._pin = 1;
          g2.flash = 1.1;
          g2.flashOk = true;
          sim.emit({ kind: "ok", name: GUESTS[1].first + " P.", detail: `Invitado de ${TOUR_PERSON.first} R. · PIN de respaldo`, x: g2.x, z: g2.z, member: -3 });
        }
        g2.open = 1.6;
      }
      if (this.phase === "camilo_in") {
        if (this.phaseT < 2.6) g2.open = Math.max(g2.open, 0.6);
        else {
          g2.busy = false;
          delete (g2 as any)._pin;
        }
      }
    } else if (this.phase === "to_recep") {
      g.busy = false;
    } else if (this.phase === "wompi" && this.chapter === 4) {
      if (this.phaseT >= 7.0 && !(this as any)._paid) {
        (this as any)._paid = true;
        sim.emit({ kind: "renew", name: TOUR_PERSON.first + " R.", detail: "Pago Wompi desde la app · Mensual", amount: 120000, x: this.x, z: this.z, member: -3 });
      }
    } else if (this.phase === "enter") {
      if (this.phaseT < 1.7) g.open = Math.max(g.open, 0.6);
      else g.busy = false;
      delete (g as any)._tour;
      delete (g as any)._deny;
    }
  }

  /** tiempo "nominal" dentro de la fase (las pantallas usan la escala de la versión normal) */
  get nt() {
    if (this.chapter !== 1) return this.phaseT;
    const nom = DUR[this.phase];
    const cur = this.dur[this.phase];
    return nom && cur ? this.phaseT * (nom / cur) : this.phaseT;
  }

  /** 0..1 dentro de la fase actual */
  get k() {
    return this.phaseDur > 0 ? Math.min(1, this.phaseT / this.phaseDur) : 1;
  }

  /** Estado de la tablet del torniquete del recorrido */
  /** a quién sigue la cámara en la Parte 5 */
  get focus(): { x: number; z: number } {
    if (this.chapter === 5) {
      const ph = this.phase;
      if (ph === "guest_enroll" || ph === "ana_gate" || ph === "gate_g" || ph === "ana_in") return this.guests[0];
      if (ph === "to_pin" || ph === "pin" || ph === "camilo_in") return this.guests[1];
    }
    return this;
  }

  get tablet(): "idle" | "scan" | "ok" | "deny" | "okg" {
    if (!this.active) return "idle";
    if (this.phase === "gate_deny") return this.phaseT < 1.2 ? "scan" : "deny";
    if (this.phase === "gate_g") return this.nt < 0.95 ? "scan" : "okg";
    if (this.phase === "ana_in" && this.phaseT < 1.6) return "okg";
    if (this.phase === "ana_gate" && this.phaseDur - this.phaseT < 0.9) return "scan";
    if (this.phase === "back_gate" && this.phaseDur - this.phaseT < 0.9) return "scan";
    if (this.phase === "gate") return this.nt < 0.95 ? "scan" : "ok";
    if (this.phase === "enter" && this.phaseT < 1.6) return "ok";
    if (this.phase === "to_gate" && this.phaseDur - this.phaseT < 0.9) return "scan";
    return "idle";
  }
}
