"use client";

/**
 * Pantallas del recorrido "Membresía vencida" (Parte 4). Textos del código real:
 *  - Aviso por WhatsApp (app/api/memberships/avisos/route.ts): "Hola {nombre}. Tu plan {plan} vence {mañana} ({fin}).
 *    Renueva en recepción para seguir entrando." Se manda desde Membresías a planes activos que vencen en 0-7 días.
 *  - Kiosko del torniquete (access/backend/public/assets/kiosk.js): "✕ ACCESO DENEGADO" + "Membresía vencida o sin plan"
 *    y la voz "Acceso denegado. Tu membresía está vencida. Pasa por recepción."
 *  - Accesos (app/accesos/page.tsx): "Requieren atención" → "Socio rechazado" · "Membresía vencida" · "Renovar membresía".
 *  - Membresías (app/membresias/page.tsx): insignia "Vencida", "Mensual · Vencida hace 2 días · $120.000", botón
 *    "Renovar · $120.000" (con el plan vencido abre "Cambiar plan"), "Empieza hoy. No queda un plan vigente que conservar.",
 *    "Nueva vigencia: … → …", Cobrar ahora · efectivo, "Confirmar y cobrar" →
 *    "Cobrado en caja. La puerta ya respeta la vigencia nueva."
 *  Fechas: Mensual del 12 nov 2026 (Parte 1) vence el 11 dic (fin = inicio + 29 días). Nada se envía de verdad.
 * App del socio (gym-mobile, Android/iOS): login documento + WhatsApp + código (login_screen.dart),
 * Inicio _AccessCard, Planes "Pagar" con Wompi (plans_screen.dart, api/mobile/pagos, approveMobilePayment → setDoorUntil).
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TOUR_PERSON, type Tour } from "../../lib/gemelo/tour";

const P = TOUR_PERSON;
const show = (el: HTMLElement | null | undefined, v: boolean, disp = "") => {
  if (el) el.style.display = v ? disp : "none";
};
const fixedPos = (() => [0, 0]) as any;
const isAd = () => typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search);
export const AVISO_TXT = `Hola ${P.first}. Tu plan Mensual vence mañana (2026-12-11). Renueva en recepción para seguir entrando.`;

/* ---------- Celular: WhatsApp del gimnasio y la app VISIONYX (Android / iOS, gym-mobile) ---------- */

const OTP = "482913";
const typed = (str: string, t: number, t0: number, t1: number) => (t <= t0 ? "" : t >= t1 ? str : str.slice(0, Math.floor(((t - t0) / (t1 - t0)) * str.length)));
/** tiempos (s) de la fase "login" (features/auth/login_screen.dart) */
const LG = { doc0: 0.8, doc1: 1.8, wa0: 2.0, wa1: 3.0, send: 3.3, otp: 4.2, notif0: 4.4, notif1: 6.4, code0: 5.6, code1: 6.6, verify: 7.0, home: 7.6 };
/** tiempos (s) de la fase "wompi" (features/plans/plans_screen.dart + api/mobile/pagos) */
const WP = { tabPlanes: 1.2, plans: 1.6, pay: 3.6, opening: 4.0, wompi: 4.8, wpay: 6.4, wok: 7.0, ret: 8.6, back: 10.2, pull0: 11.0, pull1: 11.8, home: 13.8 };

function FlField({ label, v, focus }: { label: string; v: React.Ref<HTMLDivElement>; focus?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={focus} className="gm-fl-field">
      <label>{label}</label>
      <div ref={v}> </div>
    </div>
  );
}

function FlNav({ on, reg }: { on: string; reg?: (k: string) => (el: HTMLElement | null) => void }) {
  return (
    <div className="gm-fl-nav">
      {[["⌂", "Inicio"], ["▭", "Planes"], ["⚲", "Entreno"], ["⚇", "Invitados"]].map(([i, l]) => (
        <span key={l} ref={reg ? reg(`nav${l}`) : undefined} className={l === on ? "on" : ""}><i>{i}</i>{l}</span>
      ))}
    </div>
  );
}

export function PhoneAviso({ tour }: { tour: Tour }) {
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
    const on = tour.active && tour.chapter === 4 && (ph === "aviso" || ph === "login" || ph === "wompi");
    el.style.display = on ? "" : "none";
    if (!on) return;
    const t = tour.phaseT;
    const portrait = size.width < size.height;
    const fitInteractive = !ad && portrait;
    const avail = size.height - 64 - 176 - 44;
    const s = fitInteractive
      ? Math.min(avail / 620, (size.width * 0.92) / 300)
      : portrait
        ? Math.min((size.height * 0.75) / 620, (size.width * 0.92) / 300)
        : Math.min((size.height * 0.84) / 620, (size.width * 0.5) / 300);
    const tx = portrait ? size.width * 0.5 : size.width * 0.66;
    const ty = fitInteractive ? 64 + 44 + (620 * s) / 2 : portrait ? size.height * 0.595 : size.height * 0.5;
    const enter = ph !== "wompi";
    const ie = enter ? 1 - Math.pow(1 - Math.min(1, t / 0.6), 3) : 1;
    const outA = ph === "login" ? 1 : Math.max(0, 1 - Math.max(0, t - (tour.phaseDur - 0.45)) / 0.45);
    el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 140}px) translate(-50%,-50%) scale(${s * (0.9 + 0.1 * ie)})`;
    el.style.opacity = String(Math.min(ie * 1.3, outA));
    const F = f.current;
    // pantalla visible
    let scr = "wa";
    if (ph === "login") scr = t < LG.home ? "login" : "home";
    if (ph === "wompi") scr = t < WP.plans ? "home" : t < WP.wompi ? "plans" : t < WP.ret ? "wompi" : t < WP.back ? "ret" : t < WP.home ? "plans" : "home";
    for (const k of ["wa", "login", "home", "plans", "wompi", "ret"]) show(F[k], k === scr, "flex");
    show(F.chip, !ad, "block");
    F.chip!.textContent =
      ph === "aviso"
        ? "WhatsApp del gimnasio · recordatorio antes de vencer"
        : ph === "login"
          ? t < LG.home ? "App VISIONYX (Android y iOS) · entra con documento y WhatsApp" : "App · Inicio: «Membresía vencida»"
          : scr === "wompi"
            ? "Pasarela Wompi · simulada en el demo"
            : scr === "ret" ? "Vuelve a la app" : t < WP.home ? "App · Planes: paga con Wompi" : "App · Inicio: «Puede entrar»";
    if (ph === "aviso") {
      show(F.notif, t > 0.9 && t < 2.8, "flex");
      show(F.bubble, t > 2.6, "block");
    }
    if (ph === "login") {
      const otp = t >= LG.otp;
      F.lDoc!.textContent = typed(P.doc, t, LG.doc0, LG.doc1) || " ";
      F.lWa!.textContent = typed(P.cel.replace(/\s/g, ""), t, LG.wa0, LG.wa1) || " ";
      F.lDocF!.classList.toggle("on", t > LG.doc0 - 0.2 && t < LG.doc1 + 0.1);
      F.lWaF!.classList.toggle("on", t > LG.wa0 - 0.1 && t < LG.wa1 + 0.1);
      F.lDocF!.classList.toggle("dis", otp);
      F.lWaF!.classList.toggle("dis", otp);
      F.lDesc!.textContent = otp ? "Te enviamos un código por WhatsApp. Escríbelo para entrar." : "Entra con el documento y el WhatsApp de tu ficha. Te mandaremos un código de verificación.";
      show(F.lCodeF, otp, "block");
      F.lCode!.textContent = typed(OTP, t, LG.code0, LG.code1) || " ";
      F.lCodeF!.classList.toggle("on", t > LG.code0 - 0.2 && t < LG.code1 + 0.1);
      F.lBtn!.textContent = (t > LG.send + 0.3 && t < LG.otp) || t > LG.verify + 0.3 ? "Espera…" : otp ? "Verificar código" : "Enviar código";
      F.lBtn!.classList.toggle("gm-press", (t > LG.send && t < LG.send + 0.3) || (t > LG.verify && t < LG.verify + 0.3));
      show(F.lChange, otp, "block");
      show(F.otpN, t > LG.notif0 && t < LG.notif1, "flex");
    }
    const homeOk = ph === "wompi" && t >= WP.home;
    F.hLabel!.textContent = homeOk ? "Puede entrar" : "Membresía vencida";
    F.hDetail!.textContent = homeOk ? "Mensual · hasta 2027-01-11 · 29 días" : "Mensual · hasta 2026-12-11";
    if (ph === "wompi") {
      F.navPlanes!.classList.toggle("gm-tap2", t > WP.tabPlanes - 0.3 && t < WP.plans);
      F.payBtn!.classList.toggle("gm-press", t > WP.pay && t < WP.pay + 0.35);
      F.payBtn!.textContent = t > WP.opening && t < WP.wompi ? "Abriendo Wompi…" : "Pagar";
      F.payBtn!.classList.toggle("busy", t > WP.opening && t < WP.wompi);
      show(F.notice, t >= WP.back && t < WP.pull1, "block");
      show(F.pull, t >= WP.pull0 && t < WP.pull1, "flex");
      show(F.pagos, t >= WP.pull1, "block");
      F.wBtn!.classList.toggle("gm-press", t > WP.wpay - 0.35 && t < WP.wpay);
      show(F.wForm, t < WP.wok, "block");
      show(F.wOk, t >= WP.wok, "block");
      // desplaza hasta Mensual; al volver arriba (aviso); tras deslizar, baja a PAGOS (va al final de la lista)
      const L = F.plansList!;
      const end = Math.max(0, L.scrollHeight - (L.parentElement?.clientHeight || 0));
      const y = t < WP.back ? 150 * Math.max(0, Math.min(1, (t - WP.plans - 0.4) / 0.6)) : t < WP.pull1 + 0.1 ? 0 : end * Math.min(1, (t - WP.pull1 - 0.1) / 0.7);
      L.style.transform = `translateY(${-y}px)`;
    }
    for (const k of ["navInicio", "navPlanes"]) F[k]?.classList.remove("on");
    if (scr === "plans") F.navPlanes?.classList.add("on");
    else F.navInicio?.classList.add("on");
  });
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[70, 60]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-phone gm-p2" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
        <div className="gm-phone-notch" />
        <div className="gm-phone-status"><span>9:00</span><span>●●● 5G ▮</span></div>
        {/* WhatsApp del gimnasio: recordatorio (api/memberships/avisos) */}
        <div ref={reg("wa")} className="gm-scr gm-wa">
          <div ref={reg("notif")} className="gm-wa-notif" style={{ display: "none" }}>
            <div className="gm-wa-ico">✆</div>
            <div><b>VISIONYX</b><span>Hola {P.first}. Tu plan Mensual vence mañana…</span></div>
          </div>
          <div className="gm-wa-head">
            <span className="gm-wa-back">‹</span>
            <img src="/brand/vx-icon-color.svg" alt="" />
            <div><b>VISIONYX</b><span>en línea</span></div>
          </div>
          <div className="gm-wa-input"><span>Mensaje</span><i>🎤</i></div>
          <div className="gm-wa-body">
            <div className="gm-wa-day">12 DE NOVIEMBRE DE 2026</div>
            <div className="gm-wa-bubble gm-wa-old">
              Hola, {P.first}.<br /><br />Bienvenido a VISIONYX.<br /><br />Tu ficha ya está en la aplicación. Ábrela y entra con tu documento y este WhatsApp.
              <span className="gm-wa-time">6:40 p. m.</span>
            </div>
            <div className="gm-wa-day">HOY</div>
            <div ref={reg("bubble")} className="gm-wa-bubble" style={{ display: "none" }}>
              {AVISO_TXT}
              <span className="gm-wa-time">9:00 a. m.</span>
            </div>
          </div>
        </div>
        {/* App · login_screen.dart */}
        <div ref={reg("login")} className="gm-scr gm-fl" style={{ display: "none" }}>
          <div ref={reg("otpN")} className="gm-wa-notif" style={{ display: "none" }}>
            <div className="gm-wa-ico">✆</div>
            <div><b>VISIONYX · WhatsApp</b><span>Tu código de acceso al gimnasio es {OTP}. Vence en 10 minutos.</span></div>
          </div>
          <div className="gm-fl-pad" style={{ paddingTop: 34 }}>
            <div className="gm-fl-kick">VISIONYX</div>
            <div className="gm-fl-h1">Tu pase</div>
            <div ref={reg("lDesc")} className="gm-fl-desc">Entra con el documento y el WhatsApp de tu ficha. Te mandaremos un código de verificación.</div>
            <FlField label="Documento" v={reg("lDoc")} focus={reg("lDocF")} />
            <FlField label="WhatsApp" v={reg("lWa")} focus={reg("lWaF")} />
            <div ref={reg("lCodeF")} className="gm-fl-field" style={{ display: "none" }}><label>Código WhatsApp</label><div ref={reg("lCode")}> </div></div>
            <div ref={reg("lBtn")} className="gm-fl-btn">Enviar código</div>
            <div ref={reg("lChange")} className="gm-fl-text" style={{ display: "none" }}>Cambiar documento</div>
          </div>
        </div>
        {/* App · Inicio (home_screen.dart) */}
        <div ref={reg("home")} className="gm-scr gm-fl" style={{ display: "none" }}>
          <div className="gm-fl-bar"><span>⋮</span><b>VISIONYX</b></div>
          <div className="gm-fl-pad">
            <div className="gm-fl-h2">{P.nombre}</div>
            <div className="gm-fl-card fill">
              <div ref={reg("hLabel")} className="gm-fl-acc">Membresía vencida</div>
              <div ref={reg("hDetail")}>Mensual · hasta 2026-12-11</div>
            </div>
            <div className="gm-fl-card">
              <div className="gm-fl-mut">Pase de invitados</div>
              <div className="gm-fl-big">0</div>
              <div className="gm-fl-mut2">de 0</div>
            </div>
            <div className="gm-fl-btn dis">Generar invitación</div>
            <div style={{ fontWeight: 700, marginTop: 14 }}>Últimos invitados</div>
            <div className="gm-fl-mut" style={{ marginTop: 6 }}>Todavía no hay invitaciones.</div>
          </div>
          <FlNav on="Inicio" reg={reg} />
        </div>
        {/* App · Planes (plans_screen.dart) */}
        <div ref={reg("plans")} className="gm-scr gm-fl" style={{ display: "none" }}>
          <div className="gm-fl-bar"><span>⋮</span><b>VISIONYX</b></div>
          <div ref={reg("pull")} className="gm-fl-pull" style={{ display: "none" }}><i /></div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div ref={reg("plansList")} className="gm-fl-pad" style={{ paddingTop: 8 }}>
              <div className="gm-fl-kick2">PLANES</div>
              <div className="gm-fl-h1" style={{ fontSize: 25 }}>Elige cómo entras</div>
              <div className="gm-fl-desc" style={{ marginBottom: 6 }}>El cobro lo hace Wompi. El plan queda activo solo cuando el pago está aprobado.</div>
              <div ref={reg("notice")} className="gm-fl-notice" style={{ display: "none" }}>Termina el pago en Wompi. Al volver, desliza para actualizar.</div>
              {[["1 DÍA", "Pase del día", "$15.000", "Acceso durante el día de la compra."], ["30 DÍAS", "Mensual", "$120.000", "Acceso continuo por 30 días."], ["90 DÍAS", "Trimestral", "$320.000", "Acceso continuo por 90 días."], ["365 DÍAS", "Anual", "$990.000", "Acceso continuo por 365 días."]].map(([chip, n, p, sp]) => (
                <div key={n} className="gm-fl-plan">
                  <div className="row"><span className="chip">{chip}</span><span className="kind">MEMBRESÍA</span></div>
                  <div className="n">{n}</div>
                  <div className="p">{p}</div>
                  <div className="sp">{sp}</div>
                  <div ref={n === "Mensual" ? reg("payBtn") : undefined} className="gm-fl-paybtn">Pagar</div>
                </div>
              ))}
              <div ref={reg("pagos")} style={{ display: "none" }}>
                <div className="gm-fl-kick2" style={{ marginTop: 8 }}>PAGOS</div>
                <div className="gm-fl-pay"><div><b>Mensual</b><em>Aprobado</em></div><b>$120.000</b></div>
              </div>
            </div>
          </div>
          <FlNav on="Planes" reg={reg} />
        </div>
        {/* Pasarela Wompi (externa; en el demo solo se simula la aprobación) */}
        <div ref={reg("wompi")} className="gm-scr gm-wp" style={{ display: "none" }}>
          <div className="gm-wp-url">🔒 checkout.wompi.co</div>
          <div className="gm-wp-body">
            <div className="gm-wp-brand">Wompi</div>
            <div className="gm-wp-demo">Simulación del demo · no se cobra nada</div>
            <div className="gm-wp-k">Pagas a</div>
            <div className="gm-wp-v">VISIONYX · Mensual</div>
            <div className="gm-wp-amt">$120.000</div>
            <div ref={reg("wForm")}>
              <div className="gm-wp-k" style={{ marginTop: 10 }}>Medio de pago</div>
              <div className="gm-wp-opt">Tarjeta · PSE · Nequi (los que el comercio tenga activos)</div>
              <div ref={reg("wBtn")} className="gm-wp-btn">Pagar $120.000</div>
            </div>
            <div ref={reg("wOk")} className="gm-wp-ok" style={{ display: "none" }}>✔ Transacción aprobada<br /><span>(simulada en el demo)</span></div>
          </div>
        </div>
        {/* Retorno (api/mobile/pagos/retorno) */}
        <div ref={reg("ret")} className="gm-scr gm-fl" style={{ display: "none", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <div className="gm-fl-pad">
            <div className="gm-fl-h1" style={{ fontSize: 22 }}>Pago enviado a Wompi</div>
            <div className="gm-fl-desc">Vuelve a la app y desliza hacia abajo. El plan queda activo solo si Wompi lo aprueba.</div>
            <div className="gm-fl-mut">VX-MOV-20261213-0042</div>
          </div>
        </div>
      </div>
    </Html>
  );
}

/* ---------- Rótulos de la puerta + paneles de Accesos y Membresías ---------- */

const PH: Record<string, string> = { accesos: "Accesos", renew: "Membresías" };
const CHIP: Record<string, string> = {
  accesos: "Accesos: el rechazo queda en «Requieren atención»",
  renew: "Membresías: renovar y cobrar en caja",
};

export function MembresiaPanel({ tour }: { tour: Tour }) {
  const root = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const { size } = useThree();
  const ad = isAd();
  useFrame(() => {
    const ch4 = tour.active && tour.chapter === 4;
    const ph = tour.phase;
    const t = tour.phaseT;
    const F = f.current;
    // rótulo superior: fecha y lo que dice el kiosko
    const c = cap.current;
    if (c) {
      const day = ch4 && ph === "to_gate" && t < 3.2;
      const deny = ch4 && ph === "gate_deny" && t > 1.2;
      const okc = ch4 && (ph === "back_gate" || (ph === "gate" && t < 2.4));
      c.style.display = day || deny || okc ? "" : "none";
      c.className = `gm-m4-cap${deny ? " deny" : okc ? " ok" : ""}`;
      show(F.cDay, day, "block");
      show(F.cDeny, deny, "block");
      show(F.cOk, okc, "block");
      c.style.left = `${size.width / 2}px`;
    }
    const el = root.current;
    if (!el) return;
    const on = ch4 && ph in PH;
    el.style.display = on ? "" : "none";
    if (!on) return;
    const portrait = size.width < size.height;
    const fitInteractive = !ad && portrait;
    const PW = portrait ? 400 : 600;
    const PHh = portrait ? 610 : 560;
    el.classList.toggle("gm-coach-p", portrait);
    el.style.width = `${PW}px`;
    el.style.height = `${PHh}px`;
    const s = fitInteractive
      ? Math.min((size.height - 64 - 176 - 44) / PHh, (size.width * 0.95) / PW)
      : portrait
        ? Math.min((size.height * 0.68) / PHh, (size.width * 0.94) / PW)
        : Math.min((size.height * 0.84) / PHh, (size.width * 0.56) / PW);
    const tx = portrait ? size.width * 0.5 : size.width * 0.64;
    const ty = fitInteractive ? 64 + 44 + (PHh * s) / 2 : portrait ? size.height * 0.615 : size.height * 0.5;
    const first = ph === "accesos";
    const ie = first ? 1 - Math.pow(1 - Math.min(1, t / 0.6), 3) : 1;
    el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 120}px) translate(-50%,-50%) scale(${s * (0.92 + 0.08 * ie)})`;
    el.style.opacity = String(Math.min(1, ie * 1.3));
    show(F.acc, ph === "accesos", "block");
    show(F.mem, ph === "renew", "block");
    F.mod!.textContent = PH[ph];
    show(F.chip, !ad, "block");
    F.chip!.textContent = CHIP[ph];
    if (ph === "accesos") {
      F.att!.style.opacity = String(Math.min(1, Math.max(0, (t - 0.7) / 0.4)));
      F.log0!.style.opacity = String(Math.min(1, Math.max(0, (t - 1.4) / 0.4)));
      F.alt!.style.opacity = String(Math.min(1, Math.max(0, (t - 3.2) / 0.5)));
    }
    if (ph === "renew") {
      // 1.2 Renovar · 2.4 Mensual · 3.0 vigencia · 4.4 efectivo · 6.0 Confirmar y cobrar · 6.4 aviso · 7.0 Vigente
      const paid = t >= 6.4;
      F.btnRen!.classList.toggle("gm-press", t > 1.0 && t < 1.4);
      show(F.open, t > 1.4 && !paid, "block");
      F.pMen!.classList.toggle("on", t > 2.4);
      show(F.vig, t > 3.0, "block");
      F.ef!.classList.toggle("on", t > 4.4);
      F.conf!.classList.toggle("gm-press", t > 5.8 && t < 6.2);
      show(F.ok, paid, "block");
      const vig = t >= 7.0;
      F.badge!.textContent = vig ? "Vigente" : "Vencida";
      F.badge!.className = `gm-m4-badge ${vig ? "ok" : "err"}`;
      F.det!.textContent = vig ? "Mensual · 29 días restantes · $120.000" : "Mensual · Vencida hace 2 días · $120.000";
      show(F.btnRen, !paid, "inline-block");
      show(F.after, vig, "block");
    }
  });
  return (
    <>
      <Html calculatePosition={fixedPos} zIndexRange={[73, 72]} style={{ pointerEvents: "none" }}>
        <div ref={cap} className="gm-m4-cap" style={{ display: "none" }}>
          <div ref={reg("cDay")}>Domingo 13 dic · dos días después del vencimiento</div>
          <div ref={reg("cDeny")}>
            <b>✕ ACCESO DENEGADO</b> · Membresía vencida o sin plan
            <span>🔊 «Acceso denegado. Tu membresía está vencida. Pasa por recepción.»</span>
          </div>
          <div ref={reg("cOk")}>Vuelve a la puerta: ya respeta la vigencia nueva</div>
        </div>
      </Html>
      <Html calculatePosition={fixedPos} zIndexRange={[68, 58]} style={{ pointerEvents: "none" }}>
        <div ref={root} className="gm-3dpanel gm-coach gm-caja" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
          <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
          <div className="gm-3dpanel-top">
            <img src="/brand/vx-icon-color.svg" alt="" className="h-6 w-6" />
            <span ref={reg("mod")} className="font-bold text-white">Accesos</span>
            <span className="text-gym-muted">· VISIONYX Norte</span>
            <span className="ml-auto rounded-full border border-gym-border px-2 py-0.5 text-[10px] text-gym-muted">Recepción</span>
          </div>
          {/* Accesos (app/accesos) */}
          <div ref={reg("acc")} className="gm-co">
            <div className="gm-co-sec" style={{ marginBottom: 2 }}>Requieren atención</div>
            <div className="gm-co-tip" style={{ marginTop: 0 }}>Personas conocidas que hoy no pudieron entrar. Una cara desconocida queda solo en el registro de abajo.</div>
            <div ref={reg("att")} className="gm-m4-att">
              <div className="k">Socio rechazado</div>
              <div className="n">{P.nombre}</div>
              <div className="w">Membresía vencida</div>
              <span ref={reg("ren")} className="gm-m4-link">Renovar membresía</span>
            </div>
            <div ref={reg("alt")} className="gm-co-tip" style={{ opacity: 0 }}>Dos caminos para renovar: en recepción (Membresías → Renovar y cobrar en caja) o ella misma desde la app del socio, pagando con Wompi. Aquí sigue el de la app.</div>
            <div className="gm-cj-kv" style={{ marginTop: 10 }}><span>Hoy</span><b>214 concedidos · 3 denegados</b></div>
            <div className="gm-co-sec" style={{ marginTop: 10 }}>Registro</div>
            <div ref={reg("log0")} className="gm-co-li"><b>{P.nombre} · Acceso rechazado</b><span>Membresía vencida · Torniquete 2 · ahora</span></div>
            <div className="gm-co-li"><b>Andrés Gómez · Entrada autorizada</b><span>Membresía vigente · rostro reconocido · hace 2 min</span></div>
          </div>
          {/* Membresías (app/membresias) */}
          <div ref={reg("mem")} className="gm-co" style={{ display: "none" }}>
            <div className="gm-m4-card">
              <div className="row">
                <div className="av">V</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="n">{P.nombre}</div>
                  <div className="d">{P.docTipo} {P.doc}</div>
                </div>
                <span ref={reg("badge")} className="gm-m4-badge err">Vencida</span>
              </div>
              <p ref={reg("det")} className="det">Mensual · Vencida hace 2 días · $120.000</p>
              <div className="gm-co-row" style={{ marginTop: 6 }}>
                <span ref={reg("btnRen")} className="gm-co-btn pri">Renovar · $120.000</span>
                <span className="gm-co-btn">Ver ficha</span>
                <span className="gm-co-btn">WhatsApp</span>
              </div>
              <div ref={reg("open")} style={{ display: "none" }}>
                <div className="gm-co-sec" style={{ marginTop: 10 }}>Cambiar plan</div>
                <div className="gm-m4-plans">
                  {[["Pase del día", "$15.000", "1 día"], ["Mensual", "$120.000", "30 días"], ["Trimestral", "$320.000", "90 días"], ["Anual", "$990.000", "365 días"]].map(([n, p, d]) => (
                    <div key={n} ref={n === "Mensual" ? reg("pMen") : undefined}><em>{n}</em><b>{p}</b><span>{d}</span></div>
                  ))}
                </div>
                <div ref={reg("vig")} className="gm-co-tip" style={{ display: "none" }}>
                  Empieza hoy. No queda un plan vigente que conservar.<br /><b style={{ color: "#fff" }}>Nueva vigencia: 13 dic 2026 → 11 ene 2027.</b>
                </div>
                <div className="gm-cj-sel" style={{ marginTop: 8 }}><span className="on">◉ Cobrar ahora</span><span>○ Registrar como pendiente</span></div>
                <div className="gm-cj-sel" style={{ marginTop: 6 }}><span ref={reg("ef")}>efectivo</span><span>tarjeta</span><span>transferencia</span></div>
                <div className="gm-co-row"><span ref={reg("conf")} className="gm-co-btn pri">Confirmar y cobrar</span><span className="gm-co-btn">Cerrar</span></div>
              </div>
              <div ref={reg("ok")} className="gm-co-msg ok" style={{ display: "none" }}>Cobrado en caja. La puerta ya respeta la vigencia nueva.</div>
              <div ref={reg("after")} className="gm-co-tip" style={{ display: "none" }}>Desde la app del socio también se puede pagar el plan con Wompi, si el gimnasio lo conectó.</div>
            </div>
          </div>
        </div>
      </Html>
    </>
  );
}
