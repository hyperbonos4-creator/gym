"use client";

/**
 * Pantallas del recorrido "Entrenamiento" (Parte 2). Todo sale del código real:
 *  - PhoneEntreno: app del socio (gym-mobile): pestaña Entreno ("Tu entreno",
 *    training_screen.dart), la lección del ejercicio con el maniquí 3D real
 *    (lesson_screen.dart + /maniqui?clip=…, MannequinClip) y "Mi alimentación"
 *    (nutrition_screen.dart).
 *  - CoachPanel: lo que hace el entrenador en el panel web: Motion Studio 3D
 *    (components/motion/Studio.tsx), Rutinas (RoutineBuilder + AssignRoutine),
 *    Valoraciones (app/valoraciones, MEASURE_FIELDS) y Nutrición (expediente).
 * Datos de la persona inventados (los mismos de la Parte 1). Nada se guarda ni se envía.
 */

import { useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import dynamic from "next/dynamic";
import { TOUR_PERSON, type Tour } from "../../lib/gemelo/tour";

const MannequinClip = dynamic(() => import("../motion-studio/MannequinClip").then((m) => m.MannequinClip), { ssr: false });

const P = TOUR_PERSON;
const show = (el: HTMLElement | null | undefined, v: boolean, disp = "") => {
  if (el) el.style.display = v ? disp : "none";
};
function typed(s: string, t: number, t0: number, t1: number) {
  if (t <= t0) return "";
  if (t >= t1) return s;
  return s.slice(0, Math.floor(((t - t0) / (t1 - t0)) * s.length + 0.0001));
}
const isAd = () => typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search);
const fixedPos = ((_o: unknown, _c: unknown, size: { width: number; height: number }) => [0, 0]) as any;

/** Rutina asignada (plantilla publicada v1). Ejercicios reales del catálogo con ciclo 3D. */
const ROUTINE = {
  name: "Brazo + hombro",
  version: 1,
  day: "Día 1 · Tren superior",
  items: [
    { name: "Curl de bíceps con mancuernas", cls: "Tren superior · Inicio", mu: "Bíceps · Mancuernas", sets: 4, reps: "12", rest: 60, rir: "RIR 2" },
    { name: "Elevación lateral", cls: "Tren superior · Inicio", mu: "Deltoides · Mancuernas", sets: 4, reps: "12", rest: 45, rir: "RIR 2" },
    { name: "Press de hombros con mancuernas", cls: "Tren superior · Inicio", mu: "Deltoides · Mancuernas", sets: 3, reps: "10", rest: 75, rir: "RIR 2" },
  ],
};
/** Curl de bíceps con mancuernas (lib/exercisesCatalog.ts) */
const CURL = {
  why: "Construye el pico del bíceps y enseña a flexionar el codo sin balancear el torso.",
  steps: [
    ["Base", "De pie, pies al ancho de cadera, costillas abajo, omóplatos suaves."],
    ["Subida", "Flexiona solo el codo. El hombro no se encoge."],
    ["Pico", "Aprieta 1 segundo arriba sin encoger el cuello."],
    ["Bajada", "Estira casi completo, sin bloquear ni columpiar."],
  ],
  cues: ["Codos pegados a las costillas, no viajan hacia adelante.", "Baja en 2 segundos; no sueltes el peso."],
  mistakes: ["Balancear la cadera", "Abrir los codos", "Subir de golpe y perder tensión"],
};

/** Guion del celular (s dentro de la fase). */
export const APP_T = { list: 0, tap: 4.0, lesson: 4.6, scroll: 13.6, end: 18.2 };
export const COACH_T = { studio: 0, pub: 4.6, rutina: 8.2, valor: 16.0, nutri: 24.4, end: 31.2 };

function Mannequin({ on, h, onReady, loadRef }: { on: boolean; h: number; onReady?: () => void; loadRef?: (el: HTMLDivElement | null) => void }) {
  // Componente real del maniquí (MannequinClip, el mismo de /maniqui y de la app: modo "bare").
  return (
    <div style={{ height: h, background: "#e6e9ee", display: "flex", flexDirection: "column", position: "relative" }}>
      {on && <MannequinClip clipKey="curl" bare frameClassName="min-h-0 flex-1" onReady={onReady} />}
      <div ref={loadRef} className="gm-mq-load">Cargando el maniquí 3D…</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function PhoneEntreno({ tour }: { tour: Tour }) {
  const root = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const [mount, setMount] = useState(false);
  const readyP = useRef(false);
  const waitT = useRef(0);
  const { size } = useThree();
  const ad = isAd();
  useFrame(() => {
    const el = root.current;
    if (!el) return;
    const ch2 = tour.active && tour.chapter === 2;
    const ph = tour.phase;
    // se monta desde que empieza la Parte 2 para que el modelo ya esté listo al abrir la lección
    const want = ch2 && (ph === "to_gate" || ph === "gate" || ph === "enter" || ph === "app");
    if (want !== mount) setMount(want);
    // si el modelo aún no carga, el recorrido espera en la lección (máx. 25 s) en vez de mostrar un recuadro vacío
    const waiting = want && ph === "app" && tour.phaseT >= APP_T.lesson + 0.4 && !readyP.current && waitT.current < 25;
    if (waiting) waitT.current += 1 / 60;
    tour.hold = waiting;
    if (f.current.loadP) f.current.loadP.style.display = readyP.current ? "none" : "";
    if (!ch2) { readyP.current = false; waitT.current = 0; }
    const on = ch2 && (ph === "app" || ph === "food");
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
    const inA = Math.min(1, t / 0.6);
    const ie = 1 - Math.pow(1 - inA, 3);
    const outA = Math.max(0, 1 - Math.max(0, t - (tour.phaseDur - 0.45)) / 0.45);
    el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 140}px) translate(-50%,-50%) scale(${s * (0.9 + 0.1 * ie)})`;
    el.style.opacity = String(Math.min(ie * 1.3, outA));
    const F = f.current;
    const T = APP_T;
    const scr = ph === "food" ? "food" : t < T.lesson ? "list" : "lesson";
    for (const k of ["list", "lesson", "food"]) show(F[k], k === scr, "flex");
    if (F.chip) {
      show(F.chip, !ad, "block");
      F.chip.textContent = ph === "food" ? "Mi alimentación · guía del día y hábitos" : t < T.lesson ? "App del socio · pestaña Entreno" : "Lección · maniquí 3D, secuencia y errores";
    }
    if (scr === "list") {
      F.card0!.classList.toggle("gm-tap2", t > T.tap && t < T.lesson);
      for (let i = 0; i < 3; i++) {
        const c = F[`c${i}`];
        if (c) c.style.opacity = String(Math.min(1, Math.max(0, (t - 0.5 - i * 0.35) / 0.4)));
      }
    }
    if (scr === "lesson") {
      const k = Math.min(1, Math.max(0, (t - T.scroll) / 0.9));
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      F.lessonBody!.style.transform = `translateY(${-e * 300}px)`;
    }
    if (scr === "food") {
      F.h0!.classList.toggle("on", t > 3.0);
      F.h1!.classList.toggle("on", t > 4.8);
    }
  });
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[70, 60]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-phone gm-p2" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
        <div className="gm-phone-notch" />
        <div className="gm-phone-status"><span>6:58</span><span>●●● 5G ▮</span></div>
        {/* Entreno · Tu entreno (training_screen.dart) */}
        <div ref={reg("list")} className="gm-scr gm-app">
          <div className="gm-app-bar"><b>VISIONYX</b><span>☰</span></div>
          <div className="gm-app-body">
            <h2>Tu entreno</h2>
            <div className="gm-app-sub">{ROUTINE.name} · versión {ROUTINE.version}</div>
            <div className="gm-app-day">{ROUTINE.day}</div>
            {ROUTINE.items.map((it, i) => (
              <div key={it.name} ref={(el) => { f.current[`c${i}`] = el; if (i === 0) f.current.card0 = el; }} className="gm-app-card">
                <div className="gm-app-thumb"><span>3D</span></div>
                <div>
                  <div className="gm-app-k">{it.cls}</div>
                  <div className="gm-app-n">{it.name}</div>
                  <div className="gm-app-m">{it.mu}</div>
                  <div className="gm-app-s">{it.sets} series · {it.reps} · {it.rest} s descanso</div>
                </div>
              </div>
            ))}
          </div>
          <AppNav active="Entreno" />
        </div>
        {/* Lección (lesson_screen.dart) */}
        <div ref={reg("lesson")} className="gm-scr gm-app">
          <div className="gm-app-bar"><span className="gm-app-back">‹</span><b className="gm-app-title">{ROUTINE.items[0].name}</b></div>
          <div className="gm-app-scroll">
            <div ref={reg("lessonBody")}>
              <Mannequin on={mount} h={250} onReady={() => { readyP.current = true; }} loadRef={reg("loadP")} />
              <div className="gm-app-body">
                <div className="gm-app-note">Maniquí 3D. Puedes girarlo. El recorrido no certifica la técnica.</div>
                <div className="gm-app-k" style={{ color: "#38BDF8" }}>Tren superior · Inicio · Bíceps</div>
                <div className="gm-app-s" style={{ fontSize: 14 }}>4 series · 12 · descanso 60 s</div>
                <p className="gm-app-p">{CURL.why}</p>
                <div className="gm-app-p">Equipo: Mancuernas · Tempo 2 · 1 · 2</div>
                <h3>Secuencia</h3>
                {CURL.steps.map(([a, b], i) => <p key={a} className="gm-app-p">{i + 1}. {a}. {b}</p>)}
                <h3>Señales</h3>
                {CURL.cues.map((c) => <p key={c} className="gm-app-p">• {c}</p>)}
                <h3>Errores</h3>
                {CURL.mistakes.map((c) => <p key={c} className="gm-app-p" style={{ color: "#FBBF24" }}>• {c}</p>)}
              </div>
            </div>
          </div>
        </div>
        {/* Mi alimentación (nutrition_screen.dart) */}
        <div ref={reg("food")} className="gm-scr gm-app">
          <div className="gm-app-bar"><b>VISIONYX</b><span>☰</span></div>
          <div className="gm-app-body">
            <h2>Mi alimentación</h2>
            <div className="gm-app-sub" style={{ color: "#94a3b8", fontWeight: 500 }}>Tu guía del día y tus hábitos.</div>
            <div className="gm-app-day" style={{ color: "#38BDF8" }}>Guía general · Semana 1 · versión 1</div>
            <h3>Hábitos de hoy</h3>
            {["Tomar 2 litros de agua", "Verdura en el almuerzo", "Dormir 7 horas"].map((h, i) => (
              <div key={h} ref={i < 2 ? reg(`h${i}`) : undefined} className="gm-app-habit"><i />{h}</div>
            ))}
            {[["Desayuno", "Avena · 40 g · Huevo · 2 unidades"], ["Almuerzo", "Arroz · 1 taza cocida · Pollo · 120 g"], ["Merienda", "Yogur natural · 1 vaso"], ["Cena", "Arepa · 1 unidad · Queso · 40 g"]].map(([a, b]) => (
              <div key={a} className="gm-app-meal"><b>{a}</b><span>{b}</span><em>Registrar esta comida</em></div>
            ))}
            <div className="gm-app-foot">Rutina vigente: {ROUTINE.name}. Registrar la comida no cambia el entrenamiento.</div>
          </div>
        </div>
      </div>
    </Html>
  );
}

function AppNav({ active }: { active: string }) {
  return (
    <div className="gm-app-nav">
      {["Inicio", "Planes", "Entreno", "Invitados"].map((l) => <span key={l} className={l === active ? "on" : ""}>{l}</span>)}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const PANEL_H = 560;
const PANEL_HP = 610;

export function CoachPanel({ tour }: { tour: Tour }) {
  const readyC = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const [mount, setMount] = useState(false);
  const { size } = useThree();
  const ad = isAd();
  useFrame(() => {
    const el = root.current;
    if (!el) return;
    const ch2 = tour.active && tour.chapter === 2;
    const on = ch2 && tour.phase === "coach";
    // se monta con el panel visible (con el panel oculto el lienzo nace sin tamaño); el GLB ya viene en caché de la lección
    const want = on;
    if (want !== mount) setMount(want);
    if (!want) readyC.current = false;
    if (f.current.loadC) f.current.loadC.style.display = readyC.current ? "none" : "";
    el.style.display = on ? "" : "none";
    if (!on) return;
    const t = tour.phaseT;
    const portrait = size.width < size.height;
    const fitInteractive = !ad && portrait;
    // En vertical el panel se apila (400 px de ancho) para que se lea en el celular
    const PW = portrait ? 400 : 600;
    const PH = portrait ? PANEL_HP : PANEL_H;
    el.classList.toggle("gm-coach-p", portrait);
    el.style.width = `${PW}px`;
    el.style.height = `${PH}px`;
    const s = fitInteractive
      ? Math.min((size.height - 64 - 176 - 44) / PH, (size.width * 0.95) / PW)
      : portrait
        ? Math.min((size.height * 0.68) / PH, (size.width * 0.94) / PW)
        : Math.min((size.height * 0.84) / PH, (size.width * 0.56) / PW);
    const tx = portrait ? size.width * 0.5 : size.width * 0.64;
    const ty = fitInteractive ? 64 + 44 + (PH * s) / 2 : portrait ? size.height * 0.615 : size.height * 0.5;
    const T = COACH_T;
    const seg = t < T.rutina ? "studio" : t < T.valor ? "rutina" : t < T.nutri ? "valor" : "nutri";
    const segT = t - (seg === "studio" ? 0 : seg === "rutina" ? T.rutina : seg === "valor" ? T.valor : T.nutri);
    const inA = Math.min(1, t / 0.6);
    const ie = 1 - Math.pow(1 - inA, 3);
    const outA = Math.max(0, 1 - Math.max(0, t - (tour.phaseDur - 0.45)) / 0.45);
    // pequeño "latido" al cambiar de módulo
    const sw = seg === "studio" ? 1 : Math.min(1, segT / 0.35);
    el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 120}px) translate(-50%,-50%) scale(${s * (0.92 + 0.08 * ie) * (0.985 + 0.015 * sw)})`;
    el.style.opacity = String(Math.min(ie * 1.3, outA));
    const F = f.current;
    for (const k of ["studio", "rutina", "valor", "nutri"]) show(F[k], k === seg, "block");
    F.mod!.textContent = seg === "studio" ? "Motion Studio 3D" : seg === "rutina" ? "Rutinas" : seg === "valor" ? "Valoraciones" : "Nutrición";
    if (F.chip) {
      show(F.chip, !ad, "block");
      F.chip.textContent =
        seg === "studio" ? "El entrenador publica el movimiento" : seg === "rutina" ? "Arma la rutina y la asigna" : seg === "valor" ? "Valoración: medidas y seguimiento" : "Nutrición: plan y hábitos";
    }
    if (seg === "studio") {
      const pub = segT > T.pub + 0.35;
      F.pubBtn!.classList.toggle("gm-press", segT > T.pub && segT < T.pub + 0.35);
      F.stMsg!.textContent = pub ? "Publicada la versión 1. Los alumnos ven esta versión hasta que publiques otra." : "Sin publicar. El alumno sigue viendo las fotos.";
      F.stMsg!.classList.toggle("ok", pub);
      F.stItem!.textContent = pub ? "Publicado · v1" : "Borrador";
      F.stItem!.classList.toggle("ok", pub);
      F.pose!.classList.toggle("gm-press", segT > 2.3 && segT < 2.65);
    }
    if (seg === "rutina") {
      F.rName!.textContent = typed(ROUTINE.name, segT, 0.3, 1.3) || " ";
      for (let i = 0; i < 3; i++) {
        const r = F[`r${i}`];
        if (r) r.style.opacity = String(Math.min(1, Math.max(0, (segT - 1.5 - i * 0.5) / 0.35)));
      }
      const v = Math.min(1, Math.max(0, (segT - 2.6) / 1.0));
      F.vb!.style.width = `${(4 / 7) * 100 * v}%`;
      F.vd!.style.width = `${100 * v}%`;
      F.rPub!.classList.toggle("gm-press", segT > 3.9 && segT < 4.25);
      const pub = segT > 4.25;
      F.rState!.textContent = pub ? "Versión publicada · v1" : "Borrador · sin asignar";
      F.rState!.classList.toggle("ok", pub);
      show(F.assign, segT > 4.7, "block");
      F.aBtn!.classList.toggle("gm-press", segT > 6.0 && segT < 6.35);
      show(F.aOk, segT > 6.35, "block");
    }
    if (seg === "valor") {
      const vals: [string, number, number][] = [["vPeso", 0.5, 1.2], ["vEst", 1.3, 1.9], ["vCin", 2.0, 2.6], ["vCad", 2.7, 3.3]];
      const txt: Record<string, string> = { vPeso: "61,5", vEst: "165", vCin: "72", vCad: "98" };
      for (const [k, a, b] of vals) {
        const s2 = typed(txt[k], segT, a, b);
        F[k]!.textContent = s2 || " ";
        F[k]!.parentElement!.classList.toggle("gm-focus", segT > a - 0.2 && segT < b + 0.25);
      }
      const cierre = segT > 4.6;
      show(F.vMed, !cierre, "block");
      show(F.vCie, cierre, "block");
      F.st1!.className = cierre ? "done" : "on";
      F.st4!.className = cierre ? "on" : "";
      F.vBtn!.classList.toggle("gm-press", segT > 6.4 && segT < 6.75);
      show(F.vOk, segT > 6.75, "block");
      F.vState!.textContent = segT > 6.75 ? "Cerrada" : "Borrador";
      F.vState!.classList.toggle("ok", segT > 6.75);
    }
    if (seg === "nutri") {
      F.nSel!.textContent = segT > 1.4 ? "Guía general · Semana 1 · v1" : "Elegir plan publicado";
      F.nSel!.parentElement!.classList.toggle("gm-focus", segT > 0.8 && segT < 2.0);
      F.nBtn!.classList.toggle("gm-press", segT > 2.9 && segT < 3.25);
      show(F.nOk, segT > 3.25, "block");
      F.nState!.textContent = segT > 3.25 ? "Guía general · Semana 1 · v1" : "Sin plan asignado";
      F.nState!.classList.toggle("ok", segT > 3.25);
    }
  });
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[68, 58]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-3dpanel gm-coach" style={{ display: "none", position: "absolute", left: 0, top: 0, height: PANEL_H, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
        <div className="gm-3dpanel-top">
          <img src="/brand/vx-icon-color.svg" alt="" className="h-6 w-6" />
          <span ref={reg("mod")} className="font-bold text-white">Motion Studio 3D</span>
          <span className="text-gym-muted">· VISIONYX Norte</span>
          <span className="ml-auto rounded-full border border-gym-border px-2 py-0.5 text-[10px] text-gym-muted">Entrenador</span>
        </div>
        {/* Motion Studio 3D (components/motion/Studio.tsx) */}
        <div ref={reg("studio")} className="gm-co">
          <div className="gm-co-grid">
            <div>
              <div className="gm-co-sec">Ejercicios de la sede</div>
              <div className="gm-co-li on"><b>Curl de bíceps con mancuernas</b><span ref={reg("stItem")}>Borrador</span></div>
              <div className="gm-co-li"><b>Elevación lateral</b><span className="ok">Publicado · v2</span></div>
              <div className="gm-co-li"><b>Press de hombros con mancuernas</b><span className="ok">Publicado · v1</span></div>
              <div className="gm-co-tip">Los límites de cada articulación evitan giros extremos. No certifican la técnica.</div>
            </div>
            <div>
              <div className="gm-co-tabs"><span className="on">Maniquí 3D</span><span>Editor de poses</span></div>
              <div className="gm-co-view"><Mannequin on={mount} h={262} loadRef={reg("loadC")} onReady={() => { readyC.current = true; tour.curl0 = tour.t; }} /></div>
              <div className="gm-co-row"><span ref={reg("pose")} className="gm-co-btn">Guardar pose aquí</span><span className="gm-co-btn">Igualar brazos</span></div>
            </div>
          </div>
          <div ref={reg("stMsg")} className="gm-co-msg">Sin publicar. El alumno sigue viendo las fotos.</div>
          <div className="gm-co-row" style={{ justifyContent: "flex-end" }}><span className="gm-co-btn">Guardar borrador</span><span ref={reg("pubBtn")} className="gm-co-btn pri">Publicar</span></div>
        </div>
        {/* Rutinas (RoutineBuilder + AssignRoutine) */}
        <div ref={reg("rutina")} className="gm-co">
          <div className="gm-co-row" style={{ justifyContent: "space-between", marginTop: 0 }}>
            <div className="gm-co-field" style={{ flex: 1 }}><label>Nombre de la rutina</label><div ref={reg("rName")}>{ROUTINE.name}</div></div>
            <div className="gm-co-field" style={{ width: 130 }}><label>Objetivo</label><div>Hipertrofia</div></div>
          </div>
          <div className="gm-co-day">{ROUTINE.day}</div>
          <div className="gm-co-th"><span>Ejercicio</span><span>Series</span><span>Repeticiones</span><span>Descanso (s)</span><span>RIR o RPE</span></div>
          {ROUTINE.items.map((it, i) => (
            <div key={it.name} ref={reg(`r${i}`)} className="gm-co-tr"><span>{it.name}</span><b>{it.sets}</b><b>{it.reps}</b><b>{it.rest}</b><b>{it.rir}</b></div>
          ))}
          <div className="gm-co-sec" style={{ marginTop: 10 }}>Volumen planificado</div>
          <div className="gm-co-vol"><span>Bíceps</span><div><i ref={reg("vb")} /></div><b>4 series</b></div>
          <div className="gm-co-vol"><span>Deltoides</span><div><i ref={reg("vd")} /></div><b>7 series</b></div>
          <div className="gm-co-row" style={{ justifyContent: "space-between" }}>
            <span ref={reg("rState")} className="gm-co-state">Borrador · sin asignar</span>
            <span ref={reg("rPub")} className="gm-co-btn pri">Publicar</span>
          </div>
          <div ref={reg("assign")} className="gm-co-assign" style={{ display: "none" }}>
            <div className="gm-co-row" style={{ marginTop: 0, justifyContent: "space-between" }}>
              <div><div className="gm-co-sec" style={{ margin: 0 }}>Asignar</div><b className="text-white">{P.nombre}</b></div>
              <span ref={reg("aBtn")} className="gm-co-btn pri">Asignar esta versión</span>
            </div>
            <div ref={reg("aOk")} className="gm-co-msg ok" style={{ display: "none" }}>Asignación guardada. Si editas la plantilla, esta copia no cambia.</div>
          </div>
        </div>
        {/* Valoraciones · Nueva valoración (app/valoraciones/[socioId]/valorar) */}
        <div ref={reg("valor")} className="gm-co">
          <div className="gm-co-row" style={{ marginTop: 0, justifyContent: "space-between" }}>
            <div><div className="gm-co-sec" style={{ margin: 0 }}>Nueva valoración · Inicial</div><b className="text-white">{P.nombre}</b></div>
            <span ref={reg("vState")} className="gm-co-state">Borrador</span>
          </div>
          <div className="gm-co-steps"><span className="done">Ficha</span><span ref={reg("st1")} className="on">Medidas</span><span>Rendimiento</span><span>Fotografías</span><span ref={reg("st4")}>Cierre</span></div>
          <div ref={reg("vMed")}>
            <div className="gm-co-mgrid">
              {[["Peso", "kg", "vPeso"], ["Estatura", "cm", "vEst"], ["Cintura", "cm", "vCin"], ["Cadera", "cm", "vCad"], ["Pecho", "cm", ""], ["Brazo relajado", "cm", ""], ["Brazo contraído", "cm", ""], ["Muslo", "cm", ""]].map(([l, u, k]) => (
                <div key={l} className="gm-co-field"><label>{l} · {u}</label><div ref={k ? reg(k) : undefined}>{k ? " " : ""}</div></div>
              ))}
            </div>
            <div className="gm-co-tip">Deja en blanco lo que no mediste. Un campo vacío no se guarda como cero.</div>
          </div>
          <div ref={reg("vCie")} style={{ display: "none" }}>
            <div className="gm-co-mgrid" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="gm-co-field"><label>Objetivo principal</label><div>Ganar fuerza en tren superior</div></div>
              <div className="gm-co-field"><label>Programa asignado ahora</label><div>{ROUTINE.name} · v1</div></div>
              <div className="gm-co-field"><label>Próximo seguimiento</label><div>12 dic 2026</div></div>
              <div className="gm-co-field"><label>Medidas</label><div>Peso 61,5 kg · Cintura 72 cm</div></div>
            </div>
            <div className="gm-co-tip">Cerrar esta valoración no cambia la rutina. Si hace falta ajustarla, lo haces en Rutinas y queda registrada la versión.</div>
            <div className="gm-co-row" style={{ justifyContent: "flex-end" }}><span ref={reg("vBtn")} className="gm-co-btn pri">Cerrar valoración</span></div>
            <div ref={reg("vOk")} className="gm-co-msg ok" style={{ display: "none" }}>Esta valoración ya está cerrada. El historial conserva estos datos.</div>
          </div>
        </div>
        {/* Nutrición · expediente del cliente (app/nutricion/clientes/[socioId]) */}
        <div ref={reg("nutri")} className="gm-co">
          <div className="gm-co-row" style={{ marginTop: 0, justifyContent: "space-between" }}>
            <div><div className="gm-co-sec" style={{ margin: 0 }}>Expediente alimentario</div><b className="text-white">{P.nombre}</b></div>
            <span ref={reg("nState")} className="gm-co-state">Sin plan asignado</span>
          </div>
          <div className="gm-co-steps"><span>Perfil</span><span>Restricciones</span><span className="on">Plan</span><span>Hábitos</span><span>Diario</span><span>Evolución</span></div>
          <div className="gm-co-field"><label>Plan</label><div ref={reg("nSel")}>Elegir plan publicado</div></div>
          <div className="gm-co-row" style={{ justifyContent: "flex-end" }}><span ref={reg("nBtn")} className="gm-co-btn pri">Asignar esta versión</span></div>
          <div ref={reg("nOk")} className="gm-co-msg ok" style={{ display: "none" }}>Plan asignado. El cliente conserva esta versión hasta que la actualices.</div>
          <div className="gm-co-sec" style={{ marginTop: 12 }}>Hábitos sencillos</div>
          {["Tomar 2 litros de agua", "Verdura en el almuerzo", "Dormir 7 horas"].map((h) => <div key={h} className="gm-co-li"><b>{h}</b><span>Hábito acordado</span></div>)}
          <div className="gm-co-tip">Una guía general no es una dieta clínica. Las alergias y restricciones de salud van aparte.</div>
        </div>
      </div>
    </Html>
  );
}
