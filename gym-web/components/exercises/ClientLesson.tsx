"use client";

import { useEffect, useState } from "react";
import type { Exercise } from "../../lib/exercisesCatalog";
import type { MotionClip } from "../../lib/motionModel";
import { MUSCLE_BY_ID, type MuscleId } from "../../lib/muscles";
import { structuresOn } from "../../lib/anatomy";
import BodyAtlas from "./BodyAtlas";
import ExerciseDemo from "./ExerciseDemo";

type Role = "idle" | "hot" | "sec" | "warm" | "dim";

export default function ClientLesson({ exercise, motion }: { exercise: Exercise; motion?: MotionClip | null }) {
  const [view, setView] = useState<"front" | "back">(
    MUSCLE_BY_ID[exercise.primary].view === "back" ? "back" : "front",
  );
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    setView(MUSCLE_BY_ID[exercise.primary].view === "back" ? "back" : "front");
  }, [exercise]);

  function roleOf(id: MuscleId): Role {
    if (exercise.primary === id) return "hot";
    if (exercise.secondary.includes(id)) return "sec";
    if (exercise.warmup.includes(id)) return "warm";
    return "dim";
  }

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 px-4 py-5 lg:grid-cols-[minmax(240px,34%)_1fr]">
      <aside className="atlas-stage rounded-2xl border border-gym-border/70 p-4">
        <div className="atlas-scan" />
        <div className="relative z-10 mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-gym-muted">
            Atlas {view === "front" ? "frontal" : "posterior"}
          </div>
          <div className="flex rounded-xl border border-gym-border/80 p-0.5">
            <button
              onClick={() => setView("front")}
              className={`rounded-lg px-3 py-1 text-[11px] font-semibold ${view === "front" ? "bg-gym-primary/20 text-gym-primary" : "text-gym-muted"}`}
            >
              Frente
            </button>
            <button
              onClick={() => setView("back")}
              className={`rounded-lg px-3 py-1 text-[11px] font-semibold ${view === "back" ? "bg-gym-primary/20 text-gym-primary" : "text-gym-muted"}`}
            >
              Espalda
            </button>
          </div>
        </div>
        <BodyAtlas view={view} roleOf={roleOf} onPick={() => {}} />
        <p className="relative z-10 mt-2 text-[11px] text-gym-muted">
          {structuresOn(view).filter((s) => s.group === exercise.primary).map((s) => s.name).join(" · ") || MUSCLE_BY_ID[exercise.primary].name}
        </p>
        <div className="relative z-10 mt-3 flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wider">
          <span className="rounded-full bg-gym-primary/15 px-2 py-1 text-gym-primary">Trabajo</span>
          <span className="rounded-full bg-gym-violet/15 px-2 py-1 text-violet-300">Asiste</span>
          <span className="rounded-full bg-status-warn/15 px-2 py-1 text-status-warn">Calentar</span>
        </div>
      </aside>

      <section className="glass p-5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gym-primary">
          {exercise.classification} · {exercise.level}
        </div>
        <h1 className="mt-1 text-2xl font-extrabold text-white">{exercise.name}</h1>
        <p className="mt-2 text-sm leading-relaxed text-gym-muted">{exercise.why}</p>
        <div className="mt-2 text-[11px] text-gym-muted">
          {exercise.equipment} · Tempo {exercise.tempo}
        </div>

        <div className="mt-5">
          <ExerciseDemo exerciseId={exercise.id} motion={motion ?? null} />
        </div>

        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Secuencia del movimiento</div>
              <div className="text-xs text-gym-muted">Paso {step + 1} de {exercise.steps.length}</div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0} className="rounded-lg border border-gym-border px-3 py-2 text-sm text-white disabled:opacity-40">Anterior</button>
              <button type="button" onClick={() => setStep((n) => Math.min(exercise.steps.length - 1, n + 1))} disabled={step === exercise.steps.length - 1} className="rounded-lg border border-gym-border px-3 py-2 text-sm text-white disabled:opacity-40">Siguiente</button>
            </div>
          </div>
          <ol className="mt-2 space-y-2">
            {exercise.steps.map((s, i) => (
              <li
                key={s.title}
                className={`rounded-xl border px-3 py-2 ${
                  i === step ? "border-gym-primary/50 bg-gym-primary/10" : "border-gym-border/60 bg-gym-navy/30"
                }`}
              >
                <div className="text-[11px] font-bold text-gym-primary">
                  {i + 1}. {s.title}
                </div>
                <div className="text-sm text-gym-silver">{s.text}</div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-status-ok">Hazlo así</div>
            <ul className="mt-2 space-y-1.5 text-sm text-gym-silver">
              {exercise.cues.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-ok" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-status-err">Errores que cortamos</div>
            <ul className="mt-2 space-y-1.5 text-sm text-gym-silver">
              {exercise.mistakes.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-err" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
