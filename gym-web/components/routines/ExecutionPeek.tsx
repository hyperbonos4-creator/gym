"use client";

import { useState, type ReactNode } from "react";
import { EXERCISES } from "../../lib/exercisesCatalog";
import { movementOf } from "../../lib/movement";
import { MovementPlayer, type Prescription } from "../exercises/MovementPlayer";

export function ExecutionPeek({
  exerciseId,
  children,
  aside,
  prescription,
}: {
  exerciseId: string;
  children: ReactNode;
  aside?: ReactNode;
  prescription?: Prescription;
}) {
  const [open, setOpen] = useState(false);
  const exercise = EXERCISES.find((e) => e.id === exerciseId);
  const view = movementOf(exerciseId);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">{children}</div>
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-semibold text-gym-primary">
            {open ? "Ocultar ejecución" : "Ver ejecución"}
          </button>
          {aside}
        </div>
      </div>
      {open && (
        <div className="mt-3 flex gap-3 rounded-xl border border-gym-border/70 bg-black/40 p-2">
          <MovementPlayer exerciseId={exerciseId} compact prescription={prescription} />
          <div className="min-w-0 text-[12px] leading-snug text-gym-silver">
            <div className="font-semibold text-white">{exercise?.name || "Ejercicio quitado del catálogo"}</div>
            {view && view.clip.kind !== "none" ? (
              <>
                <p className="mt-1"><span className="text-gym-muted">Qué usar. </span>{view.machine}</p>
                {view.place && <p><span className="text-gym-muted">Colocación. </span>{view.place}</p>}
                {view.grip && <p><span className="text-gym-muted">Agarre. </span>{view.grip}</p>}
                <p><span className="text-gym-muted">Músculos. </span>{view.primary}{view.secondary.length ? ` · ${view.secondary.join(", ")}` : ""}</p>
                {view.mistakes[0] && <p><span className="text-gym-muted">Error frecuente. </span>{view.mistakes[0]}</p>}
              </>
            ) : (
              <p className="mt-1 text-gym-muted">Este ejercicio no tiene demostración. La ficha de la rutina sigue abierta.</p>
            )}
            {exercise?.cues[0] && <p className="mt-1 text-gym-primary">{exercise.cues[0]}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
