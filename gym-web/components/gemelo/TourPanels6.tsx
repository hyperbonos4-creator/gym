"use client";
/**
 * Parte 6 · El dueño. Pantallas reales del panel web (gym-web):
 *  - Dashboard "Centro de operaciones" (app/page.tsx + app/api/dashboard/route.ts, lib/accessCopy.ts).
 *  - Selector de sede del encabezado (components/GymShell.tsx). No hay vista consolidada: una sede a la vez.
 *  - Reportes (app/reportes/page.tsx) y gastos por categoría (app/egresos/page.tsx).
 *  - El mismo panel en el celular: responsive (☰, selector de sede, tarjetas en 2 columnas) y puntos de estado del menú (navMark).
 *  No hay aforo en el producto ni alertas por push/WhatsApp al dueño. Cifras de demostración del gemelo.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { Tour } from "../../lib/gemelo/tour";
import type { Layout } from "../../lib/gemelo/sim";
import { Human } from "./Human";

const show = (el: HTMLElement | null | undefined, v: boolean, disp = "") => {
  if (el) el.style.display = v ? disp : "none";
};
const fixedPos = (() => [0, 0]) as any;
const isAd = () => typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search);
const FECHA = "Domingo, 13 de diciembre";

type SedeData = { name: string; city: string; ventas: string; medios: string; intentos: number; ok: number; no: number; hab: number; pct: string; rostro: string };
const SEDES6: SedeData[] = [
  { name: "VISIONYX Norte", city: "Bogota · Norte", ventas: "$3.180.000", medios: "Efectivo $1.164.000 · Wompi $1.080.000 · Tarjeta $696.000 · Transferencia $240.000", intentos: 321, ok: 312, no: 9, hab: 487, pct: "97.7%", rostro: "502 de 514" },
  { name: "VISIONYX Centro", city: "Bogota · Centro", ventas: "$3.975.000", medios: "Efectivo $1.455.000 · Wompi $1.320.000 · Tarjeta $900.000 · Transferencia $300.000", intentos: 401, ok: 390, no: 11, hab: 608, pct: "96.9%", rostro: "622 de 642" },
  { name: "VISIONYX Sur", city: "Bogota · Sur", ventas: "$2.703.000", medios: "Efectivo $1.023.000 · Wompi $840.000 · Tarjeta $600.000 · Transferencia $240.000", intentos: 273, ok: 265, no: 8, hab: 414, pct: "97.1%", rostro: "433 de 446" },
];
/** tiempos (s) */
const DS = { att: 4.5, act: 9.0 };
const SS = { open1: 0.8, pick1: 1.8, open2: 5.0, pick2: 5.8 };
const RP = { scroll: 5.5 };
const PH = { drawer: 5.4 };

/* ---------- dueño en 3D ---------- */
export function Owner3D({ tour }: { tour: Tour }) {
  const proxy = useMemo(() => {
    const w = () => tour.guests[0];
    return {
      get active() {
        return tour.active && tour.chapter === 6 && w().on;
      },
      get x() { return w().x; },
      get z() { return w().z; },
      get h() { return w().h; },
      get walk() { return w().walk; },
      get moving() { return false; },
      get t() { return tour.t; },
      curl0: 0,
      chapter: 5,
      get phase() { return tour.phase === "own_phone" || tour.phase === "own_dash" || tour.phase === "own_sede" || tour.phase === "own_rep" ? "phone" : "walk_in"; },
      get phaseT() { return Math.max(1.2, tour.phaseT); },
      get phaseDur() { return 1e9; },
    } as unknown as Tour;
  }, [tour]);
  return <Human tour={proxy} look={{ top: "#1e293b", hair: "#3b2a1e", skin: "#c58c63", legs: "#0f172a" }} />;
}

/* ---------- contadores reales sobre la sede (vista aérea) ---------- */
export function AerialCounters({ L, tour }: { L: Layout; tour: Tour }) {
  const door = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const { size } = useThree();
  const gx = L.gates.reduce((a, g) => a + g.x, 0) / L.gates.length;
  const gz = L.gates[0].z;
  useFrame(() => {
    const on = tour.active && tour.chapter === 6 && (tour.phase === "own_aerial" ? tour.phaseT > 2.6 : tour.phase === "own_end");
    const portrait = size.width < size.height;
    for (const el of [door.current, caja.current]) {
      if (!el) continue;
      el.style.display = on ? "" : "none";
      el.classList.toggle("p", portrait);
    }
    const s = strip.current;
    if (s) {
      s.classList.toggle("p", portrait);
      s.style.display = on && !isAd() ? "" : "none";
      s.style.left = `${size.width / 2}px`;
    }
  });
  const N = SEDES6[0];
  return (
    <>
      <group position={[gx, 3.4, gz]}>
        <Html center zIndexRange={[40, 30]} style={{ pointerEvents: "none" }}>
          <div ref={door} className="gm-o6-count" style={{ display: "none" }}>
            <span>Puerta</span><b>{N.intentos}</b><em>Intentos de acceso</em><i>{N.ok} aprobados · {N.no} rechazados</i>
          </div>
        </Html>
      </group>
      <group position={[L.reception.x, 4.6, L.reception.z]}>
        <Html center zIndexRange={[40, 30]} style={{ pointerEvents: "none" }}>
          <div ref={caja} className="gm-o6-count" style={{ display: "none" }}>
            <span>Hoy</span><b>{N.ventas}</b><em>Ventas cobradas</em><i>Wompi $1.080.000 · incluye la renovación de Valentina</i>
          </div>
        </Html>
      </group>
      <Html calculatePosition={fixedPos} zIndexRange={[73, 72]} style={{ pointerEvents: "none" }}>
        <div ref={strip} className="gm-o6-strip" style={{ display: "none" }}>
          {SEDES6.map((sd, i) => (
            <span key={sd.name} className={i === 0 ? "on" : ""}><b>{sd.name}</b>{sd.city}</span>
          ))}
        </div>
      </Html>
    </>
  );
}

function place(el: HTMLElement, size: { width: number; height: number }, ad: boolean, t: number, W: number, H: number, side = 0.62) {
  const portrait = size.width < size.height;
  const fit = !ad && portrait;
  const s = fit
    ? Math.min((size.height - 64 - 176 - 44) / H, (size.width * 0.94) / W)
    : portrait
      ? Math.min((size.height * 0.72) / H, (size.width * 0.94) / W)
      : Math.min((size.height * 0.86) / H, (size.width * 0.6) / W);
  const tx = portrait ? size.width * 0.5 : size.width * side;
  const ty = fit ? 64 + 44 + (H * s) / 2 : portrait ? size.height * 0.6 : size.height * 0.52;
  const ie = 1 - Math.pow(1 - Math.min(1, t / 0.6), 3);
  el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 120}px) translate(-50%,-50%) scale(${s * (0.92 + 0.08 * ie)})`;
  el.style.opacity = String(Math.min(1, ie * 1.3));
}

function Cards({ reg, p = "" }: { reg: (k: string) => (el: HTMLElement | null) => void; p?: string }) {
  return (
    <div className="gm-o6-cards">
      <div><span>Hoy</span><b ref={reg(p + "ventas")} /><em>Ventas cobradas</em><i ref={reg(p + "medios")} /></div>
      <div><span>Puerta</span><b ref={reg(p + "intentos")} /><em>Intentos de acceso</em><i ref={reg(p + "okno")} /></div>
      <div><span>Autorización</span><b ref={reg(p + "hab")} /><em>Socios habilitados</em><i>Plan vigente y rostro registrado. No basta con tener la ficha.</i></div>
      <div><span className="row">Identidad<b ref={reg(p + "pct")} /></span><div className="bar"><i ref={reg(p + "bar")} /></div><em>Enrolamiento facial</em><i ref={reg(p + "rostro")} /></div>
    </div>
  );
}
function fillCards(F: Record<string, HTMLElement | null>, d: SedeData, p = "") {
  F[p + "ventas"]!.textContent = d.ventas;
  F[p + "medios"]!.textContent = d.medios;
  F[p + "intentos"]!.textContent = String(d.intentos);
  F[p + "okno"]!.textContent = `${d.ok} aprobados · ${d.no} rechazados`;
  F[p + "hab"]!.textContent = String(d.hab);
  F[p + "pct"]!.textContent = d.pct;
  F[p + "bar"]!.style.width = d.pct;
  F[p + "rostro"]!.textContent = `${d.rostro} con rostro. El rostro no autoriza la entrada.`;
}

const ACT: [string, string, boolean, string?][] = [
  ["Valentina Ríos Gómez", "Entrada · Membresía vigente · rostro reconocido · Torniquete 2 · 10:02:14 a. m.", true, "Valentina, tras pagar con Wompi"],
  ["Prueba del panel", "Panel · Orden del operador. No identifica a una persona. · Torniquete 1 · 9:58:40 a. m.", true, "PIN de Camilo"],
  ["Persona reconocida", "Entrada · Membresía vigente · rostro reconocido · Torniquete 2 · 9:51:03 a. m.", true, "Ana, invitada"],
  ["Persona no reconocida", "Identificación · Identidad no encontrada · Torniquete 3 · 9:44:27 a. m.", false],
  ["Valentina Ríos Gómez", "Membresía · Membresía vencida · Torniquete 2 · 9:12:09 a. m.", false, "antes de renovar"],
];

/* ---------- panel web (portátil) ---------- */
export function OwnerPanel({ tour }: { tour: Tour }) {
  const root = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const { size } = useThree();
  const ad = isAd();
  useFrame(() => {
    const el = root.current;
    if (!el) return;
    const ph = tour.phase;
    const t = tour.phaseT;
    const on = tour.active && tour.chapter === 6 && (ph === "own_dash" || ph === "own_sede" || ph === "own_rep");
    el.style.display = on ? "" : "none";
    if (!on) return;
    const portrait = size.width < size.height;
    el.classList.toggle("p", portrait);
    const W = portrait ? 380 : 760;
    const H = portrait ? 640 : 520;
    el.style.width = `${W}px`;
    el.style.height = `${H}px`;
    place(el, size, ad, ph === "own_dash" ? t : 1, W, H);
    const F = f.current;
    show(F.dash, ph !== "own_rep", "block");
    show(F.rep, ph === "own_rep", "block");
    let sede = 0;
    if (ph === "own_sede") sede = t < SS.pick1 ? 0 : t < SS.pick2 ? 1 : 2;
    const d = SEDES6[sede];
    F.title!.textContent = ph === "own_rep" ? "Reportes" : "Dashboard";
    F.sub!.textContent = ph === "own_rep" ? "Ventas, medios, margen y stock" : "Resumen del gimnasio";
    F.sedeName!.textContent = d.name;
    F.sedeCity!.textContent = d.city;
    const menu = ph === "own_sede" && ((t > SS.open1 && t < SS.pick1) || (t > SS.open2 && t < SS.pick2));
    show(F.menu, menu, "block");
    F.sedeBtn!.classList.toggle("gm-press", menu);
    for (let i = 0; i < 3; i++) F[`mi${i}`]!.classList.toggle("on", i === (t < SS.open2 ? (t > SS.pick1 - 0.35 ? 1 : 0) : t > SS.pick2 - 0.35 ? 2 : 1));
    F.hSede!.textContent = `${d.name} · ${FECHA}`;
    F.oper!.textContent = "La información del día está consolidada. Hay asuntos pendientes de acceso, membresías y enrolamiento.";
    fillCards(F, d);
    const sc = ph === "own_dash" ? (t < DS.att ? 0 : t < DS.act ? 1 : 2) : 0;
    const L = F.list!;
    const target = sc === 0 ? 0 : sc === 1 ? (F.att!.offsetTop - 6) : (F.act!.offsetTop - 6);
    const cur = Number(L.dataset.y || "0");
    const y = cur + (target - cur) * 0.12;
    L.dataset.y = String(y);
    L.style.transform = `translateY(${-y}px)`;
    for (let i = 0; i < ACT.length; i++) F[`tag${i}`]?.classList.toggle("on", ph === "own_dash" && t > DS.act + 0.8 + i * 0.35);
    F.chip!.textContent =
      ph === "own_dash" ? (sc === 0 ? "Panel web · Dashboard de la sede" : sc === 1 ? "Requiere atención: lo que el dueño debe mirar hoy" : "Actividad de acceso: el invitado no se nombra en el panel")
        : ph === "own_sede" ? "Selector de sede: una sede a la vez (no hay vista consolidada)" : "Reportes · VISIONYX Norte · Hoy";
    show(F.chip, !ad, "block");
    if (ph === "own_rep") {
      const R = F.repList!;
      const ry = t < RP.scroll ? 0 : Math.min(1, (t - RP.scroll) / 0.8) * Math.max(0, R.scrollHeight - (R.parentElement?.clientHeight || 0));
      R.style.transform = `translateY(${-ry}px)`;
    }
  });
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[68, 58]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-3dpanel gm-coach gm-caja gm-o6" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
        {/* encabezado de GymShell */}
        <div className="gm-o6-head">
          <div className="t"><b ref={reg("title")}>Dashboard</b><span ref={reg("sub")}>Resumen del gimnasio</span></div>
          <div ref={reg("sedeBtn")} className="gm-o6-sede">
            <img src="/brand/vx-icon-color.svg" alt="" />
            <div><b ref={reg("sedeName")}>VISIONYX Norte</b><span ref={reg("sedeCity")}>Bogota · Norte</span></div>
            <i>▾</i>
            <div ref={reg("menu")} className="gm-o6-menu" style={{ display: "none" }}>
              {SEDES6.map((sd, i) => (
                <div key={sd.name} ref={reg(`mi${i}`)}><img src="/brand/vx-icon-color.svg" alt="" /><span><b>{sd.name}</b>{sd.city}</span></div>
              ))}
            </div>
          </div>
        </div>
        <div className="gm-o6-body">
          {/* Dashboard */}
          <div ref={reg("dash")}>
            <div ref={reg("list")}>
              <div className="gm-o6-h">
                <div><h2>Centro de operaciones</h2><p ref={reg("hSede")} /></div>
                <div className="st"><b>Servicios en línea</b><p ref={reg("oper")} /></div>
              </div>
              <Cards reg={reg} />
              <div ref={reg("att")} className="gm-o6-sec">
                <h3>Requiere atención</h3>
                <div className="gm-o6-a warn"><div className="r"><b>Intentos de acceso rechazados</b><span>9 de 321</span></div><p>Conviene revisar la causa antes de tratarlos como la misma falla.</p><small>Identidad desconocida · 4  ·  Membresía · 4  ·  Prueba de vida · 1</small><a>Revisar intentos</a></div>
                <div className="gm-o6-a err"><b>Socios sin plan vigente</b><p>27 personas no cumplen la condición de membresía para entrar.</p><small>Mateo Rodriguez · venció 2026-12-09<br />Jorge Rodriguez · venció 2026-12-11<br />…</small><a>Asignar o renovar</a></div>
                <div className="gm-o6-a warn"><b>Enrolamiento pendiente</b><p>12 fichas no tienen el rostro. Enviar el enlace no cuenta como enrolamiento completado.</p><a>Gestionar enrolamientos</a></div>
                <div className="gm-o6-a warn"><b>4 planes vencen hoy</b><p>$480.000 en los planes que vencen hoy. No es un cobro pendiente registrado.</p><a>Renovar</a></div>
                <div className="gm-o6-a"><b>3 productos bajo el mínimo en el gimnasio</b><a>Revisar bodega</a></div>
              </div>
              <div ref={reg("act")} className="gm-o6-sec">
                <h3 className="n">Actividad de acceso</h3>
                <p className="m">321 intentos registrados hoy. Se vuelve a leer cada 20 segundos. No es una transmisión en vivo.</p>
                <div className="gm-o6-pills"><span className="on">Todos · 321</span><span>Aprobados · 312</span><span>Rechazados · 9</span></div>
                {ACT.map(([n, w, ok, tag], i) => (
                  <div key={i} className="gm-o6-ev">
                    <div><b>{n}</b><span>{w}</span></div>
                    <em className={ok ? "ok" : "no"}>{ok ? "Aprobado" : "Rechazado"}</em>
                    {tag && <i ref={reg(`tag${i}`)} className="gm-o6-tag">{tag}</i>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Reportes */}
          <div ref={reg("rep")} style={{ display: "none" }}>
            <div ref={reg("repList")}>
              <h2 className="gm-o6-rh">Reportes</h2>
              <p className="m">Ventas cobradas, medios, gastos y stock bajo. El margen solo cuenta productos que tienen costo cargado.</p>
              <div className="gm-o6-pills"><span className="on">Hoy</span><span>7 días</span><span>30 días</span></div>
              <p className="m">Del 2026-12-13 al 2026-12-13</p>
              <div className="gm-o6-cards four">
                <div><span>Ventas cobradas</span><b>$3.180.000</b></div>
                <div><span>Tickets</span><b>52</b></div>
                <div><span>Anuladas</span><b>0 · $0</b></div>
                <div><span>Gastos</span><b>$35.000</b></div>
              </div>
              <div className="gm-o6-two">
                <div className="gm-o6-box"><h3 className="n">Medios de pago</h3>
                  {[["Efectivo", "$1.164.000"], ["Tarjeta", "$696.000"], ["Transferencia", "$240.000"], ["Wompi", "$1.080.000"]].map(([a, b]) => <div key={a} className="kv"><span>{a}</span><b>{b}</b></div>)}
                  <p className="m">Wompi no entra al cajón. El descuento del rango es $0.</p>
                </div>
                <div className="gm-o6-box"><h3 className="n">Margen</h3>
                  <p className="m">Sin costo cargado. No hay margen que mostrar.</p>
                  <div className="kv"><span>Mantenimiento</span><b>$35.000</b></div>
                </div>
              </div>
              <div className="gm-o6-box"><h3 className="n">Productos</h3>
                {[["1 × Mensual · Valentina Ríos Gómez", "$120.000"], ["14 × Bebida isotónica 600 ml", "$77.000"], ["1 × Mensual · Isabella Gonzalez", "$120.000"]].map(([a, b]) => <div key={a} className="kv"><span style={{ color: "#fff" }}>{a}</span><b>{b} <small>sin costo</small></b></div>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Html>
  );
}

/* ---------- el mismo panel en el celular del dueño ---------- */
export function OwnerPhone({ tour }: { tour: Tour }) {
  const root = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const { size } = useThree();
  const ad = isAd();
  useFrame(() => {
    const el = root.current;
    if (!el) return;
    const t = tour.phaseT;
    const on = tour.active && tour.chapter === 6 && tour.phase === "own_phone";
    el.style.display = on ? "" : "none";
    if (!on) return;
    place(el, size, ad, t, 300, 620, 0.66);
    const F = f.current;
    if (!F.done) {
      fillCards(F, SEDES6[0], "m");
      F.done = document.body;
    }
    const dr = t > PH.drawer;
    F.burger!.classList.toggle("gm-press", t > PH.drawer - 0.35 && t < PH.drawer);
    F.drawer!.style.transform = `translateX(${dr ? 0 : -110}%)`;
    show(F.shade, dr, "block");
    show(F.chip, !ad, "block");
    F.chip!.textContent = dr ? "Menú: puntos de estado en Con membresía, Punto de venta, Control de acceso y WhatsApp" : "El mismo panel web en el celular del dueño (se puede agregar a la pantalla de inicio)";
  });
  const NAVS: [string, [string, string | null][]][] = [
    ["Operación", [["Dashboard", null], ["Control de acceso", "ok"], ["Historial de accesos", null], ["Enrolamiento", null]]],
    ["Gimnasio", [["Clientes", null], ["Con membresía", "warn"], ["Planes", null]]],
    ["Finanzas", [["Punto de venta", "ok"], ["Historial de ventas", null], ["Gastos", null], ["Reportes", null]]],
    ["Sistema", [["Gimnasios", null], ["WhatsApp", "ok"]]],
  ];
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[70, 60]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-phone gm-p2" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
        <div className="gm-phone-notch" />
        <div className="gm-phone-status"><span>10:05</span><span>●●● 5G ▮</span></div>
        <div className="gm-scr gm-o6m" style={{ display: "flex" }}>
          <div className="gm-o6m-url">🔒 visionyx.duckdns.org</div>
          <div className="gm-o6m-head">
            <span ref={reg("burger")} className="bg">☰</span>
            <b>Dashboard</b>
            <div className="gm-o6-sede sm"><img src="/brand/vx-icon-color.svg" alt="" /><div><b>VISIONYX Norte</b><span>Bogota · Norte</span></div><i>▾</i></div>
          </div>
          <div className="gm-o6m-body">
            <h2>Centro de operaciones</h2>
            <p className="m">VISIONYX Norte · {FECHA}</p>
            <p className="ok">Servicios en línea</p>
            <Cards reg={reg} p="m" />
          </div>
          <div ref={reg("shade")} className="gm-o6m-shade" style={{ display: "none" }} />
          <div ref={reg("drawer")} className="gm-o6m-drawer">
            <div className="brand"><img src="/brand/vx-horizontal-color.svg" alt="VISIONYX" /><span>PLATAFORMA</span></div>
            {NAVS.map(([g, items]) => (
              <div key={g}>
                <div className="g">{g}</div>
                {items.map(([l, mk]) => <div key={l} className={`it${l === "Dashboard" ? " on" : ""}`}><span>{l}</span>{mk && <i className={mk} />}</div>)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Html>
  );
}
