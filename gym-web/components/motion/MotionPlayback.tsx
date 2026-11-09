"use client";

import { useEffect, useState } from "react";
import { nearestLabel, poseAt, type MotionClip } from "../../lib/motionModel";
import { MotionStage } from "./MotionStage";

export function MotionPlayback({ clip, compact = false }: { clip: MotionClip; compact?: boolean }) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [view, setView] = useState<"frente" | "perfil" | "espalda">("frente");

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => (t + dt / 2.6) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, clip.pieceId, clip.version]);

  const pose = poseAt(clip.keys, time);
  return (
    <div className={compact ? "w-44 shrink-0" : "overflow-hidden rounded-2xl border border-gym-border/80 bg-black"}>
      <MotionStage pose={pose} view={view} className={compact ? "h-28 w-full" : "h-72 w-full"} />
      <div className={compact ? "mt-1.5 flex flex-wrap gap-1" : "flex flex-wrap items-center gap-1.5 border-t border-gym-border/60 bg-gym-panel/90 px-3 py-2"}>
        <button type="button" onClick={() => setPlaying((v) => !v)} className="rounded-full border border-gym-border px-2 py-0.5 text-[10px] font-semibold text-white">{playing ? "Pausa" : "Repetir"}</button>
        {!compact && (["frente", "perfil", "espalda"] as const).map((id) => (
          <button key={id} type="button" onClick={() => setView(id)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${view === id ? "bg-gym-primary text-gym-navy" : "text-gym-muted"}`}>{id}</button>
        ))}
        <span className="text-[10px] text-gym-muted">{nearestLabel(clip.keys, time)}</span>
      </div>
      {!compact && (
        <p className="bg-gym-panel/90 px-3 pb-2.5 text-[11px] leading-snug text-gym-silver">
          Demostración 3D · versión {clip.version}. El profesor marcó estas poses en Motion Studio. No es una captura de una persona ni una validación biomecánica.
        </p>
      )}
    </div>
  );
}
