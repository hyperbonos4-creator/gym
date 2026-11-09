"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { studioKeyFor } from "../../lib/exerciseLibrary";
import type { MotionClip } from "../../lib/motionModel";
import { movementOf, type MovePhase } from "../../lib/movement";
import { getActiveGymId } from "../../lib/session";

const MotionPlayback = dynamic(() => import("../motion/MotionPlayback").then((m) => m.MotionPlayback), { ssr: false });
const MannequinClip = dynamic(() => import("../motion-studio/MannequinClip").then((m) => m.MannequinClip), { ssr: false });

const SPEEDS = [
  { id: 0.75, label: "0,75×", ms: 1200 },
  { id: 1, label: "1×", ms: 900 },
  { id: 1.5, label: "1,5×", ms: 600 },
] as const;

export type Prescription = {
  sets: number;
  reps: string;
  restSec: number;
  tempo: string;
};

export function MovementPlayer({
  exerciseId,
  compact = false,
  prescription,
  motion,
}: {
  exerciseId: string;
  compact?: boolean;
  prescription?: Prescription;
  /** undefined: consultar la sede. null: no hay clip publicado. */
  motion?: MotionClip | null;
}) {
  const studioKey = studioKeyFor(exerciseId);
  const [clip, setClip] = useState<MotionClip | null>(motion ?? null);
  const view = movementOf(exerciseId);

  useEffect(() => {
    if (studioKey || motion !== undefined) {
      setClip(motion ?? null);
      return;
    }
    let dead = false;
    const gym = getActiveGymId() || "fuerza-elite";
    fetch(`/api/motion?gym=${encodeURIComponent(gym)}&exercise=${encodeURIComponent(exerciseId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!dead) setClip(data?.clip || null); })
      .catch(() => { if (!dead) setClip(null); });
    return () => { dead = true; };
  }, [exerciseId, motion, studioKey]);
  const shots = view?.clip.kind === "frames" ? view.clip.shots : [];
  const [index, setIndex] = useState(0);
  const [holdReturn, setHoldReturn] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>(1);
  const shotKey = shots.map((s) => s.src).join("|");

  useEffect(() => {
    setIndex(0);
    setHoldReturn(false);
    setPlaying(shots.length > 1);
  }, [exerciseId, shots.length]);

  useEffect(() => {
    if (!playing || holdReturn || shots.length < 2) return;
    const ms = SPEEDS.find((s) => s.id === speed)?.ms ?? 900;
    const t = setInterval(() => setIndex((i) => (i + 1) % shots.length), ms);
    return () => clearInterval(t);
  }, [playing, holdReturn, speed, shotKey, shots.length]);

  if (studioKey) {
    return (
      <div className={compact ? "w-56 shrink-0" : "space-y-3"}>
        <MannequinClip clipKey={studioKey} compact={compact} />
        {!compact && view && (
          <div className="overflow-hidden rounded-2xl border border-gym-border/80">
            <div className="grid gap-px bg-gym-border/60 sm:grid-cols-3">
              <Cell k="Qué usar" v={view.machine} />
              <Cell k="Colocación" v={view.place || "Sin nota de colocación"} />
              <Cell k="Agarre" v={view.grip || "Sin nota de agarre"} />
            </div>
            <div className="space-y-1 bg-gym-panel/90 px-3 py-2.5 text-[11px] leading-snug text-gym-silver">
              <p><span className="text-gym-muted">Músculo principal. </span>{view.primary}{view.secondary.length ? ` · asisten ${view.secondary.join(", ")}` : ""}</p>
              <p><span className="text-gym-muted">Estudio. </span>Maniquí 3D de este ejercicio. El recorrido no certifica la técnica.</p>
            </div>
          </div>
        )}
        {prescription && (
          <p className={`text-[10px] leading-snug text-gym-silver ${compact ? "mt-1" : ""}`}>
            {prescription.sets} series · {prescription.reps} · descanso {prescription.restSec} s
            {prescription.tempo ? ` · tempo ${prescription.tempo}` : ""}
          </p>
        )}
      </div>
    );
  }

  if (clip && clip.keys.length >= 2 && compact) {
    return <MotionPlayback clip={clip} compact />;
  }

  if (!view && !clip) return null;

  function pick(next: MovePhase) {
    if (next === "regreso") {
      setHoldReturn(true);
      setPlaying(false);
      setIndex(0);
      return;
    }
    const at = shots.findIndex((s) => s.phase === next);
    if (at < 0) return;
    setHoldReturn(false);
    setIndex(at);
    setPlaying(false);
  }

  const shot = shots[index] || null;
  const phase: MovePhase = holdReturn ? "regreso" : (shot?.phase || "preparacion");
  const showingReturn = holdReturn;

  return (
    <div className={compact ? "w-44 shrink-0" : "space-y-3"}>
      {clip && clip.keys.length >= 2 && <MotionPlayback clip={clip} />}
      {view && (
    <div className={compact ? "w-44 shrink-0" : "overflow-hidden rounded-2xl border border-gym-border/80 bg-black"}>
      <Stage view={view} shotSrc={shot?.src || ""} showingReturn={showingReturn} compact={compact} />
      {view.clip.kind === "frames" && (
        <div className={compact ? "mt-1.5 space-y-1.5" : "border-t border-gym-border/60 bg-gym-panel/90 px-3 py-2.5"}>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => setPlaying((v) => !v)} className="rounded-full border border-gym-border px-2 py-0.5 text-[10px] font-semibold text-white">
              {playing && !showingReturn ? "Pausa" : "Repetir"}
            </button>
            {SPEEDS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpeed(s.id)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${speed === s.id ? "bg-gym-primary text-gym-navy" : "text-gym-muted"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {shots.map((s) => (
              <button
                key={s.phase}
                type="button"
                onClick={() => pick(s.phase)}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${phase === s.phase ? "bg-gym-primary/20 text-gym-primary" : "text-gym-muted"}`}
              >
                {s.label}
              </button>
            ))}
            {view.returnStep && (
              <button
                type="button"
                onClick={() => pick("regreso")}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${showingReturn ? "bg-gym-primary/20 text-gym-primary" : "text-gym-muted"}`}
              >
                Regreso
              </button>
            )}
          </div>
          {showingReturn && view.returnStep && (
            <p className="text-[11px] leading-snug text-gym-silver">{view.returnStep.text} No hay una foto distinta del regreso: se muestra el inicio.</p>
          )}
        </div>
      )}
      {!compact && (
        <>
          <div className="grid gap-px bg-gym-border/60 sm:grid-cols-3">
            <Cell k="Qué usar" v={view.machine} />
            <Cell k="Colocación" v={view.place || "Sin nota de colocación"} />
            <Cell k="Agarre" v={view.grip || "Sin nota de agarre"} />
          </div>
          <div className="space-y-1 bg-gym-panel/90 px-3 py-2.5 text-[11px] leading-snug text-gym-silver">
            <p><span className="text-gym-muted">Músculo principal. </span>{view.primary}{view.secondary.length ? ` · asisten ${view.secondary.join(", ")}` : ""}</p>
            <p><span className="text-gym-muted">Vista. </span>Principal. Segunda perspectiva: sin archivo.</p>
            <p><span className="text-gym-muted">Estudio. </span>{view.mediumNote}</p>
            <p><span className="text-gym-muted">Validación. </span>Pendiente. {view.licenseNote}</p>
          </div>
        </>
      )}
      {compact && (
        <p className="mt-1 text-[10px] leading-snug text-gym-muted">{view.mediumNote}</p>
      )}
      {prescription && (
        <p className={`text-[10px] leading-snug text-gym-silver ${compact ? "mt-1" : "bg-gym-panel/90 px-3 pb-2.5"}`}>
          {prescription.sets} series · {prescription.reps} · descanso {prescription.restSec} s
          {prescription.tempo ? ` · tempo ${prescription.tempo}` : ""}
        </p>
      )}
    </div>
      )}
    </div>
  );
}

function Stage({
  view,
  shotSrc,
  showingReturn,
  compact,
}: {
  view: NonNullable<ReturnType<typeof movementOf>>;
  shotSrc: string;
  showingReturn: boolean;
  compact: boolean;
}) {
  const frameClass = compact ? "h-28 w-full rounded-lg bg-black object-contain" : "h-full w-full object-contain";
  if (view.clip.kind === "model") {
    return <ModelStage src={view.clip.src} compact={compact} />;
  }
  if (view.clip.kind === "video") {
    return (
      <video
        key={view.clip.src}
        src={view.clip.src}
        poster={view.clip.poster}
        controls
        loop
        playsInline
        className={compact ? "h-28 w-full rounded-lg bg-black object-contain" : "aspect-[4/3] w-full bg-black object-contain"}
      />
    );
  }
  if (view.clip.kind === "frames" && shotSrc) {
    const label = showingReturn ? "Regreso · se muestra el inicio" : view.clip.shots.find((s) => s.src === shotSrc)?.label;
    return (
      <div className={compact ? "relative" : "relative aspect-[4/3] w-full bg-black"}>
        <img src={shotSrc} alt={`Demostración de ${view.name}`} className={frameClass} />
        {!compact && label && (
          <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gym-primary">
            {label}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={compact ? "flex h-28 items-center justify-center rounded-lg border border-dashed border-gym-border px-2 text-center text-[11px] text-gym-muted" : "flex aspect-[4/3] items-center justify-center px-4 text-center text-sm text-gym-muted"}>
      Sin demostración de este ejercicio.
    </div>
  );
}

function ModelStage({ src, compact }: { src: string; compact: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let dead = false;
    const mount = () => {
      if (dead || !ref.current) return;
      ref.current.replaceChildren();
      const viewer = document.createElement("model-viewer");
      viewer.setAttribute("src", src);
      viewer.setAttribute("camera-controls", "");
      viewer.setAttribute("autoplay", "");
      viewer.style.width = "100%";
      viewer.style.height = compact ? "7rem" : "100%";
      ref.current.appendChild(viewer);
    };
    if (customElements.get("model-viewer")) {
      mount();
      return () => { dead = true; };
    }
    const id = "model-viewer-script";
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = id;
      script.type = "module";
      script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";
      document.head.appendChild(script);
    }
    script.addEventListener("load", mount);
    return () => {
      dead = true;
      script?.removeEventListener("load", mount);
    };
  }, [src, compact]);
  return <div ref={ref} className={compact ? "h-28 w-full rounded-lg bg-black" : "aspect-[4/3] w-full bg-black"} />;
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="bg-gym-panel/90 px-3 py-2.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gym-primary">{k}</div>
      <div className="mt-1 text-[12px] leading-snug text-gym-silver">{v}</div>
    </div>
  );
}
