"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GemeloSim, SEDES, formatClock, formatCOP, type SimEvent, type Stats } from "../../lib/gemelo/sim";
import { WorldCtrl, type CamPreset } from "../../lib/gemelo/ctrl";

// three.js solo se descarga en esta ruta y solo en el cliente.
const World3D = dynamic(() => import("./World3D"), {
  ssr: false,
  loading: () => <div className="gm-loading"><span />Cargando gemelo 3D…</div>,
});

type Caption = { id: number; lines: string[]; pos: "top" | "center" | "bottom" | "phone"; accent: number; born: number; size: number };

function useRaf(cb: (now: number) => void, on = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!on) return;
    let id = 0;
    const loop = (t: number) => {
      ref.current(t);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [on]);
}

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const el = useRef<HTMLSpanElement>(null);
  const cur = useRef(value);
  useRaf(() => {
    const d = value - cur.current;
    if (Math.abs(d) < 0.5) cur.current = value;
    else cur.current += d * 0.12;
    if (el.current) el.current.textContent = format(cur.current);
  });
  return <span ref={el}>{format(value)}</span>;
}

const fmtInt = (n: number) => Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");

/* ---------- Datos demo para el tablero (deterministas) ---------- */
function seeded(i: number) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
/* Cifras de la sede Norte del gemelo, mismas que la Parte 6 (Dashboard y Reportes del panel). */
const MEDIOS = [
  { name: "Efectivo", v: 1164000, c: "#38BDF8" },
  { name: "Wompi", v: 1080000, c: "#A78BFA" },
  { name: "Tarjeta", v: 696000, c: "#A3E635" },
  { name: "Transferencia", v: 240000, c: "#FBBF24" },
];
const RECHAZOS = [
  { name: "Identidad desconocida", v: 4 },
  { name: "Membresía", v: 4 },
  { name: "Prueba de vida", v: 1 },
];
const HABILITADOS = [487, 608, 414];
const POR_VENCER = [
  { n: "Mariana P.", p: "Mensual", d: 1 },
  { n: "Sebastián R.", p: "Trimestral", d: 2 },
  { n: "Laura G.", p: "Mensual", d: 2 },
  { n: "Tomás M.", p: "Trimestral", d: 4 },
  { n: "Catalina V.", p: "Anual", d: 5 },
];

const TOUR_STEPS = [
  { l: "Llega", p: ["walk_in"] },
  { l: "Ficha en Clientes", p: ["form", "registered"] },
  { l: "Membresía", p: ["plan"] },
  { l: "Rostro desde su celular", p: ["phone", "enrolled"] },
  { l: "Entra con su rostro", p: ["to_gate", "gate"] },
  { l: "Rutina", p: ["enter", "training"] },
];

const TOUR_STEPS2 = [
  { l: "Entra con su rostro", p: ["to_gate", "gate", "enter"] },
  { l: "Su rutina en la app", p: ["app"] },
  { l: "Entrena", p: ["train"] },
  { l: "El entrenador", p: ["coach"] },
  { l: "Alimentación", p: ["food", "training"] },
];

const TOUR_STEPS3 = [
  { l: "Saca la bebida de la nevera", p: ["to_fridge", "fridge"] },
  { l: "La cajera la escanea", p: ["to_counter", "scan"] },
  { l: "Venta cobrada", p: ["pos"] },
  { l: "¿Desea factura?", p: ["fact"] },
  { l: "Datos del cliente", p: ["cliente"] },
  { l: "Ítems e IVA", p: ["items"] },
  { l: "Envío a la DIAN", p: ["dian"] },
  { l: "XML y PDF", p: ["files"] },
  { l: "Inventario", p: ["stock"] },
  { l: "Pedido al proveedor", p: ["order"] },
  { l: "Cierre de caja", p: ["close", "desk_end"] },
];

const TOUR_STEPS4 = [
  { l: "Aviso por WhatsApp", p: ["aviso"] },
  { l: "La puerta la rechaza", p: ["to_gate", "gate_deny"] },
  { l: "Accesos lo registra", p: ["to_recep", "accesos"] },
  { l: "Entra a la app", p: ["login"] },
  { l: "Paga con Wompi", p: ["wompi"] },
  { l: "Vuelve a entrar", p: ["back_gate", "gate", "enter", "training"] },
];
const TOUR_STEPS6 = [
  { l: "Vista aérea de la sede", p: ["own_aerial"] },
  { l: "Centro de operaciones", p: ["own_dash"] },
  { l: "Cambia de sede", p: ["own_sede"] },
  { l: "Reportes y gastos", p: ["own_rep"] },
  { l: "Desde el celular", p: ["own_phone", "own_end"] },
];
const TOUR_STEPS5 = [
  { l: "Valentina invita a Ana", p: ["invite"] },
  { l: "Ana registra su rostro", p: ["guest_enroll"] },
  { l: "Entra por rostro", p: ["ana_gate", "gate_g", "ana_in"] },
  { l: "Invita a Camilo", p: ["invite2"] },
  { l: "PIN en /ingreso", p: ["to_pin", "pin", "camilo_in"] },
  { l: "Registro de invitados", p: ["ledger", "g_end"] },
];

const AREAS = [
  {
    k: "01",
    t: "Operación",
    d: "La recepción deja de ser un cuello de botella. Cada entrada se valida sola y la caja cuadra al final del día.",
    items: ["Control de acceso: torniquetes con reconocimiento facial", "Recepción y caja (POS)", "Historial de accesos", "Inventario y proveedores"],
    c: "#38BDF8",
  },
  {
    k: "02",
    t: "Gimnasio",
    d: "El entrenamiento también se gestiona: rutinas por socio, ejercicios en 3D y seguimiento de progreso.",
    items: ["Rutinas con versiones y asignación", "Biblioteca de ejercicios con maniquí 3D", "Valoraciones físicas", "Planes de nutrición"],
    c: "#A78BFA",
  },
  {
    k: "03",
    t: "Finanzas",
    d: "Sabes cuánto entra, cuánto sale y qué membresías están a punto de irse, antes de que se vayan.",
    items: ["Membresías y planes", "Ventas y punto de venta", "Facturación electrónica DIAN", "Egresos y reportes"],
    c: "#A3E635",
  },
  {
    k: "04",
    t: "Sistema",
    d: "Una sola plataforma para tus sedes: cambias de sede desde el encabezado, cada usuario con su rol y su alcance.",
    items: ["Varias sedes, una a la vez", "Usuarios con rol por sede", "Avisos de vencimiento por WhatsApp", "Respaldo descargable de la sede"],
    c: "#FBBF24",
  },
  {
    k: "05",
    t: "Experiencia del socio",
    d: "Tu gimnasio en el bolsillo de cada socio: su membresía, su rutina y sus pagos en el celular. En la puerta entra con su rostro.",
    items: ["App móvil del socio", "Ingreso con el rostro · invitados con PIN de un uso", "Rutina del día en el celular", "Pago con Wompi e invitaciones desde la app"],
    c: "#F472B6",
  },
];

/* ---------- Componentes de tablero ---------- */

function MediosBars() {
  const max = Math.max(...MEDIOS.map((m) => m.v));
  return (
    <div className="flex flex-col gap-2.5">
      {MEDIOS.map((m) => (
        <div key={m.name} className="grid grid-cols-[96px_1fr_92px] items-center gap-3 text-xs">
          <span className="font-semibold text-gym-muted">{m.name}</span>
          <span className="h-3 rounded-full bg-[#1E2A44]"><i className="block h-3 rounded-full" style={{ width: `${(m.v / max) * 100}%`, background: m.c }} /></span>
          <b className="text-right text-white">{formatCOP(m.v)}</b>
        </div>
      ))}
    </div>
  );
}

/* ---------- Página ---------- */

export default function GemeloLanding({ contactUrl }: { contactUrl: string }) {
  const sim = useMemo(() => new GemeloSim(0), []);
  const ctrl = useMemo(() => new WorldCtrl(sim), [sim]);
  const [sede, setSede] = useState(0);
  const [version, setVersion] = useState(0);
  const [full, setFull] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [stats, setStats] = useState<Stats>(() => ({ ...sim.stats }));
  const [clock, setClock] = useState(sim.t);
  const [feed, setFeed] = useState<SimEvent[]>([]);
    const [selected, setSelected] = useState(-1);
  const [tourPhase, setTourPhase] = useState<string>("off");
  const [reduced, setReduced] = useState(false);
  const [webgl, setWebgl] = useState(true);
  const [want3d, setWant3d] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const [preset, setPreset] = useState<CamPreset>("hero");
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [flash, setFlash] = useState(0);
  const [capture, setCapture] = useState(false);
  const [ad, setAd] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const capEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const flashEl = useRef<HTMLDivElement>(null);
  const scrollAnim = useRef<{ from: number; to: number; t0: number; dur: number } | null>(null);

  // Entorno: reduced-motion, WebGL, modo captura
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const cap = q.get("capture") === "1";
    setCapture(cap);
    setAd(q.get("ad") === "1");
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const red = mq.matches && !cap;
    setReduced(red);
    ctrl.reduced = red;
    if (red) sim.speed = 1;
    if (red) setSpeed(1);
    let ok = false;
    try {
      const c = document.createElement("canvas");
      ok = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      ok = false;
    }
    setWebgl(ok);
    setWant3d(ok && !red);
  }, [ctrl, sim]);

  // Pausa: pestaña oculta / canvas fuera de pantalla
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const io = new IntersectionObserver((ents) => setOnScreen(ents[0]?.isIntersecting ?? true), { threshold: 0.02 });
    if (slotRef.current) io.observe(slotRef.current);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      io.disconnect();
    };
  }, []);

  const running3d = want3d && webgl && tabVisible && (onScreen || full);

  // Si el 3D no corre, la simulación sigue barata para que los números vivan.
  useEffect(() => {
    if (running3d || !tabVisible) return;
    const id = setInterval(() => sim.step(0.25), 250);
    return () => clearInterval(id);
  }, [running3d, tabVisible, sim]);

  // Instantánea para la UI (4 Hz)
  useEffect(() => {
    const id = setInterval(() => {
      setStats({ ...sim.stats });
      setClock(sim.t);
      setFeed(sim.events.slice(-6).reverse());
      setTourPhase(ctrl.tour.active ? ctrl.tour.phase : "off");
    }, 250);
    return () => clearInterval(id);
  }, [sim]);

  // Revelado ligado al scroll (determinista) + scroll animado
  useRaf((now) => {
    const sa = scrollAnim.current;
    if (sa) {
      const k = Math.min(1, (now - sa.t0) / sa.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      window.scrollTo(0, sa.from + (sa.to - sa.from) * e);
      if (k >= 1) scrollAnim.current = null;
    }
    if (!reduced) {
      const vh = window.innerHeight;
      document.querySelectorAll<HTMLElement>("[data-rv]").forEach((el) => {
        const r = el.getBoundingClientRect();
        const delay = Number(el.dataset.rv || 0);
        const p = Math.max(0, Math.min(1, (vh * 0.98 - r.top) / (vh * 0.28) - delay));
        const e = 1 - Math.pow(1 - p, 3);
        el.style.opacity = String(e);
        el.style.transform = `translate3d(0, ${(1 - e) * 46}px, 0) scale(${0.96 + e * 0.04})`;
      });
    }
    // Captions cinéticos
    for (const c of captions) {
      const el = capEls.current.get(c.id);
      if (!el) continue;
      const age = (now - c.born) / 1000;
      el.querySelectorAll<HTMLElement>(".gm-cap-w").forEach((w, i) => {
        const a = Math.max(0, Math.min(1, (age - i * 0.06) / 0.38));
        const e = 1 - Math.pow(1 - a, 4);
        w.style.opacity = String(e);
        w.style.transform = `translate3d(0, ${(1 - e) * 0.9}em, 0) rotate(${(1 - e) * 4}deg)`;
        w.style.filter = e > 0.995 || w.parentElement?.classList.contains("gm-cap-acc") ? "none" : `blur(${(1 - e) * 8}px)`;
      });
    }
    if (flashEl.current) {
      const age = (now - flash) / 1000;
      flashEl.current.style.opacity = flash ? String(Math.max(0, 1 - age / 0.45)) : "0";
    }
  });

  const enter = useCallback(() => {
    if (!webgl) return;
    setWant3d(true);
    setFull(true);
    ctrl.fullscreen = true;
    ctrl.go("general", 1.2);
    setPreset("general");
    document.documentElement.style.overflow = "hidden";
  }, [ctrl, webgl]);
  const exit = useCallback(() => {
    if (ctrl.tour.active) {
      ctrl.stopTour();
      sim.speed = speedBeforeTour.current;
      setSpeed(sim.speed);
    }
    ctrl.zoom = 1;
    setFull(false);
    ctrl.fullscreen = false;
    ctrl.selected = -1;
    setSelected(-1);
    ctrl.go("hero", 0.9);
    setPreset("hero");
    document.documentElement.style.overflow = "";
  }, [ctrl]);
  const speedBeforeTour = useRef(10);
  const startTour = useCallback((compact?: boolean, chapter: 1 | 2 | 3 | 4 | 5 | 6 = 1) => {
    if (!webgl) return;
    setWant3d(true);
    setFull(true);
    ctrl.fullscreen = true;
    document.documentElement.style.overflow = "hidden";
    if (!ctrl.tour.active) speedBeforeTour.current = sim.speed;
    sim.speed = 1;
    setSpeed(1);
    ctrl.zoom = 1;
    ctrl.startTour(compact === true, chapter);
    if (compact === true) ctrl.go("tour", 0.0001);
    setTourPhase(chapter === 2 ? "to_gate" : chapter === 3 ? "to_fridge" : chapter === 4 ? "aviso" : chapter === 5 ? "invite" : chapter === 6 ? "own_aerial" : "walk_in");
    setSelected(-1);
    setPreset("tour");
  }, [ctrl, sim, webgl]);
  const stopTour = useCallback(() => {
    ctrl.stopTour();
    sim.speed = speedBeforeTour.current;
    setSpeed(sim.speed);
    ctrl.go("general", 1.2);
    setPreset("general");
  }, [ctrl, sim]);
  const go = useCallback(
    (p: CamPreset, dur = 1.1) => {
      if (p === "tour") return startTour();
      if (ctrl.tour.active) {
        ctrl.stopTour();
        sim.speed = speedBeforeTour.current;
        setSpeed(sim.speed);
      }
      if (p === "follow") {
        const id = ctrl.selected >= 0 && sim.members[ctrl.selected].phase !== "fuera" ? ctrl.selected : sim.nextAtGate();
        ctrl.followMember(id, dur);
        setSelected(id);
      } else ctrl.go(p, dur);
      setPreset(p);
    },
    [ctrl, sim, startTour],
  );
  const pick = useCallback(
    (id: number) => {
      ctrl.selected = id;
      setSelected(id);
      if (id < 0 && ctrl.preset === "follow") {
        ctrl.go("general", 1);
        setPreset("general");
      }
    },
    [ctrl],
  );
  const changeSpeed = useCallback((s: number) => {
    sim.speed = s;
    setSpeed(s);
  }, [sim]);
  const changeSede = useCallback(
    (i: number) => {
      sim.setSede(i);
      setSede(i);
      setVersion((v) => v + 1);
      ctrl.selected = -1;
      setSelected(-1);
      setFlash(performance.now());
      if (ctrl.preset === "follow") {
        ctrl.go("general", 0.001);
        setPreset("general");
      }
    },
    [sim, ctrl],
  );

  // API para el guion del video (solo con ?capture=1)
  useEffect(() => {
    if (!capture) return;
    let capSeq = 0;
    (window as any).__gemelo = {
      sim,
      ctrl,
      enter,
      exit,
      go,
      tour: (compact = true, chapter: 1 | 2 | 3 | 4 | 5 | 6 = 1) => startTour(compact, chapter),
      tourStop: () => stopTour(),
      tourT: () => ctrl.tour.t,
      tourStartOf: (p: string) => ctrl.tour.startOf(p as any),
      zoom: (z: number) => (ctrl.zoom = z),
      cut: (p: CamPreset) => go(p, 0.0001),
      follow: (what: number | "gate" | "pesas" | "cardio" | "funcional", dur = 1) => {
        const id = typeof what === "number" ? what : what === "gate" ? sim.nextAtGate() : sim.trainingIn(what);
        ctrl.followMember(id, dur);
        setSelected(id);
        setPreset("follow");
        return id;
      },
      select: (id: number) => pick(id),
      speed: changeSpeed,
      sede: changeSede,
      denyNext: () => (sim.forceDenyNext = true),
      denyAtGate: (gi = 1) => {
        // Socio con membresía vencida al frente del carril gi (guion del comercial)
        const g = sim.layout.gates[gi];
        let best = g.queue.find((id) => sim.members[id].phase === "fila") ?? -1;
        if (best < 0) {
          let bd = 1e9;
          for (const m of sim.members) {
            if (m.phase !== "llegando" && m.phase !== "fila") continue;
            const d = Math.hypot(m.x - g.x, m.z - g.z);
            if (d < bd) {
              bd = d;
              best = m.id;
            }
          }
        }
        if (best < 0) best = sim.nextAtGate();
        const m = sim.members[best];
        if (m) {
          if (m.phase !== "fila" || m.gate !== gi) {
            for (const gg of sim.layout.gates) gg.queue = gg.queue.filter((x) => x !== best);
            m.phase = "fila";
            m.gate = gi;
            m.x = g.x;
            m.z = g.z + 2.3;
            m.h = Math.PI;
            m.path = [];
            g.queue.unshift(best);
          }
          m.vencida = true;
          m.willRenew = true;
        }
        return best;
      },
      stats: () => ({ ...sim.stats }),
      caption: (lines: string[], opts: { pos?: Caption["pos"]; accent?: number; size?: number } = {}) => {
        const c: Caption = { id: ++capSeq, lines, pos: opts.pos || "top", accent: opts.accent ?? lines.length - 1, born: performance.now(), size: opts.size || 1 };
        setCaptions([c]);
      },
      clearCaption: () => setCaptions([]),
      scrollTo: (target: string | number, dur = 900) => {
        const y = typeof target === "number" ? target : (document.querySelector(target) as HTMLElement | null)?.getBoundingClientRect().top! + window.scrollY;
        scrollAnim.current = { from: window.scrollY, to: y, t0: performance.now(), dur };
      },
      flash: () => setFlash(performance.now()),
    };
  }, [capture, sim, ctrl, enter, exit, go, pick, changeSpeed, changeSede, startTour, stopTour]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && full) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, exit]);

  const contact = contactUrl || "/login";
  const contactLabel = "Agenda una demo";
  const S = SEDES[sede];

  return (
    <main className={`gm-root ${capture ? "gm-capture" : ""} ${ad ? "gm-ad" : ""}`}>
      {/* Navegación */}
      <header className="gm-nav">
        <a href="#top" className="flex items-center gap-2">
          <img src="/brand/vx-horizontal-color.svg" alt="VISIONYX" className="h-7 w-auto" />
        </a>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-gym-muted md:flex">
          <a href="#mundo" className="hover:text-white">Gemelo 3D</a>
          <a href="#numeros" className="hover:text-white">Números</a>
          <a href="#modulos" className="hover:text-white">Módulos</a>
        </nav>
        <a href={contact} className="gm-btn-sm">{contactLabel}</a>
      </header>

      {/* HERO */}
      <section id="top" className="gm-hero">
        <div className="gm-hero-copy">
          <div className="gm-live"><span className="gm-live-dot" />En vivo · Gemelo digital · {S.name}</div>
          <h1 className="gm-h1">
            Cada socio<br />
            <span className="gm-grad">cuenta.</span>
          </h1>
          <p className="gm-sub">
            Tu gimnasio en un solo panel: cada intento de acceso en la puerta, las membresías que vencen y la caja de cada sede.
            <b className="text-white"> VISIONYX: inteligencia que conecta el mundo real.</b>
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={enter} className="gm-btn" disabled={!webgl}>
              Explorar en 3D <span aria-hidden>→</span>
            </button>
            <button onClick={() => startTour()} className="gm-btn-ghost gm-btn-tour" disabled={!webgl}>
              ▶ Ver inscripción
            </button>
            <button onClick={() => startTour(false, 2)} className="gm-btn-ghost gm-btn-tour" disabled={!webgl}>
              ▶ Ver entrenamiento
            </button>
            <button onClick={() => startTour(false, 3)} className="gm-btn-ghost gm-btn-tour" disabled={!webgl}>
              ▶ Ver caja y ventas
            </button>
            <button onClick={() => startTour(false, 4)} className="gm-btn-ghost gm-btn-tour" disabled={!webgl}>
              ▶ Ver membresía vencida
            </button>
            <button onClick={() => startTour(false, 5)} className="gm-btn-ghost gm-btn-tour" disabled={!webgl}>
              ▶ Ver invitados
            </button>
            <button onClick={() => startTour(false, 6)} className="gm-btn-ghost gm-btn-tour" disabled={!webgl}>
              ▶ Ver dueño
            </button>
            <a href={contact} className="gm-btn-ghost">{contactLabel}</a>
          </div>
          <div className="gm-widgets">
            <div className="gm-w">
              <div className="gm-w-l">Ventas cobradas · hoy</div>
              <div className="gm-w-v text-[#A3E635]"><AnimatedNumber value={stats.ingresosHoy} format={formatCOP} /></div>
              <div className="gm-w-s">{fmtInt(stats.renovaciones)} renovaciones · {fmtInt(stats.ventasPos)} ventas en caja</div>
            </div>
            <div className="gm-w">
              <div className="gm-w-l">Intentos de acceso</div>
              <div className="gm-w-v"><AnimatedNumber value={stats.accesosOk + stats.accesosNeg} format={fmtInt} /></div>
              <div className="gm-w-s"><span className="text-[#22E0A1]">{fmtInt(stats.accesosOk)} aprobados</span> · <span className="text-[#FF4D6D]">{fmtInt(stats.accesosNeg)} rechazados</span></div>
            </div>
            <div className="gm-w">
              <div className="gm-w-l">Socios habilitados</div>
              <div className="gm-w-v">{fmtInt(HABILITADOS[sede] ?? HABILITADOS[0])}</div>
              <div className="gm-w-s">Plan vigente y rostro registrado</div>
            </div>
            <div className="gm-w gm-w-risk">
              <div className="gm-w-l">Socios sin plan vigente</div>
              <div className="gm-w-v text-[#FFB02E]"><AnimatedNumber value={stats.porVencer} format={fmtInt} /></div>
              <div className="gm-w-s">Asignar o renovar</div>
            </div>
          </div>
          <div className="gm-demo-tag mt-3 inline-block">Gemelo simulado · datos de demostración</div>
        </div>

        <div id="mundo" ref={slotRef} className="gm-slot">
          <div className={full ? "gm-world gm-world-full" : "gm-world"}>
            {want3d && webgl ? (
              <World3D
                sim={sim}
                ctrl={ctrl}
                version={version}
                active={running3d}
                labels={full || capture}
                capture={capture}
                onPick={pick}
                onBackgroundClick={() => full && pick(-1)}
              />
            ) : (
              <div className="gm-poster">
                <div className="gm-poster-grid" />
                <div className="relative z-10 text-center">
                  <div className="text-sm font-semibold text-gym-muted">{webgl ? "Animaciones reducidas activadas" : "Tu navegador no soporta WebGL"}</div>
                  {webgl && (
                    <button className="gm-btn mt-3" onClick={() => { setWant3d(true); }}>Ver gemelo 3D</button>
                  )}
                </div>
              </div>
            )}
            {!full && want3d && webgl && (
              <button className="gm-enter" onClick={enter} aria-label="Entrar al gimnasio 3D">
                <span className="gm-enter-chip">{S.name} · {formatClock(clock)} · x{speed}</span>
                <span className="gm-enter-cta">Explorar en 3D <b>→</b></span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* HUD pantalla completa */}
      {full && (
        <div className={`gm-hud ${tourPhase !== "off" ? "gm-touring" : ""}`}>
          <div className="gm-hud-top">
            <div className="gm-hud-id flex items-center gap-2">
              <img src="/brand/vx-icon-color.svg" alt="" className="h-8 w-8" />
              <select className="gm-sede-m" value={sede} onChange={(e) => changeSede(Number(e.target.value))} aria-label="Sede">
                {SEDES.map((s, i) => (
                  <option key={s.name} value={i}>{s.name.replace("VISIONYX ", "")}</option>
                ))}
              </select>
              <div className="gm-hud-title leading-tight">
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-gym-muted">Gemelo digital</div>
                <div className="text-sm font-extrabold text-white">{S.name}</div>
              </div>
            </div>
            <div className="gm-seg gm-sede-d">
              {SEDES.map((s, i) => (
                <button key={s.name} className={i === sede ? "on" : ""} onClick={() => changeSede(i)}>
                  {s.name.replace("VISIONYX ", "")}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="gm-clock">{formatClock(clock)}</div>
              <div className="gm-seg gm-speed-d">
                {[1, 10, 60].map((s) => (
                  <button key={s} className={speed === s ? "on" : ""} onClick={() => changeSpeed(s)}>x{s}</button>
                ))}
              </div>
              <button className="gm-speed-m" onClick={() => changeSpeed(speed === 1 ? 10 : speed === 10 ? 60 : 1)} aria-label="Velocidad">
                x{speed}
              </button>
              <button className="gm-x" onClick={exit} aria-label="Salir">×</button>
            </div>
          </div>
          <div className="gm-hud-stats">
            <div><span>Ventas cobradas</span><b className="text-[#A3E635]"><AnimatedNumber value={stats.ingresosHoy} format={formatCOP} /></b></div>
            <div><span>Intentos de acceso</span><b><AnimatedNumber value={stats.accesosOk + stats.accesosNeg} format={fmtInt} /> <em className="text-[#FF4D6D]">✕{stats.accesosNeg}</em></b></div>
            <div><span>Sin plan vigente</span><b className="text-[#FFB02E]"><AnimatedNumber value={stats.porVencer} format={fmtInt} /></b></div>
            <div><span>Habilitados</span><b>{fmtInt(HABILITADOS[sede] ?? HABILITADOS[0])}</b></div>
          </div>
          <div className="gm-hud-feed">
            {feed.slice(0, 4).map((e) => (
              <div key={e.id} className={`gm-feed-i k-${e.kind}`}>
                <b>{e.kind === "ok" ? "✓" : e.kind === "deny" ? "✕" : e.kind === "lost" ? "!" : "$"}</b>
                <span>{e.name}</span>
                <em>{e.amount ? formatCOP(e.amount) : e.detail.split(" · ").slice(-1)[0]}</em>
              </div>
            ))}
          </div>
          <div className="gm-hud-nav">
            {([
              ["general", "General"],
              ["entrada", "Entrada"],
              ["pesas", "Pesas"],
              ["cardio", "Cardio"],
              ["funcional", "Funcional"],
              ["torniquete", "Torniquetes"],
              ["follow", "Seguir socio"],
              ["tour", "▶ Ver inscripción"],
            ] as [CamPreset, string][]).map(([p, l]) => (
              <button key={p} className={preset === p && !(p === "tour" && ctrl.tour.chapter !== 1) ? "on" : ""} onClick={() => go(p)}>{l}</button>
            ))}
            <button className={preset === "tour" && ctrl.tour.chapter === 2 ? "on" : ""} onClick={() => startTour(false, 2)}>▶ Ver entrenamiento</button>
            <button className={preset === "tour" && ctrl.tour.chapter === 3 ? "on" : ""} onClick={() => startTour(false, 3)}>▶ Ver caja y ventas</button>
            <button className={preset === "tour" && ctrl.tour.chapter === 4 ? "on" : ""} onClick={() => startTour(false, 4)}>▶ Ver membresía vencida</button>
            <button className={preset === "tour" && ctrl.tour.chapter === 5 ? "on" : ""} onClick={() => startTour(false, 5)}>▶ Ver invitados</button>
            <button className={preset === "tour" && ctrl.tour.chapter === 6 ? "on" : ""} onClick={() => startTour(false, 6)}>▶ Ver dueño</button>
          </div>
          {selected < 0 && !capture && tourPhase === "off" && <div className="gm-hint">Arrastra para girar · rueda o pellizco para zoom · toca un socio</div>}
          {tourPhase !== "off" && !ad && (
            <div className="gm-tourbar">
              <div className={`gm-tourbar-steps${ctrl.tour.chapter === 3 ? " many" : ""}`}>
                {(ctrl.tour.chapter === 6 ? TOUR_STEPS6 : ctrl.tour.chapter === 5 ? TOUR_STEPS5 : ctrl.tour.chapter === 4 ? TOUR_STEPS4 : ctrl.tour.chapter === 3 ? TOUR_STEPS3 : ctrl.tour.chapter === 2 ? TOUR_STEPS2 : TOUR_STEPS).map((st, i, arr) => (
                  <span key={st.l} className={st.p.includes(tourPhase) ? "on" : arr.findIndex((x) => x.p.includes(tourPhase)) > i ? "done" : ""}>
                    <b>{i + 1}</b>{st.l}
                  </span>
                ))}
              </div>
              <button onClick={stopTour}>Saltar</button>
            </div>
          )}
        </div>
      )}

      {/* Feed en vivo */}
      <section className="gm-section">
        <div className="gm-feedrow" data-rv="0">
          <div className="gm-kicker">Lo que pasa ahora mismo en el gemelo</div>
          <div className="gm-feedlist">
            {feed.slice(0, 5).map((e) => (
              <div key={e.id} className={`gm-feed-c k-${e.kind}`}>
                <div className="gm-feed-t">{formatClock(e.t)}</div>
                <div className="gm-feed-n">{e.name}</div>
                <div className="gm-feed-d">{e.detail}{e.amount ? ` · ${formatCOP(e.amount)}` : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="gm-section">
        <h2 className="gm-h2" data-rv="0">El mundo real, <span className="gm-grad">conectado.</span></h2>
        <div className="gm-steps">
          {[
            ["Llega", "Entra con su rostro. Sin carné ni tarjeta.", "#38BDF8"],
            ["Valida", "Rostro, prueba de vida y membresía vigente. Si todo está bien, el torniquete abre.", "#A3E635"],
            ["Entrena", "Su rutina del día está en la app. Tú ves cada intento de acceso en el panel.", "#A78BFA"],
          ].map(([t, d, c], i) => (
            <div key={t} className="gm-step" data-rv={String(i * 0.15)}>
              <div className="gm-step-n" style={{ color: c }}>0{i + 1}</div>
              <div className="gm-step-t">{t}</div>
              <div className="gm-step-d">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* NÚMEROS */}
      <section id="numeros" className="gm-section">
        <div className="flex flex-wrap items-end justify-between gap-3" data-rv="0">
          <h2 className="gm-h2">Números que <span className="gm-grad">se entienden.</span></h2>
          <div className="gm-demo-tag">Datos simulados de demostración</div>
        </div>
        <div className="gm-kpis">
          {[
            ["Ventas cobradas · hoy", formatCOP(stats.ingresosHoy), "Membresías y punto de venta"],
            ["Intentos de acceso · hoy", fmtInt(stats.accesosOk + stats.accesosNeg), `${fmtInt(stats.accesosOk)} aprobados · ${fmtInt(stats.accesosNeg)} rechazados`],
            ["Socios habilitados", fmtInt(HABILITADOS[sede] ?? HABILITADOS[0]), "Plan vigente y rostro registrado"],
            ["Enrolamiento facial", "97,7%", "502 de 514 con rostro"],
          ].map(([l, v, s], i) => (
            <div key={l} className="gm-kpi" data-rv={String(i * 0.08)}>
              <div className="gm-w-l">{l}</div>
              <div className="gm-kpi-v">{v}</div>
              <div className="gm-w-s">{s}</div>
            </div>
          ))}
        </div>
        <div className="gm-dash">
          <div className="gm-card2 lg:col-span-2" data-rv="0">
            <div className="gm-card2-h"><b>Medios de pago</b><span>Reportes · VISIONYX Norte · ejemplo del domingo 13 de diciembre ($3.180.000) · Wompi no entra al cajón</span></div>
            <MediosBars />
          </div>
          <div className="gm-card2" data-rv="0.1">
            <div className="gm-card2-h"><b>Intentos de acceso rechazados</b><span>Requiere atención · mismo día: 9 de 321</span></div>
            <div className="flex flex-col gap-2 text-xs">
              {RECHAZOS.map((r) => (
                <div key={r.name} className="flex items-center justify-between rounded-lg border border-[#1E2A44] px-3 py-2"><span className="text-gym-muted">{r.name}</span><b className="text-white">{r.v}</b></div>
              ))}
            </div>
          </div>
          <div className="gm-card2 lg:col-span-2" data-rv="0">
            <div className="gm-card2-h"><b>Caja de hoy</b><span>Dashboard · mismo día · turno abierto</span></div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {[
                ["Base inicial", 200000],
                ["Ventas en efectivo", 1164000],
                ["Egresos en efectivo", 35000],
                ["Efectivo esperado", 1329000],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-lg border border-[#1E2A44] px-3 py-2"><div className="text-gym-muted">{l}</div><b className="text-base text-white">{formatCOP(v as number)}</b></div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-gym-muted">Una venta con tarjeta o Wompi no entra a esa cuenta.</p>
          </div>
          <div className="gm-card2" data-rv="0.1">
            <div className="gm-card2-h"><b>Membresías</b><span>Con membresía · clientes con plan activo</span></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-[#1E2A44] px-3 py-2"><div className="text-gym-muted">Vigentes</div><b className="text-2xl text-white">{fmtInt(498)}</b><div className="text-gym-muted">Plan activo</div></div>
              <div className="rounded-lg border border-[#1E2A44] px-3 py-2"><div className="text-gym-muted">Vencidas</div><b className="text-2xl text-[#FFB02E]">{fmtInt(stats.porVencer)}</b><div className="text-gym-muted">Hay que renovar</div></div>
            </div>
          </div>
          <div className="gm-card2 lg:col-span-3" data-rv="0">
            <div className="gm-card2-h"><b>Vence en 7 días</b><span>Recepción les avisa por WhatsApp desde Membresías: «Enviar recordatorio» (vencen en 3 días o menos) o el botón WhatsApp de cada socio (hasta 7 días)</span></div>
            <div className="gm-table">
              {POR_VENCER.map((r) => (
                <div key={r.n} className="gm-tr">
                  <span className="font-semibold text-white">{r.n}</span>
                  <span>{r.p}</span>
                  <span className={r.d <= 2 ? "text-[#FF4D6D]" : "text-[#FFB02E]"}>{r.d === 1 ? "Vence mañana" : `${r.d} días`}</span>
                  <span className="gm-chip">WhatsApp</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MÓDULOS */}
      <section id="modulos" className="gm-section">
        <h2 className="gm-h2" data-rv="0">Todo tu gimnasio. <span className="gm-grad">Cinco áreas.</span></h2>
        <div className="gm-areas">
          {AREAS.map((a, i) => (
            <article key={a.t} className="gm-area" data-rv={String((i % 3) * 0.1)} style={{ ["--c" as any]: a.c }}>
              <div className="gm-area-k">{a.k}</div>
              <h3 className="gm-area-t">{a.t}</h3>
              <p className="gm-area-d">{a.d}</p>
              <ul>
                {a.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="agenda" className="gm-cta">
        <div className="gm-cta-in" data-rv="0">
          <img src="/brand/vx-icon-color.svg" alt="" className="mx-auto h-16 w-16" />
          <h2 className="gm-h1 text-center">Tu gimnasio,<br /><span className="gm-grad">en un solo panel.</span></h2>
          <p className="gm-sub mx-auto text-center">Te mostramos VISIONYX funcionando con tus sedes, tus planes y tus números. 30 minutos.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <a href={contact} className="gm-btn gm-btn-xl">{contactLabel} <span aria-hidden>→</span></a>
            <a href="/login" className="gm-btn-ghost">Probar el demo</a>
          </div>
          <img src="/brand/vx-horizontal-color.svg" alt="VISIONYX" className="mx-auto mt-10 h-9 w-auto opacity-90" />
          <div className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-gym-muted">Inteligencia que conecta el mundo real</div>
        </div>
      </section>
      <footer className="gm-foot">
        Este gimnasio no existe: es una simulación con datos de demostración. El software sí. · © VISIONYX
      </footer>

      {/* Capas para video */}
      <div ref={flashEl} className="gm-flash" />
      {captions.map((c) => (
        <div
          key={c.id}
          ref={(el) => {
            if (el) capEls.current.set(c.id, el);
            else capEls.current.delete(c.id);
          }}
          className={`gm-cap gm-cap-${c.pos}`}
          style={{ fontSize: `calc(var(--cap) * ${c.size})` }}
        >
          {c.lines.map((l, li) => (
            <div key={li} className={li === c.accent ? "gm-cap-l gm-cap-acc" : li === 0 && c.lines.length > 1 ? "gm-cap-l gm-cap-pre" : "gm-cap-l"}>
              {l.split(" ").map((w, wi) => (
                <span key={wi} className="gm-cap-w" style={{ opacity: 0 }}>{w}&nbsp;</span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </main>
  );
}
