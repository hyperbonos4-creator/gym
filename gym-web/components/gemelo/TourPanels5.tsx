"use client";
/**
 * Parte 5 · Invitados y kiosko. Textos tomados del código real:
 *  - App del socio (gym-mobile): pestaña Invitados (features/home/home_screen.dart, guests: true),
 *    "Nueva invitación" y la pantalla emitida con "Enviar enlace por WhatsApp" y "PIN DE RESPALDO"
 *    (features/invites/new_invite_screen.dart). El enlace sale por wa.me desde el WhatsApp del socio.
 *  - Registro facial del invitado: el mismo enroll de /e/{code} de la Parte 1.
 *  - /ingreso (app/ingreso/page.tsx) + api/invitaciones/usar: PIN de 4 dígitos, abre una sola vez.
 *  - Accesos (app/accesos): fila del invitado que entró por rostro.
 *  Nada se envía de verdad.
 */
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { GUESTS, TOUR_PERSON, pinStand, type Tour } from "../../lib/gemelo/tour";
import type { Layout } from "../../lib/gemelo/sim";
import { Human, type HumanLook } from "./Human";

const P = TOUR_PERSON;
const [ANA, CAM] = GUESTS;
const PIN_ANA = "6153";
const PIN_CAM = "4827";
const ENROLL = "visionyx.duckdns.org/e/a7k2qd";
const show = (el: HTMLElement | null | undefined, v: boolean, disp = "") => {
  if (el) el.style.display = v ? disp : "none";
};
const fixedPos = (() => [0, 0]) as any;
const isAd = () => typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search);
const typed = (s: string, t: number, t0: number, t1: number) => (t <= t0 ? "" : t >= t1 ? s : s.slice(0, Math.floor(((t - t0) / (t1 - t0)) * s.length)));

/* tiempos (s) dentro de cada fase */
const I1 = { tap: 1.2, form: 1.6, n0: 2.0, n1: 3.2, d0: 3.4, d1: 4.4, gen: 4.8, issued: 6.0, wa: 8.8, share: 9.6, sent: 10.2 };
const I2 = { tap: 1.0, form: 1.4, n0: 1.7, n1: 2.8, d0: 3.0, d1: 3.8, gen: 4.2, issued: 5.4, pinHi: 6.4 };
const EN = { tap: 1.8, idle: 2.2, start: 3.6, verify: 4.2, ok: 6.4 };
const KP = { d: [0.8, 1.2, 1.6, 2.0], ok: 2.5, receipt: 3.0 };
const LEDGER_PHONE = 4.6;

/* ---------- invitados en 3D (reusan la figura de Valentina) ---------- */
const LOOKS: HumanLook[] = [
  { top: "#F472B6", hair: "#6b3a1f", skin: "#e0a67c", legs: "#1f2937", bag: true },
  { top: "#F59E0B", hair: "#111111", skin: "#a8714f", legs: "#334155" },
];

function GuestFigure({ tour, i }: { tour: Tour; i: number }) {
  const proxy = useMemo(() => {
    const w = () => tour.guests[i];
    return {
      get active() {
        return tour.active && tour.chapter === 5 && w().on;
      },
      get x() { return w().x; },
      get z() { return w().z; },
      get h() { return w().h; },
      get walk() { return w().walk; },
      get moving() { return w().moving; },
      get t() { return tour.t; },
      curl0: 0,
      chapter: 5,
      get phase() {
        return i === 0 && tour.phase === "guest_enroll" ? "phone" : "walk_in";
      },
      get phaseT() { return i === 0 && tour.phase === "guest_enroll" ? Math.max(1.2, tour.phaseT) : 0; },
      get phaseDur() { return tour.phaseDur; },
    } as unknown as Tour;
  }, [tour, i]);
  return <Human tour={proxy} look={LOOKS[i]} />;
}

/** tableta de /ingreso junto a los torniquetes */
function PinStand3D({ L, tour }: { L: Layout; tour: Tour }) {
  const g = useRef<THREE.Group>(null!);
  const S = pinStand(L);
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 384;
    const x = c.getContext("2d")!;
    x.fillStyle = "#070b14";
    x.fillRect(0, 0, 256, 384);
    x.fillStyle = "#38BDF8";
    x.font = "bold 13px Arial";
    x.fillText("VISIONYX", 20, 30);
    x.fillStyle = "#fff";
    x.font = "bold 22px Arial";
    x.fillText("Ingreso de invitado", 20, 60);
    for (let i = 0; i < 4; i++) {
      x.strokeStyle = "rgba(255,255,255,.25)";
      x.strokeRect(38 + i * 48, 86, 38, 46);
    }
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Entrar"];
    x.font = "bold 18px Arial";
    keys.forEach((k, i) => {
      const cx = 20 + (i % 3) * 74;
      const cy = 156 + Math.floor(i / 3) * 54;
      x.fillStyle = "rgba(255,255,255,.07)";
      x.fillRect(cx, cy, 66, 44);
      x.fillStyle = "#fff";
      x.fillText(k, cx + 33 - x.measureText(k).width / 2, cy + 29);
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useFrame(() => {
    if (g.current) g.current.visible = tour.active && tour.chapter === 5;
  });
  return (
    <group ref={g} position={[S.x, 0, S.z]} visible={false}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 1.1, 12]} />
        <meshStandardMaterial color="#9aa6b8" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.24, 0.26, 0.04, 20]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <group position={[0, 1.22, 0.02]} rotation={[-0.35, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.32, 0.46, 0.03]} />
          <meshStandardMaterial color="#0b1020" />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.28, 0.42]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export function Guests3D({ L, tour }: { L: Layout; tour: Tour }) {
  return (
    <>
      <GuestFigure tour={tour} i={0} />
      <GuestFigure tour={tour} i={1} />
      <PinStand3D L={L} tour={tour} />
    </>
  );
}

/* ---------- colocación de los paneles en pantalla (igual que la Parte 4) ---------- */
function place(el: HTMLElement, size: { width: number; height: number }, ad: boolean, t: number, first: boolean, H = 620, W = 300) {
  const portrait = size.width < size.height;
  const fit = !ad && portrait;
  const s = fit
    ? Math.min((size.height - 64 - 176 - 44) / H, (size.width * 0.92) / W)
    : portrait
      ? Math.min((size.height * 0.75) / H, (size.width * 0.92) / W)
      : Math.min((size.height * 0.84) / H, (size.width * 0.5) / W);
  const tx = portrait ? size.width * 0.5 : size.width * 0.66;
  const ty = fit ? 64 + 44 + (H * s) / 2 : portrait ? size.height * 0.595 : size.height * 0.5;
  const ie = first ? 1 - Math.pow(1 - Math.min(1, t / 0.6), 3) : 1;
  el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 140}px) translate(-50%,-50%) scale(${s * (0.9 + 0.1 * ie)})`;
  el.style.opacity = String(Math.min(1, ie * 1.3));
}

function Nav({ on }: { on: string }) {
  return (
    <div className="gm-fl-nav">
      {[["⌂", "Inicio"], ["▭", "Planes"], ["⚲", "Entreno"], ["⚇", "Invitados"]].map(([i, l]) => (
        <span key={l} className={l === on ? "on" : ""}><i>{i}</i>{l}</span>
      ))}
    </div>
  );
}

function Tile({ name, doc, txt, used }: { name: string; doc: string; txt: string; used?: boolean }) {
  return (
    <div className="gm-fl-tile">
      <b>{name}</b>
      <span>{doc}</span>
      <em className={used ? "used" : ""}>{txt}</em>
    </div>
  );
}

/* ---------- celular: app de Valentina (invitar) y celular de Ana (enlace + rostro) ---------- */
export function PhoneInv({ tour }: { tour: Tour }) {
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
    const on = tour.active && tour.chapter === 5 && (ph === "invite" || ph === "invite2" || ph === "guest_enroll" || (ph === "ledger" && t < LEDGER_PHONE));
    el.style.display = on ? "" : "none";
    if (!on) return;
    place(el, size, ad, t, true);
    const F = f.current;
    let scr = "tab";
    if (ph === "invite") scr = t < I1.form ? "tab" : t < I1.issued ? "form" : t < I1.share ? "issued" : "share";
    if (ph === "invite2") scr = t < I2.form ? "tab" : t < I2.issued ? "form" : "issued";
    if (ph === "guest_enroll") scr = t < EN.idle ? "anaWa" : t < EN.verify ? "idle" : t < EN.ok ? "verify" : "ok";
    for (const k of ["tab", "form", "issued", "share", "anaWa", "idle", "verify", "ok"]) show(F[k], k === scr, "flex");
    show(F.chip, !ad, "block");
    F.chip!.textContent =
      ph === "guest_enroll"
        ? scr === "anaWa" ? "Celular de Ana · le llegó el enlace" : "Celular de Ana · registra su rostro (descuenta 1 ingreso)"
        : ph === "ledger"
          ? "App de Valentina · registro de invitados"
          : scr === "share"
            ? "WhatsApp de Valentina · enlace para Ana"
            : scr === "issued" && ph === "invite2" && t > I2.pinHi
              ? "Camilo no tiene celular: Valentina le pasa el PIN"
              : "App VISIONYX de Valentina · Invitados";
    // pestaña Invitados
    const stage = ph === "invite" ? 0 : ph === "invite2" ? 1 : 2;
    const left = [4, 3, 2][stage];
    F.tabTxt!.textContent = `Puedes enviar ${left}. Quedan ${left} de 4`;
    show(F.tCam, stage === 2, "block");
    show(F.tAna, stage >= 1, "block");
    show(F.tEmpty, stage === 0, "block");
    const tap = ph === "invite" ? I1.tap : I2.tap;
    F.genBtn!.classList.toggle("gm-press", stage < 2 && t > tap && t < tap + 0.3);
    // formulario
    const g = ph === "invite2" ? CAM : ANA;
    const T = ph === "invite2" ? I2 : I1;
    if (scr === "form") {
      F.fName!.textContent = typed(g.nombre, t, T.n0, T.n1) || " ";
      F.fDoc!.textContent = typed(g.doc, t, T.d0, T.d1) || " ";
      F.fNameF!.classList.toggle("on", t > T.n0 - 0.2 && t < T.n1 + 0.1);
      F.fDocF!.classList.toggle("on", t > T.d0 - 0.1 && t < T.d1 + 0.1);
      F.fBtn!.textContent = t > T.gen + 0.3 ? "Generando…" : "Generar invitación";
      F.fBtn!.classList.toggle("gm-press", t > T.gen && t < T.gen + 0.3);
    }
    if (scr === "issued") {
      F.iName!.textContent = g.nombre;
      F.iDoc!.textContent = `${g.doc} · de parte de ${P.nombre}`;
      F.iLeft!.textContent = `Quedan ${ph === "invite2" ? 3 : 4} de 4. El descuento ocurre cuando registre el rostro.`;
      const pin = ph === "invite2" ? PIN_CAM : PIN_ANA;
      for (let i = 0; i < 4; i++) F[`pin${i}`]!.textContent = pin[i];
      F.iWa!.classList.toggle("gm-press", ph === "invite" && t > I1.wa && t < I1.wa + 0.35);
      F.pinBox!.classList.toggle("hi", ph === "invite2" && t > I2.pinHi);
    }
    if (scr === "share") show(F.shBubble, t > I1.sent, "block");
    if (ph === "guest_enroll") {
      F.anaLink!.classList.toggle("gm-press", t > EN.tap && t < EN.tap + 0.3);
      F.enStart!.classList.toggle("gm-press", t > EN.start && t < EN.start + 0.3);
      F.enFlag!.textContent = t < EN.verify + 1.0 ? "Mira a la cámara" : t < EN.verify + 1.6 ? "Gira un poco la cabeza" : "Verificando…";
    }
  });
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[70, 60]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-phone gm-p2" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
        <div className="gm-phone-notch" />
        <div className="gm-phone-status"><span>10:15</span><span>●●● 5G ▮</span></div>
        {/* Invitados (home_screen.dart, guests: true) */}
        <div ref={reg("tab")} className="gm-scr gm-fl">
          <div className="gm-fl-bar"><span>⋮</span><b>VISIONYX</b></div>
          <div className="gm-fl-pad" style={{ flex: 1, overflow: "hidden" }}>
            <div className="gm-fl-h2" style={{ marginBottom: 6, fontWeight: 400 }}>Invitados</div>
            <div ref={reg("tabTxt")} style={{ fontSize: 13 }}>Puedes enviar 4. Quedan 4 de 4</div>
            <div ref={reg("genBtn")} className="gm-fl-btn" style={{ marginTop: 14 }}>Generar invitación</div>
            <div style={{ height: 14 }} />
            <div ref={reg("tEmpty")} className="gm-fl-mut">Todavía no hay invitaciones.</div>
            <div ref={reg("tCam")} style={{ display: "none" }}>
              <Tile name={CAM.nombre} doc={CAM.doc} txt={`Ingresó por PIN · de parte de ${P.nombre} · quedan 2`} used />
            </div>
            <div ref={reg("tAna")} style={{ display: "none" }}>
              <Tile name={ANA.nombre} doc={ANA.doc} txt={`Ingresó por rostro · de parte de ${P.nombre} · quedan 3`} used />
            </div>
          </div>
          <Nav on="Invitados" />
        </div>
        {/* Nueva invitación (new_invite_screen.dart) */}
        <div ref={reg("form")} className="gm-scr gm-fl" style={{ display: "none" }}>
          <div className="gm-fl-bar"><span>←</span><b style={{ fontWeight: 400 }}>Nueva invitación</b></div>
          <div className="gm-fl-pad">
            <div className="gm-fl-desc" style={{ marginTop: 4 }}>Envía el enlace al invitado. El ingreso se descuenta cuando esa persona registra el rostro, y queda en el registro de invitados.</div>
            <div ref={reg("fNameF")} className="gm-fl-field"><label>Nombre del invitado</label><div ref={reg("fName")}> </div></div>
            <div ref={reg("fDocF")} className="gm-fl-field"><label>Documento del invitado</label><div ref={reg("fDoc")}> </div></div>
            <div ref={reg("fBtn")} className="gm-fl-btn">Generar invitación</div>
          </div>
        </div>
        {/* invitación emitida */}
        <div ref={reg("issued")} className="gm-scr gm-fl" style={{ display: "none" }}>
          <div className="gm-fl-bar"><span>←</span><b style={{ fontWeight: 400 }}>Nueva invitación</b></div>
          <div className="gm-fl-pad">
            <div ref={reg("iName")} style={{ fontSize: 24, fontWeight: 800 }}>{ANA.nombre}</div>
            <div ref={reg("iDoc")} className="gm-fl-mut2" style={{ fontSize: 12.5 }} />
            <div ref={reg("iLeft")} className="gm-fl-mut2" style={{ fontSize: 12.5, marginTop: 8 }} />
            <div ref={reg("iWa")} className="gm-fl-btn" style={{ marginTop: 14 }}>Enviar enlace por WhatsApp</div>
            <div className="gm-fl-obtn">Abrir registro</div>
            <div ref={reg("pinBox")} className="gm-fl-pinbox">
              <div className="k">PIN DE RESPALDO</div>
              <div className="gm-fl-pin">{[0, 1, 2, 3].map((i) => <span key={i} ref={reg(`pin${i}`)} />)}</div>
              <div className="gm-fl-mut" style={{ fontSize: 11 }}>Expira en el momento en que se usa. El registro queda a tu nombre.</div>
            </div>
          </div>
        </div>
        {/* wa.me desde el WhatsApp de Valentina */}
        <div ref={reg("share")} className="gm-scr gm-wa" style={{ display: "none" }}>
          <div className="gm-wa-head">
            <span className="gm-wa-back">‹</span>
            <div className="gm-wa-av">A</div>
            <div><b>{ANA.nombre}</b><span>en línea</span></div>
          </div>
          <div className="gm-wa-input"><span>Mensaje</span><i>🎤</i></div>
          <div className="gm-wa-body">
            <div className="gm-wa-day">HOY</div>
            <div ref={reg("shBubble")} className="gm-wa-bubble out" style={{ display: "none" }}>
              Hola {ANA.nombre}. Registra tu rostro para tu visita a VISIONYX:<br />
              <span className="gm-wa-link">https://{ENROLL}</span>
              <span className="gm-wa-time">10:15 a. m. ✓✓</span>
            </div>
          </div>
        </div>
        {/* celular de Ana: le llega el enlace */}
        <div ref={reg("anaWa")} className="gm-scr gm-wa" style={{ display: "none" }}>
          <div className="gm-wa-head">
            <span className="gm-wa-back">‹</span>
            <div className="gm-wa-av">V</div>
            <div><b>{P.nombre}</b><span>en línea</span></div>
          </div>
          <div className="gm-wa-input"><span>Mensaje</span><i>🎤</i></div>
          <div className="gm-wa-body">
            <div className="gm-wa-day">HOY</div>
            <div className="gm-wa-bubble">
              Hola {ANA.nombre}. Registra tu rostro para tu visita a VISIONYX:<br />
              <span ref={reg("anaLink")} className="gm-wa-link">https://{ENROLL}</span>
              <span className="gm-wa-time">10:15 a. m.</span>
            </div>
          </div>
        </div>
        {/* registro facial (enroll de /e/{code}) */}
        <div ref={reg("idle")} className="gm-scr gm-en" style={{ display: "none" }}>
          <EnrollTop />
          <div className="gm-en-idle">
            <div className="gm-en-icon">◎</div>
            <h1>Registra tu rostro</h1>
            <p>La cámara de tu celular hace la prueba de vida. Cada gesto aparece cuando te toca.</p>
            <div ref={reg("enStart")} className="gm-en-btn">Iniciar reconocimiento</div>
          </div>
        </div>
        <div ref={reg("verify")} className="gm-scr gm-en" style={{ display: "none" }}>
          <EnrollTop />
          <div className="gm-g5-cam"><i /><span ref={reg("enFlag")}>Mira a la cámara</span></div>
        </div>
        <div ref={reg("ok")} className="gm-scr gm-en" style={{ display: "none" }}>
          <EnrollTop />
          <div className="gm-result">
            <h4>✔ Registro exitoso</h4>
            <div className="detail">La verificación de vida y la captura facial se completaron. Ya puedes entrar al gimnasio con tu rostro.</div>
          </div>
        </div>
      </div>
    </Html>
  );
}

function EnrollTop() {
  return (
    <header className="gm-en-top">
      <div className="brand">
        <img src="/brand/vx-icon-color.svg" alt="" />
        <div className="wordmark"><b>VISIONYX</b><span>Registro facial</span></div>
      </div>
      <span className="who"><b>{ANA.nombre}</b></span>
    </header>
  );
}

/* ---------- /ingreso (tableta del invitado sin celular) y Accesos ---------- */
export function IngresoPanel({ tour }: { tour: Tour }) {
  const root = useRef<HTMLDivElement>(null);
  const acc = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const { size } = useThree();
  const ad = isAd();
  useFrame(() => {
    const ch5 = tour.active && tour.chapter === 5;
    const ph = tour.phase;
    const t = tour.phaseT;
    const F = f.current;
    // rótulo superior
    const c = cap.current;
    if (c) {
      let txt = "";
      let ok = false;
      if (ch5 && ph === "ana_gate") txt = "Ana ya registró su rostro con el enlace: entra sin celular en la mano";
      if (ch5 && (ph === "gate_g" || (ph === "ana_in" && t < 2.4))) {
        txt = "✔ Entrada autorizada · Ana Torres, invitada de Valentina";
        ok = true;
      }
      if (ch5 && ph === "to_pin") txt = "Camilo no tiene celular: usa el PIN en la tableta de ingreso";
      if (ch5 && ph === "camilo_in") {
        txt = "El PIN abrió una sola vez. La invitación expiró en ese momento";
        ok = true;
      }
      c.style.display = txt ? "" : "none";
      c.className = `gm-m4-cap${ok ? " ok" : ""}`;
      c.textContent = txt;
      c.style.left = `${size.width / 2}px`;
    }
    // teclado /ingreso
    const el = root.current;
    if (el) {
      const on = ch5 && ph === "pin";
      el.style.display = on ? "" : "none";
      if (on) {
        place(el, size, ad, t, true, 620, 300);
        const n = KP.d.filter((d) => t >= d).length;
        for (let i = 0; i < 4; i++) {
          const b = F[`d${i}`]!;
          b.textContent = i < n ? PIN_CAM[i] : "0";
          b.classList.toggle("on", i < n);
        }
        for (let i = 0; i < 4; i++) F[`k${PIN_CAM[i]}`]?.classList.toggle("gm-press", t > KP.d[i] - 0.18 && t < KP.d[i] + 0.05);
        F.kok!.classList.toggle("gm-press", t > KP.ok && t < KP.ok + 0.3);
        show(F.keys, t < KP.receipt, "block");
        show(F.rec, t >= KP.receipt, "block");
        show(F.chip, !ad, "block");
        F.chip!.textContent = t < KP.receipt ? "Tableta de ingreso · /ingreso" : "PIN usado: la puerta abrió una vez";
      }
    }
    // Accesos (recepción)
    const a = acc.current;
    if (a) {
      const on = ch5 && ph === "ledger" && t >= LEDGER_PHONE;
      a.style.display = on ? "" : "none";
      if (on) {
        place(a, size, ad, t - LEDGER_PHONE, true, 420, 520);
        show(F.aChip, !ad, "block");
      }
    }
  });
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "Entrar"];
  return (
    <>
      <Html calculatePosition={fixedPos} zIndexRange={[73, 72]} style={{ pointerEvents: "none" }}>
        <div ref={cap} className="gm-m4-cap" style={{ display: "none" }} />
      </Html>
      <Html calculatePosition={fixedPos} zIndexRange={[70, 60]} style={{ pointerEvents: "none" }}>
        <div ref={root} className="gm-phone gm-p2 gm-tab5" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
          <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
          <div className="gm-scr gm-ing" style={{ display: "flex" }}>
            <div className="k">VISIONYX</div>
            <h1>Ingreso de invitado</h1>
            <p>La cámara reconoce el rostro. Si no hay rostro, este PIN abre una sola vez y la invitación expira en ese momento.</p>
            <div ref={reg("keys")}>
              <div className="gm-ing-pin">{[0, 1, 2, 3].map((i) => <span key={i} ref={reg(`d${i}`)}>0</span>)}</div>
              <div className="gm-ing-keys">
                {keys.map((k) => <span key={k} ref={reg(k === "Entrar" ? "kok" : `k${k}`)}>{k}</span>)}
              </div>
            </div>
            <div ref={reg("rec")} className="gm-ing-rec" style={{ display: "none" }}>
              <div className="k2">Ingreso registrado</div>
              <div className="n">{CAM.nombre}</div>
              <div className="d">{CAM.doc}</div>
              <div className="o">De parte de {P.nombre}</div>
              <div className="d">Quedan 2 de 4 entradas en ese pase</div>
              <p>Esta invitación ya expiró. No vuelve a abrir.</p>
              <div className="again">Otro ingreso</div>
            </div>
          </div>
        </div>
      </Html>
      <Html calculatePosition={fixedPos} zIndexRange={[68, 58]} style={{ pointerEvents: "none" }}>
        <div ref={acc} className="gm-3dpanel gm-coach gm-caja" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%", width: 520 }}>
          <div ref={reg("aChip")} className="gm-phone-chip" style={{ display: "none" }}>Accesos: el invitado queda a nombre de quien invitó</div>
          <div className="gm-3dpanel-top">
            <img src="/brand/vx-icon-color.svg" alt="" className="h-6 w-6" />
            <span className="font-bold text-white">Accesos</span>
            <span className="text-gym-muted">· VISIONYX Norte</span>
            <span className="ml-auto rounded-full border border-gym-border px-2 py-0.5 text-[10px] text-gym-muted">Recepción</span>
          </div>
          <div className="gm-co">
            <div className="gm-co-sec">Registro</div>
            <div className="gm-co-li"><b>Invitado · Entrada autorizada</b><span>De {P.nombre} · Membresía vigente · rostro reconocido · hace 3 min</span></div>
            <div className="gm-co-li"><b>Andrés Gómez · Entrada autorizada</b><span>Membresía vigente · rostro reconocido · hace 6 min</span></div>
            <div className="gm-co-tip">El ingreso con PIN abre la puerta una vez y queda en el registro de invitados de la app de {P.first}: «Ingresó por PIN · de parte de {P.nombre}».</div>
          </div>
        </div>
      </Html>
    </>
  );
}
