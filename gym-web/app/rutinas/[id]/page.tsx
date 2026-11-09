"use client";

import { useEffect, useState } from "react";
import GymShell from "../../../components/GymShell";
import { AssignRoutine } from "../../../components/routines/AssignRoutine";
import { ExecutionPeek } from "../../../components/routines/ExecutionPeek";
import { EXERCISES } from "../../../lib/exercisesCatalog";
import { MUSCLE_BY_ID } from "../../../lib/muscles";
import { draftOf, latestPublished, trainingDays, type RoutineDay, type RoutineTemplate } from "../../../lib/routineTypes";
import { getActiveGymId } from "../../../lib/session";

const KIND: Record<string, string> = {
  ejercicio: "Ejercicio",
  superserie: "Superserie",
  circuito: "Circuito",
  calentamiento: "Calentamiento",
};

export default function RutinaPage({ params }: { params: { id: string } }) {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [error, setError] = useState("");
  const [showDraft, setShowDraft] = useState(false);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    fetch(`/api/routines/${params.id}?gym=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) setError(data.error || "No está en esta sede.");
        else setTemplate(data.template);
      })
      .catch(() => setError("No se pudo leer la plantilla."));
  }, [params.id]);

  const published = template ? latestPublished(template) : null;
  const draft = template ? draftOf(template) : null;
  const shown = showDraft && draft ? draft : published || draft;

  return (
    <GymShell active="rutinas">
      <div className="px-6 py-6">
        <a href="/rutinas" className="text-xs font-semibold text-gym-primary">Centro de programación</a>
        {error && <p className="mt-4 text-sm text-status-err">{error}</p>}
        {!template && !error && <p className="mt-4 text-sm text-gym-muted">Leyendo la plantilla…</p>}
        {template && shown && (
          <>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">
                  {shown.status === "publicada" ? "Versión publicada" : "Borrador"}
                </p>
                <h2 className="text-2xl font-extrabold text-white">{template.name}</h2>
                <p className="mt-1 text-sm text-gym-muted">
                  {template.goal} · {template.level} · {trainingDays(shown.days)} días / semana · versión {shown.number}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {published && draft && (
                  <button type="button" onClick={() => setShowDraft((value) => !value)} className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver">
                    {showDraft ? "Ver la publicada" : "Ver el borrador"}
                  </button>
                )}
                <a href={`/rutinas/${template.id}/editar`} className="btn-gym">{draft ? "Seguir el borrador" : "Nueva versión"}</a>
              </div>
            </div>
            <p className="mt-3 text-xs text-gym-muted">
              {shown.status === "publicada"
                ? "Esta es la versión que recibe el socio al asignarla. El registro de lo que realmente hizo queda aparte."
                : "El borrador no se entrega. Publícalo para poder asignarlo."}
            </p>

            <div className="mt-5">
              <AssignRoutine gymId={gymId} templateId={template.id} templateName={template.name} published={Boolean(published)} />
            </div>

            <Week days={shown.days} />
          </>
        )}
      </div>
    </GymShell>
  );
}

function Week({ days }: { days: RoutineDay[] }) {
  return (
    <div className="mt-5 flex flex-col gap-4">
      {days.map((day) => (
        <section key={day.id} className="glass p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-extrabold text-white">{day.label} · {day.rest ? "Descanso" : day.title}</h3>
            {!day.rest && (
              <span className="rounded-full bg-gym-primary/15 px-2 py-0.5 text-[11px] font-semibold text-gym-primary">
                {(() => {
                  const count = day.blocks.reduce((n, block) => n + block.items.length, 0);
                  return `${count} ejercicio${count === 1 ? "" : "s"}`;
                })()}
              </span>
            )}
          </div>
          {day.rest && <p className="mt-2 text-sm text-gym-muted">Sin ejercicios.</p>}
          <div className="mt-3 flex flex-col gap-3">
            {day.blocks.map((block) => (
              <div key={block.id}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-gym-muted">{KIND[block.kind] || block.kind}</div>
                <ol className="mt-1">
                  {block.items.map((item, index) => {
                    const exercise = EXERCISES.find((entry) => entry.id === item.exerciseId);
                    const alternative = EXERCISES.find((entry) => entry.id === item.alternativeId);
                    return (
                      <li key={item.id} className="border-t border-gym-border/40 py-3 first:border-t-0">
                        <ExecutionPeek
                          exerciseId={item.exerciseId}
                          prescription={{ sets: item.sets, reps: item.reps, restSec: item.restSec, tempo: item.tempo || exercise?.tempo || "" }}
                        >
                          <span className="font-semibold text-white">{String(index + 1).padStart(2, "0")} {exercise?.name || item.exerciseId}</span>
                        </ExecutionPeek>
                        <p className="mt-1 text-xs text-gym-muted">
                          {exercise ? `${MUSCLE_BY_ID[exercise.primary].name} · ` : ""}
                          {item.sets} series · {item.reps} · {item.restSec} s
                          {item.load ? ` · carga ${item.load}` : ""}
                          {item.effort ? ` · ${item.effort}` : ""}
                          {item.tempo ? ` · tempo ${item.tempo}` : ""}
                        </p>
                        {alternative && <p className="text-xs text-gym-muted">Si falta el equipo: {alternative.name}</p>}
                        {item.note && <p className="text-xs text-gym-silver">{item.note}</p>}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
