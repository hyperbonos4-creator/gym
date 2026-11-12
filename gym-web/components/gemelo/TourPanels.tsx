"use client";

/**
 * Pantallas del recorrido "Inscripción":
 *  - ClientesPanel3D: el formulario real de Clientes (SocioForm) flotando en 3D
 *    sobre recepción, que se llena solo con datos inventados, el resultado
 *    "Cliente creado" y la asignación de membresía (Mensual $120.000).
 *  - PhoneOverlay: el celular del socio con el mensaje de WhatsApp (texto de
 *    enrollMessage), la página /e/{code} y el registro facial guiado real
 *    (enroll.html / enroll.js): Registra tu rostro → Iniciar reconocimiento →
 *    Mira al frente / Gira a la izquierda / Gira a la derecha / Parpadea →
 *    Verificando… → ✔ Registro exitoso.
 * Nada se envía: es una representación visual (no toca WhatsApp ni Evolution).
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { GemeloSim } from "../../lib/gemelo/sim";
import { TOUR_PERSON, type Tour } from "../../lib/gemelo/tour";

const P = TOUR_PERSON;
const fieldCls = "rounded-xl border border-gym-border bg-gym-navy/80 px-3.5 py-2.5 text-sm text-gym-silver";
const labelCls = "text-xs font-semibold text-gym-muted";
const secCls = "mb-2 text-[11px] font-bold uppercase tracking-wider text-gym-muted";

function typed(s: string, t: number, t0: number, t1: number) {
  if (t <= t0) return "";
  if (t >= t1) return s;
  return s.slice(0, Math.floor(((t - t0) / (t1 - t0)) * s.length + 0.0001));
}

const show = (el: HTMLElement | null, v: boolean, disp = "") => {
  if (el) el.style.display = v ? disp : "none";
};

/* ------------------------------------------------------------------ */

export function ClientesPanel3D({ sim, tour }: { sim: GemeloSim; tour: Tour }) {
  const grp = useRef<THREE.Group>(null!);
  const root = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  useFrame(() => {
    const L = sim.layout;
    const on = tour.active && (tour.phase === "form" || tour.phase === "registered" || tour.phase === "plan" || (tour.phase === "walk_in" && tour.phaseDur - tour.phaseT < 1.2));
    grp.current.visible = on;
    const el = root.current;
    if (!el) return;
    el.style.display = on ? "" : "none";
    if (!on) return;
    grp.current.position.set(L.reception.x - 0.4 * L.mirror, 2.55, L.reception.z + 0.2);
    grp.current.rotation.set(-0.04, -0.35 * L.mirror, 0);
    const F = f.current;
    // aparición
    let a = 1;
    if (tour.phase === "walk_in") a = Math.max(0, 1 - (tour.phaseDur - tour.phaseT) / 1.2);
    el.style.opacity = String(Math.min(1, a * 1.4));
    el.style.transform = `translateY(${(1 - a) * 40}px) scale(${0.94 + 0.06 * a})`;
    const t = tour.phase === "form" ? tour.nt : tour.phase === "walk_in" ? 0 : 99;
    show(F.form, tour.phase === "form" || tour.phase === "walk_in");
    show(F.done, tour.phase === "registered");
    show(F.plan, tour.phase === "plan");
    if (tour.phase === "form" || tour.phase === "walk_in") {
      const doc = typed(P.doc, t, 0.3, 1.4);
      const nom = typed(P.nombre, t, 1.7, 3.4);
      const cel = typed(P.cel, t, 3.6, 4.8);
      const mail = typed(P.email, t, 5.0, 6.3);
      const caret = (on: boolean) => (on && Math.floor(t * 3) % 2 === 0 ? "|" : "");
      F.doc!.textContent = doc + caret(t > 0.2 && t < 1.6);
      F.nom!.textContent = nom + caret(t >= 1.6 && t < 3.5);
      F.cel!.textContent = cel + caret(t >= 3.5 && t < 4.9);
      F.mail!.textContent = mail + caret(t >= 4.9 && t < 6.4);
      for (const k of ["doc", "nom", "cel", "mail"]) {
        const v = (F[k]!.textContent || "").replace("|", "");
        F[k]!.classList.toggle("gm-ph-holder", !v);
        if (!v) F[k]!.textContent = (F[k] as HTMLElement).dataset.ph || "";
      }
      const active = t < 1.6 ? "docBox" : t < 3.5 ? "nomBox" : t < 4.9 ? "celBox" : t < 6.4 ? "mailBox" : "";
      for (const k of ["docBox", "nomBox", "celBox", "mailBox"]) F[k]?.classList.toggle("gm-focus", k === active);
      show(F.docOk, t > 1.5);
      show(F.preview, t > 1.75, "flex");
      F.pvName!.textContent = nom || "Nuevo cliente";
      F.pvSub!.textContent = `CC ${doc || "sin documento"}${cel ? ` · +57 ${cel}` : ""}`;
      F.pvIni!.textContent = (nom || "N").charAt(0).toUpperCase();
      show(F.celOk, t > 4.9);
      F.btn!.classList.toggle("gm-press", t > 6.5 && t < 6.85);
      F.btn!.textContent = t > 6.8 ? "Guardando y avisando…" : "Registrar cliente y avisar en la app";
    }
    if (tour.phase === "plan") {
      const pt = tour.nt;
      F.mensual!.classList.toggle("gm-sel", pt > 0.45);
      show(F.vig, pt > 0.5);
      F.pay!.classList.toggle("gm-sel", pt > 0.9);
      F.btn2!.classList.toggle("gm-press", pt > 1.3 && pt < 1.6);
      show(F.okPlan, pt > 1.65);
    }
  });
  return (
    <group ref={grp} visible={false}>
      <Html transform distanceFactor={1.55} zIndexRange={[30, 20]} style={{ pointerEvents: "none" }}>
        <div ref={root} className="gm-3dpanel" style={{ display: "none" }}>
          <div className="gm-3dpanel-top">
            <img src="/brand/vx-icon-color.svg" alt="" className="h-6 w-6" />
            <span className="font-bold text-white">Clientes</span>
            <span className="text-gym-muted">· VISIONYX Norte</span>
            <span className="ml-auto rounded-full border border-gym-border px-2 py-0.5 text-[10px] text-gym-muted">Recepción</span>
          </div>
          {/* --- Formulario real: Nuevo cliente (SocioForm, variante alta) --- */}
          <div ref={reg("form")} className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Nuevo cliente</h3>
              <span className="text-xs text-gym-muted">Cerrar</span>
            </div>
            <div className="mb-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Activación</div>
              <ol className="mt-2 grid grid-cols-4 gap-2">
                {[["1 Datos", "● Actual"], ["2 Rostro", "○ Pendiente"], ["3 Membresía", "○ Pendiente"], ["4 Acceso", "○ Bloqueado"]].map(([n, s]) => (
                  <li key={n} className="rounded-xl border border-gym-border/60 px-3 py-2">
                    <div className="text-xs font-bold text-white">{n}</div>
                    <div className={`text-[11px] ${s.startsWith("●") ? "text-gym-primary" : "text-gym-muted"}`}>{s}</div>
                  </li>
                ))}
              </ol>
            </div>
            <div className={secCls}>Identificación</div>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>Tipo de documento</span>
                <span className={`${fieldCls} flex justify-between`}>CC <span className="text-gym-muted">▾</span></span>
              </label>
              <label className="col-span-2 flex flex-col gap-1.5">
                <span className={labelCls}>Número de documento</span>
                <span ref={reg("docBox")} className={fieldCls}><span ref={reg("doc")} data-ph="Ej. 1032456789" /></span>
              </label>
            </div>
            <p ref={reg("docOk")} className="mt-2 text-xs text-status-ok" style={{ display: "none" }}>✓ No encontramos otro cliente con este documento.</p>
            <label className="mt-3 flex flex-col gap-1.5">
              <span className={labelCls}>Nombre completo *</span>
              <span ref={reg("nomBox")} className={fieldCls}><span ref={reg("nom")} data-ph="Ej. Laura Gómez Restrepo" /></span>
            </label>
            <div ref={reg("preview")} className="mt-3 items-center gap-3 rounded-2xl border border-gym-border/60 bg-gym-navy/40 px-3 py-3" style={{ display: "none" }}>
              <div ref={reg("pvIni")} className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-gym-primaryDeep to-gym-violet text-sm font-bold text-white" />
              <div>
                <div ref={reg("pvName")} className="text-sm font-bold text-white" />
                <div ref={reg("pvSub")} className="text-[11px] text-gym-muted" />
              </div>
            </div>
            <div className="mt-3">
              <div className={secCls}>Contacto</div>
              <label className="flex flex-col gap-1.5">
                <span className={labelCls}>WhatsApp *</span>
                <span className="flex gap-2">
                  <span className={`${fieldCls} w-24 shrink-0 px-2`}>🇨🇴 +57</span>
                  <span ref={reg("celBox")} className={`${fieldCls} min-w-0 flex-1`}><span ref={reg("cel")} data-ph="300 123 4567" /></span>
                </span>
              </label>
              <p ref={reg("celOk")} className="mt-2 text-xs text-status-ok" style={{ display: "none" }}>✓ WhatsApp válido</p>
            </div>
            <div className="mt-4 rounded-xl border border-gym-border/60 px-3 py-2">
              <div className="text-xs font-semibold text-gym-primary">Más información</div>
              <label className="mt-3 flex flex-col gap-1.5">
                <span className={labelCls}>Correo electrónico</span>
                <span ref={reg("mailBox")} className={fieldCls}><span ref={reg("mail")} data-ph="cliente@correo.com" /></span>
              </label>
            </div>
            <div className="mt-4 rounded-xl border border-gym-border/60 px-3 py-2 text-[11px] text-gym-muted">
              La puerta no abre hasta completar: ○ Rostro enrolado ○ Membresía vigente ○ Sede autorizada
            </div>
            <div ref={reg("btn")} className="btn-gym mt-4 w-full py-3">Registrar cliente y avisar en la app</div>
          </div>
          {/* --- Resultado real: Cliente creado --- */}
          <div ref={reg("done")} className="p-6" style={{ display: "none" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-status-ok">Cliente creado</div>
            <h3 className="mt-1 text-2xl font-extrabold text-white">{P.nombre}</h3>
            <p className="mt-1 text-sm text-gym-silver">{P.docTipo} {P.doc} · +57 {P.cel}</p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-gym-muted">
                <span className="font-bold uppercase tracking-wider">Activación del cliente</span>
                <span>50%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gym-border">
                <div className="h-full rounded-full bg-gym-primary gm-grow" style={{ width: "50%" }} />
              </div>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-gym-silver">
              <li className="text-status-ok">✓ Ficha registrada</li>
              <li className="text-status-ok">✓ Aviso enviado: entra por la app</li>
              <li>○ Rostro pendiente</li>
              <li>○ Membresía pendiente</li>
              <li className="text-status-err">⛔ Acceso todavía no autorizado</li>
            </ul>
            <div className="mt-5 rounded-2xl border border-gym-border/70 bg-gym-navy/40 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Siguiente paso</div>
              <p className="mt-1 text-sm text-white">El cliente entra a la app con su documento y este WhatsApp.</p>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gym-silver">¿Quieres activarlo ahora?</p>
              <span className="btn-gym mt-2 inline-block px-4 py-2 text-sm">Asignar membresía</span>
            </div>
          </div>
          {/* --- Membresías: Nueva membresía --- */}
          <div ref={reg("plan")} className="p-6" style={{ display: "none" }}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Membresías</div>
            <h3 className="mt-1 text-lg font-bold text-white">Nueva membresía · {P.nombre}</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[["Pase del día", "$15.000", "1 día"], ["Mensual", "$120.000", "30 días"], ["Trimestral", "$320.000", "90 días"], ["Anual", "$990.000", "365 días"]].map(([n, p, d]) => (
                <div key={n} ref={n === "Mensual" ? reg("mensual") : undefined} className="gm-planbtn rounded-xl border border-gym-border px-3 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">{n}</div>
                  <div className="text-lg font-extrabold text-white">{p}</div>
                  <div className="text-[11px] text-gym-muted">{d}</div>
                </div>
              ))}
            </div>
            <p ref={reg("vig")} className="mt-3 text-sm text-gym-silver" style={{ display: "none" }}>Nueva vigencia: <b className="text-white">12 nov 2026 → 12 dic 2026</b></p>
            <div className="mt-3 flex gap-4 text-sm text-gym-silver">
              <span>◉ Cobrar ahora</span>
              <span className="text-gym-muted">○ Registrar como pendiente</span>
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <span className="rounded-full border border-gym-border px-3 py-1.5 text-gym-muted">Efectivo</span>
              <span ref={reg("pay")} className="gm-planbtn rounded-full border border-gym-border px-3 py-1.5 text-gym-silver">Tarjeta</span>
              <span className="rounded-full border border-gym-border px-3 py-1.5 text-gym-muted">Transferencia</span>
            </div>
            <div ref={reg("btn2")} className="btn-gym mt-4 w-full py-3">Confirmar y cobrar</div>
            <div ref={reg("okPlan")} className="mt-4 rounded-2xl border border-status-ok/50 bg-status-ok/10 p-4 text-sm" style={{ display: "none" }}>
              <div className="font-bold text-status-ok">✓ Membresía Mensual activa · $120.000</div>
              <div className="mt-1 text-gym-silver">✓ Enlace de registro facial enviado por WhatsApp</div>
              <div className="mt-1 text-gym-muted">○ Rostro pendiente: lo hace desde su celular</div>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ */

const WA_LINK = `visionyx.duckdns.org/e/${P.code}`;

export function PhoneOverlay({ tour, anchor }: { tour: Tour; anchor: React.MutableRefObject<THREE.Object3D | null> }) {
  const grp = useRef<THREE.Group>(null!);
  const root = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const { size } = useThree();
  const v = new THREE.Vector3();
  useFrame(() => {
    const el = root.current;
    const on = tour.active && (tour.phase === "phone" || tour.phase === "enrolled");
    if (!el) return;
    el.style.display = on ? "" : "none";
    if (!on) return;
    if (anchor.current) {
      anchor.current.getWorldPosition(v);
      grp.current.position.copy(v);
    }
    const F = f.current;
    const t = tour.phase === "phone" ? tour.nt : 99;
    const enrolled = tour.phase === "enrolled";
    // escala para que el celular quepa en cualquier formato
    const s = Math.min(1.1, (size.height * 0.7) / 640, (size.width * 0.86) / 320);
    const inA = Math.min(1, (tour.phase === "phone" ? t : 9) / 0.45);
    const outA = enrolled ? Math.max(0, 1 - Math.max(0, tour.phaseT - (tour.phaseDur - 0.45)) / 0.45) : 1;
    el.style.transform = `translate(-50%,-50%) translateY(${(1 - inA) * 120}px) scale(${s * (0.92 + 0.08 * inA)}) rotate(${(1 - inA) * -6}deg)`;
    el.style.opacity = String(Math.min(inA, outA));
    const scr = t < 2.0 ? "wa" : t < 3.0 ? "e" : t < 4.3 ? "idle" : t < 8.6 ? "stage" : t < 9.3 ? "verif" : "ok";
    for (const k of ["wa", "e", "idle", "stage", "ok"]) show(F[k], k === scr || (k === "stage" && scr === "verif"), "flex");
    // WhatsApp
    show(F.notif, t < 0.9);
    F.notif!.style.transform = `translateY(${t < 0.25 ? -(0.25 - t) * 300 : 0}px)`;
    show(F.bubble, t > 0.55, "block");
    F.link!.classList.toggle("gm-tap", t > 1.45 && t < 1.95);
    // /e
    // idle: barra de arranque
    const boot = Math.min(1, Math.max(0.08, (t - 3.0) / 0.8));
    F.bootBar!.style.width = `${boot * 100}%`;
    F.bootLbl!.textContent = boot >= 1 ? "Motor listo. Ya puedes iniciar." : boot > 0.16 ? "Preparando el motor de visión…" : "Comprobando tu acceso…";
    F.start!.classList.toggle("gm-dis", boot < 1);
    F.start!.classList.toggle("gm-press", t > 3.95 && t < 4.25);
    // escenario guiado
    const steps = [
      { t0: 4.3, t1: 5.4, icon: "◎", title: "Mira al frente", hint: "Rostro recto, ojos a la cámara", yaw: 0 },
      { t0: 5.4, t1: 6.5, icon: "⬅️", title: "Gira a la izquierda", hint: "Lleva el mentón hacia tu hombro izquierdo", yaw: -1 },
      { t0: 6.5, t1: 7.6, icon: "➡️", title: "Gira a la derecha", hint: "Lleva el mentón hacia tu hombro derecho", yaw: 1 },
      { t0: 7.6, t1: 8.6, icon: "😉", title: "Parpadea", hint: "Cierra y abre los ojos con naturalidad", yaw: 0 },
    ];
    if (scr === "stage" || scr === "verif") {
      const i = Math.max(0, steps.findIndex((sp) => t < sp.t1));
      const sp = scr === "verif" ? null : steps[i];
      const lt = sp ? t - sp.t0 : 0;
      if (sp) {
        F.cueIcon!.textContent = sp.icon;
        F.cueTitle!.textContent = sp.title;
        F.cueHint!.textContent = sp.hint;
        const hold = lt > 0.35;
        const left = Math.max(0, Math.ceil((sp.t1 - sp.t0 - 0.15 - lt) / 0.5) / 2);
        F.flag!.textContent = sp.title === "Parpadea" ? (lt < 0.4 ? "Mírame con los ojos abiertos" : "Ahora parpadea") : hold ? `Mantén la posición… ${Math.max(0, Math.ceil((sp.t1 - 0.15 - t)))}s` : sp.yaw ? "Ahora gira" : "Prepárate…";
        F.flag!.className = `gm-flag ${hold ? "ok" : ""}`;
        void left;
        // rostro: giro y parpadeo
        const turn = sp.yaw * Math.min(1, Math.max(0, (lt - 0.1) / 0.35)) * (lt > sp.t1 - sp.t0 - 0.2 ? 0.6 : 1);
        F.face!.style.transform = `translateX(${-turn * 18}px) rotateY(${-turn * 32}deg)`;
        const blink = sp.title === "Parpadea" && lt > 0.45 && lt < 0.62;
        F.eyes!.style.transform = `scaleY(${blink ? 0.1 : 1})`;
        F.guide!.classList.toggle("ok", hold);
      } else {
        F.cueIcon!.textContent = "⏳";
        F.cueTitle!.textContent = "Verificando…";
        F.cueHint!.textContent = "Revalidando prueba de vida y enrolando el rostro";
        F.flag!.textContent = "Procesando";
        F.flag!.className = "gm-flag";
        F.face!.style.transform = "";
      }
      // progreso del anillo = pasos completados
      const done = sp ? i + Math.min(1, Math.max(0, (t - sp.t0) / (sp.t1 - sp.t0))) : 4;
      const C = 238.76;
      (F.ring as unknown as SVGCircleElement).style.strokeDashoffset = String(C * (1 - done / 4));
      // destello de captura al final de cada paso
      const flash = steps.some((s2) => t > s2.t1 - 0.12 && t < s2.t1 + 0.18);
      F.shutter!.style.opacity = flash ? String(Math.max(0, 0.85 - (t - (steps.find((s2) => t > s2.t1 - 0.12 && t < s2.t1 + 0.18)!.t1 - 0.12)) * 2.8)) : "0";
    }
  });
  return (
    <group ref={grp}>
      <Html zIndexRange={[70, 60]} style={{ pointerEvents: "none" }}>
        <div ref={root} className="gm-phone" style={{ display: "none" }}>
          <div className="gm-phone-notch" />
          <div className="gm-phone-status"><span>6:42</span><span>●●● 5G ▮</span></div>
          {/* WhatsApp */}
          <div ref={reg("wa")} className="gm-scr gm-wa">
            <div ref={reg("notif")} className="gm-wa-notif">
              <div className="gm-wa-ico">✆</div>
              <div><b>VISIONYX</b><span>Hola, {P.first}. VISIONYX necesita tu rostro para la puerta…</span></div>
            </div>
            <div className="gm-wa-head">
              <span className="gm-wa-back">‹</span>
              <img src="/brand/vx-icon-color.svg" alt="" />
              <div><b>VISIONYX</b><span>en línea</span></div>
            </div>
            <div className="gm-wa-input"><span>Mensaje</span><i>🎤</i></div>
            <div className="gm-wa-body">
              <div className="gm-wa-day">HOY</div>
              <div ref={reg("bubble")} className="gm-wa-bubble" style={{ display: "none" }}>
                Hola, {P.first}.<br /><br />VISIONYX necesita tu rostro para la puerta.<br /><br />Abre este paso en el celular:<br />
                <span ref={reg("link")} className="gm-wa-link">https://{WA_LINK}</span>
                <br /><br />Listo en menos de un minuto.
                <span className="gm-wa-time">6:42 p. m.</span>
              </div>
            </div>
          </div>
          {/* /e/{code} */}
          <div ref={reg("e")} className="gm-scr gm-e">
            <img src="/brand/vx-horizontal-color.svg" alt="VISIONYX" />
            <h1>Abriendo tu registro facial</h1>
            <p>Hola, {P.first}. Te llevamos a capturar tu rostro.</p>
            <small>UN MOMENTO…</small>
          </div>
          {/* enroll.html — idle */}
          <div ref={reg("idle")} className="gm-scr gm-en">
            <EnrollTop />
            <div className="gm-en-idle">
              <div className="gm-en-icon">◎</div>
              <h1>Registra tu rostro</h1>
              <p>La cámara de tu celular hace la prueba de vida. Cada gesto aparece cuando te toca.</p>
              <div className="gm-boot"><div className="gm-boot-track"><div ref={reg("bootBar")} className="gm-boot-bar" /></div><p ref={reg("bootLbl")}>Comprobando tu acceso…</p></div>
              <div ref={reg("start")} className="gm-en-btn">Iniciar reconocimiento</div>
            </div>
          </div>
          {/* enroll.html — escenario guiado */}
          <div ref={reg("stage")} className="gm-scr gm-en">
            <EnrollTop />
            <div className="gm-stage">
              <div className="gm-cam">
                <svg viewBox="0 0 200 260" className="gm-cam-face">
                  <defs>
                    <radialGradient id="gmbg" cx="50%" cy="40%" r="70%"><stop offset="0" stopColor="#3a4a63" /><stop offset="1" stopColor="#111827" /></radialGradient>
                  </defs>
                  <rect width="200" height="260" fill="url(#gmbg)" />
                  <ellipse cx="100" cy="250" rx="92" ry="50" fill="#38BDF8" />
                  <rect x="86" y="160" width="28" height="40" fill="#c98b62" />
                  <g ref={reg("face") as any} style={{ transformOrigin: "100px 130px", transformBox: "view-box" } as any}>
                    <ellipse cx="100" cy="112" rx="58" ry="66" fill="#2a1a12" />
                    <ellipse cx="100" cy="128" rx="44" ry="54" fill="#c98b62" />
                    <path d="M56 112 Q100 50 144 112 Q140 78 100 70 Q60 78 56 112Z" fill="#2a1a12" />
                    <g ref={reg("eyes") as any} style={{ transformOrigin: "100px 124px", transformBox: "view-box" } as any}>
                      <ellipse cx="83" cy="124" rx="5.5" ry="4.5" fill="#1d1410" />
                      <ellipse cx="117" cy="124" rx="5.5" ry="4.5" fill="#1d1410" />
                    </g>
                    <path d="M83 112 q6 -4 12 0 M105 112 q6 -4 12 0" stroke="#2a1a12" strokeWidth="2.5" fill="none" />
                    <path d="M100 128 l-4 14 h8" stroke="#a86b4a" strokeWidth="2" fill="none" />
                    <path d="M88 154 q12 8 24 0" stroke="#9b3f3a" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
              <div className="gm-stage-status"><span ref={reg("flag")} className="gm-flag">Listo</span></div>
              <div ref={reg("guide")} className="gm-guide">
                <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
                  <circle className="ring-bg" cx="50" cy="50" r="38" />
                  <circle ref={reg("ring") as any} className="ring-fg" cx="50" cy="50" r="38" strokeDasharray="238.76" strokeDashoffset="238.76" transform="rotate(-90 50 50)" />
                </svg>
              </div>
              <div className="gm-cue">
                <span ref={reg("cueIcon")} className="icon">📷</span>
                <div ref={reg("cueTitle")} className="title">Cámara de tu celular</div>
                <div ref={reg("cueHint")} className="hint">Pulsa Iniciar y permite el acceso</div>
              </div>
              <div ref={reg("shutter")} className="gm-shutter" />
            </div>
          </div>
          {/* enroll.html — éxito */}
          <div ref={reg("ok")} className="gm-scr gm-en">
            <EnrollTop />
            <div className="gm-result">
              <h4>✔ Registro exitoso</h4>
              <div className="gm-result-photo">
                <svg viewBox="0 0 200 200">
                  <rect width="200" height="200" fill="#1f2a3d" />
                  <ellipse cx="100" cy="92" rx="58" ry="66" fill="#2a1a12" />
                  <ellipse cx="100" cy="108" rx="44" ry="54" fill="#c98b62" />
                  <path d="M56 92 Q100 30 144 92 Q140 58 100 50 Q60 58 56 92Z" fill="#2a1a12" />
                  <ellipse cx="83" cy="104" rx="5.5" ry="4.5" fill="#1d1410" />
                  <ellipse cx="117" cy="104" rx="5.5" ry="4.5" fill="#1d1410" />
                  <path d="M88 134 q12 8 24 0" stroke="#9b3f3a" strokeWidth="3" fill="none" strokeLinecap="round" />
                  <ellipse cx="100" cy="215" rx="90" ry="50" fill="#38BDF8" />
                </svg>
              </div>
              <div className="detail">La verificación de vida y la captura facial se completaron. Ya puedes entrar al gimnasio con tu rostro.</div>
              <div className="scores"><div className="s">Liveness pasivo<b>0.97</b></div></div>
              <p className="next">Prueba ahora cómo se verá en la entrada. No pide usuario ni contraseña.</p>
              <div className="gm-en-btn">Probar en la entrada</div>
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}

function EnrollTop() {
  return (
    <header className="gm-en-top">
      <div className="brand">
        <img src="/brand/vx-icon-color.svg" alt="" />
        <div className="wordmark"><b>VISIONYX</b><span>Registro facial</span></div>
      </div>
      <span className="who"><b>{P.nombre}</b></span>
    </header>
  );
}
