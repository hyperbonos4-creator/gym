"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import GymShell from "../../components/GymShell";
import SendToClients from "../../components/exercises/SendToClients";
import { UseInRoutine } from "../../components/routines/UseInRoutine";

const MannequinClip = dynamic(() => import("../../components/motion-studio/MannequinClip").then((m) => m.MannequinClip), { ssr: false });
import { EXERCISES, exercisesForMuscle, exercisesForWarmupMuscle, type Exercise } from "../../lib/exercisesCatalog";
import { PATTERN_LABEL, libraryOf, substitutesOf } from "../../lib/exerciseLibrary";
import { structureById } from "../../lib/anatomy";
import { MUSCLE_BY_ID, MUSCLES, type MuscleId } from "../../lib/muscles";
import { getActiveGymId } from "../../lib/session";

export default function EjerciciosPage() {
  const [muscle, setMuscle] = useState<MuscleId | null>(null);
  const [structureId, setStructureId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Exercise | null>(EXERCISES[0]);
  const [step, setStep] = useState(0);
  const [client, setClient] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [gymId, setGymId] = useState("fuerza-elite");

  const list = useMemo(() => {
    if (structureId && structureById(structureId)?.catalog === null) return [];
    const base = exercisesForMuscle(muscle);
    const s = q.trim().toLowerCase();
    if (!s) return base;
    return base.filter((e) =>
      `${e.name} ${e.equipment} ${e.classification} ${e.primary} ${PATTERN_LABEL[libraryOf(e).pattern]}`.toLowerCase().includes(s),
    );
  }, [muscle, q, structureId]);

  const warmupOnly = useMemo(() => {
    if (!muscle || muscle === "full-body" || structureId && structureById(structureId)?.catalog === null) return [];
    const training = new Set(list.map((e) => e.id));
    return exercisesForWarmupMuscle(muscle).filter((e) => !training.has(e.id));
  }, [muscle, list, structureId]);

  useEffect(() => {
    setStep(0);
  }, [sel]);

  function pickMuscle(id: MuscleId) {
    const nextMuscle = muscle === id ? null : id;
    setStructureId(null);
    setMuscle(nextMuscle);
    if (!nextMuscle) return;
    setSel(exercisesForMuscle(nextMuscle)[0] ?? null);
  }

  function resetBodyFilter() {
    setStructureId(null);
    setMuscle(null);
  }

  useEffect(() => {
    setGymId(getActiveGymId() || "fuerza-elite");
    const id = new URLSearchParams(location.search).get("x") || new URLSearchParams(location.search).get("ex");
    if (!id) return;
    const found = EXERCISES.find((e) => e.id === id);
    if (found) {
      setSel(found);
      setMuscle(found.primary);
    }
  }, []);

  const withClip = EXERCISES.filter((item) => libraryOf(item).studio).length;
  const selectedCard = sel ? libraryOf(sel) : null;
  const swaps = sel ? substitutesOf(sel.id) : [];

  return (
    <GymShell active="ejercicios">
      <div className={`flex min-h-[calc(100vh-73px)] flex-col ${client ? "bg-[#05070d]" : ""}`}>
        <div className="flex shrink-0 flex-col gap-3 border-b border-gym-border/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight text-white sm:text-xl">Atlas de ejercicios</h2>
            <p className="text-[13px] leading-relaxed text-gym-muted sm:text-sm">
              Biblioteca técnica. El ciclo 3D muestra el recorrido y no certifica la técnica.
            </p>
            {!client && (
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  ["Catálogo", String(EXERCISES.length)],
                  ["Ciclo 3D", String(withClip)],
                  ["Técnica", "Por revisar"],
                ].map(([label, value]) => (
                  <span key={label} className="rounded-full border border-gym-border/80 px-2.5 py-1 text-[11px] text-gym-muted">
                    {label} <span className="font-bold text-white">{value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              onClick={() => setClient((v) => !v)}
              className={`w-full rounded-xl border px-3 py-2.5 text-center text-[12px] font-semibold sm:w-auto sm:py-2 sm:text-[11px] ${
                client ? "border-gym-accent/50 bg-gym-accent/10 text-gym-accent" : "border-gym-border text-gym-silver"
              }`}
            >
              {client ? "Vista cliente" : "Vista entrenador"}
            </button>
            <button
              onClick={() => sel && setSendOpen(true)}
              disabled={!sel}
              className="btn-gym w-full !px-3 !py-2.5 !text-[12px] disabled:opacity-40 sm:w-auto sm:!py-2 sm:!text-[11px]"
            >
              Enviar al cliente
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,38%)_1fr]">
          <aside className="border-b border-gym-border/60 p-4 lg:border-b-0 lg:border-r">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-gym-muted">Maniquí 3D</div>
            {selectedCard?.studio ? (
              <MannequinClip clipKey={selectedCard.studio} frameClassName="h-[min(68vh,520px)]" />
            ) : (
              <div className="grid h-80 place-items-center rounded-2xl border border-dashed border-gym-border px-4 text-center text-sm text-gym-muted">
                {sel ? "Este ejercicio no tiene ciclo 3D." : "Elegí un ejercicio para ver el maniquí."}
              </div>
            )}
          </aside>

          <section className="min-h-0 overflow-y-auto p-5">
            {!client && (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar ejercicio, músculo o máquina…"
                    className="min-w-[220px] flex-1 rounded-xl border border-gym-border bg-gym-navy/70 px-3 py-2 text-sm text-gym-silver outline-none focus:border-gym-primary"
                  />
                  <button
                    onClick={resetBodyFilter}
                    className="rounded-xl border border-gym-border px-3 py-2 text-[11px] font-semibold text-gym-muted"
                  >
                    Todo el cuerpo
                  </button>
                </div>
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {MUSCLES.filter((m) => m.id !== "full-body").map((m) => (
                    <button
                      key={m.id}
                      onClick={() => pickMuscle(m.id)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                        muscle === m.id
                          ? "border-gym-primary/60 bg-gym-primary/15 text-gym-primary"
                          : "border-gym-border/80 text-gym-muted hover:text-gym-silver"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {list.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setSel(e)}
                      className={`overflow-hidden rounded-2xl border text-left transition-all ${
                        sel?.id === e.id
                          ? "border-gym-primary/50 bg-gym-primary/10 shadow-glow"
                          : "border-gym-border/70 bg-gym-panel/40 hover:border-gym-primary/30"
                      }`}
                    >
                      <div className="p-3">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">
                          {PATTERN_LABEL[libraryOf(e).pattern]} · {e.equipment}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-white">{e.name}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${libraryOf(e).studio ? "bg-gym-primary/20 text-gym-primary" : "bg-white/5 text-gym-muted"}`}>
                            {libraryOf(e).studio ? "3D" : "Sin ciclo"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {warmupOnly.length > 0 && (
                  <div className="mb-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gym-muted">Solo en la preparación</div>
                    <p className="mt-1 text-xs text-gym-muted">Estos ejercicios no entrenan este músculo. Lo mencionan antes de la serie.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {warmupOnly.map((e) => (
                        <button key={e.id} type="button" onClick={() => setSel(e)} className="rounded-full border border-gym-border px-3 py-1 text-[11px] text-gym-silver">
                          {e.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {list.length === 0 && structureById(structureId || "")?.catalog === null && (
                  <div className="mb-5 rounded-2xl border border-dashed border-gym-border px-4 py-6 text-sm text-gym-silver">
                    {structureById(structureId || "")?.note || "No hay un ejercicio asociado a esta estructura."}
                  </div>
                )}
              </>
            )}

            {sel && (
              <div className="glass p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gym-primary">
                      {selectedCard ? PATTERN_LABEL[selectedCard.pattern] : sel.classification} · {sel.level}
                      {selectedCard?.laterality === "unilateral" ? " · un lado" : ""}
                    </div>
                    <h3 className="mt-1 text-2xl font-extrabold text-white">{sel.name}</h3>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gym-muted">{sel.why}</p>
                    {swaps.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {swaps.map((swap) => (
                          <button key={swap.id} type="button" onClick={() => setSel(swap)} className="rounded-full border border-gym-border px-3 py-1 text-[11px] text-gym-silver">
                            Si falta el equipo: {swap.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${selectedCard?.studio ? "bg-gym-primary/20 text-gym-primary" : "bg-white/5 text-gym-muted"}`}>
                        {selectedCard?.studio ? "Ciclo 3D disponible" : "Sin ciclo 3D"}
                      </span>
                      {!client && <span className="rounded-full bg-status-warn/15 px-2 py-1 text-[10px] font-bold text-status-warn">Técnica por revisar</span>}
                      {!client && selectedCard?.studio && (
                        <a href={`/estudio?modelo=${selectedCard.studio}`} className="rounded-xl border border-gym-border px-3 py-2 text-[11px] font-bold text-gym-silver">
                          Abrir en Motion Studio
                        </a>
                      )}
                      {!client && <UseInRoutine gymId={gymId} exerciseId={sel.id} exerciseName={sel.name} />}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-gym-muted">
                    <div>Tempo {sel.tempo}</div>
                    <div>{sel.equipment}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Fact label="Músculo principal" value={MUSCLE_BY_ID[sel.primary].name} detail={sel.secondary.length ? `Asisten ${sel.secondary.map((id) => MUSCLE_BY_ID[id].name).join(", ")}` : ""} />
                  <Fact label="Equipamiento" value={sel.equipment} />
                  <Fact label="Preparación" value={sel.steps[0]?.text || "Sin preparación escrita."} />
                  <Fact label="Alternativa" value={swaps[0]?.name || "Sin recambio del mismo patrón"} />
                </div>

                <div className="mt-5">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Secuencia del movimiento</div>
                        <div className="text-xs text-gym-muted">Paso {step + 1} de {sel.steps.length}</div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setStep((n) => Math.max(0, n - 1))} disabled={step === 0} className="rounded-lg border border-gym-border px-3 py-2 text-sm text-white disabled:opacity-40">Anterior</button>
                        <button type="button" onClick={() => setStep((n) => Math.min(sel.steps.length - 1, n + 1))} disabled={step === sel.steps.length - 1} className="rounded-lg border border-gym-border px-3 py-2 text-sm text-white disabled:opacity-40">Siguiente</button>
                      </div>
                    </div>
                    <ol className="mt-2 space-y-2">
                      {sel.steps.map((s, i) => (
                        <li
                          key={s.title}
                          className={`rounded-xl border px-3 py-2 ${
                            i === step
                              ? "border-gym-primary/50 bg-gym-primary/10"
                              : "border-gym-border/60 bg-gym-navy/30"
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
                      {sel.cues.map((c) => (
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
                      {sel.mistakes.map((c) => (
                        <li key={c} className="flex gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-err" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
      {sel && (
        <SendToClients
          open={sendOpen}
          exerciseId={sel.id}
          exerciseName={sel.name}
          gymId={gymId}
          onClose={() => setSendOpen(false)}
        />
      )}
    </GymShell>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-gym-border/70 bg-black/20 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
      {detail && <div className="mt-0.5 text-[11px] text-gym-muted">{detail}</div>}
    </div>
  );
}
