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

/* ---------- Celular: el aviso de vencimiento por WhatsApp ---------- */

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
    const on = tour.active && tour.chapter === 4 && tour.phase === "aviso";
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
    const ie = 1 - Math.pow(1 - Math.min(1, t / 0.6), 3);
    const outA = Math.max(0, 1 - Math.max(0, t - (tour.phaseDur - 0.45)) / 0.45);
    el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 140}px) translate(-50%,-50%) scale(${s * (0.9 + 0.1 * ie)})`;
    el.style.opacity = String(Math.min(ie * 1.3, outA));
    const F = f.current;
    show(F.chip, !ad, "block");
    show(F.notif, t > 0.9 && t < 2.8, "flex");
    show(F.bubble, t > 2.6, "block");
  });
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[70, 60]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-phone gm-p2" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }}>Jueves 10 dic · aviso de vencimiento</div>
        <div className="gm-phone-notch" />
        <div className="gm-phone-status"><span>9:00</span><span>●●● 5G ▮</span></div>
        <div className="gm-scr gm-wa" style={{ display: "flex" }}>
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
      F.ren!.classList.toggle("gm-press", t > 4.6 && t < 5.0);
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
