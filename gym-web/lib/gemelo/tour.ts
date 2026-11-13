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
  | "training";

/** Capítulos del recorrido: 1 = Inscripción, 2 = Entrenamiento (rutina en la app, maniquí 3D, Motion Studio, valoración y nutrición). */
export type TourChapter = 1 | 2;

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
  private dur = DUR;
  start(sim: GemeloSim, opts: { compact?: boolean; chapter?: TourChapter } = {}) {
    this.stop();
    this.chapter = opts.chapter === 2 ? 2 : 1;
    this.dur = this.chapter === 2 ? DUR2 : opts.compact ? DUR_FAST : DUR;
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
    this.active = true;
    this.t = 0;
    this.walk = 0;
    this.update(0);
  }

  stop() {
    if (this.sim) {
      this.sim.reserveGate(-1);
    }
    this.active = false;
    this.phase = "off";
    this.marks = [];
    this.station = -1;
  }

  /** inicio (s) de una fase, para coreografía de cámara y del comercial */
  startOf(p: TourPhase): number {
    return this.marks.find((mk) => mk.phase === p)?.t0 ?? 0;
  }

  step(dt: number) {
    if (!this.active) return;
    this.update(dt);
  }

  private update(dt: number) {
    this.t += dt;
    const mk = this.marks.find((k) => this.t < k.t1) || this.marks[this.marks.length - 1];
    this.phase = mk.phase;
    this.phaseT = this.t - mk.t0;
    this.phaseDur = mk.t1 - mk.t0;
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
    } else if (this.phase === "enter") {
      if (this.phaseT < 1.7) g.open = Math.max(g.open, 0.6);
      else g.busy = false;
      delete (g as any)._tour;
    }
  }

  /** tiempo "nominal" dentro de la fase (las pantallas usan la escala de la versión normal) */
  get nt() {
    if (this.chapter === 2) return this.phaseT;
    const nom = DUR[this.phase];
    const cur = this.dur[this.phase];
    return nom && cur ? this.phaseT * (nom / cur) : this.phaseT;
  }

  /** 0..1 dentro de la fase actual */
  get k() {
    return this.phaseDur > 0 ? Math.min(1, this.phaseT / this.phaseDur) : 1;
  }

  /** Estado de la tablet del torniquete del recorrido */
  get tablet(): "idle" | "scan" | "ok" {
    if (!this.active) return "idle";
    if (this.phase === "gate") return this.nt < 0.95 ? "scan" : "ok";
    if (this.phase === "enter" && this.phaseT < 1.6) return "ok";
    if (this.phase === "to_gate" && this.phaseDur - this.phaseT < 0.9) return "scan";
    return "idle";
  }
}
