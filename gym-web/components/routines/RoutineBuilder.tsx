"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EXERCISES, type Exercise } from "../../lib/exercisesCatalog";
import { substitutesOf } from "../../lib/exerciseLibrary";
import { MUSCLE_BY_ID, MUSCLES, type MuscleId } from "../../lib/muscles";
import { ROUTINE_GOALS, exerciseCount, trainingDays, type BlockKind, type RoutineDay, type RoutineLevel, type RoutineTemplate } from "../../lib/routineTypes";
import { ExecutionPeek } from "./ExecutionPeek";
import { ExercisePicker } from "./ExercisePicker";

const LEVELS: RoutineLevel[] = ["Inicio", "Intermedio", "Avanzado"];
const KINDS: { id: BlockKind; label: string }[] = [
  { id: "ejercicio", label: "Ejercicio" },
  { id: "superserie", label: "Superserie" },
  { id: "circuito", label: "Circuito" },
  { id: "calentamiento", label: "Calentamiento" },
];

function uid() {
  return crypto.randomUUID();
}

function blankItem(exerciseId: string) {
  return { id: uid(), exerciseId, sets: 3, reps: "8-12", restSec: 90, load: "", effort: "", tempo: "", alternativeId: "", note: "" };
}

function catalog(id: string) {
  return EXERCISES.find((e) => e.id === id) || null;
}

function musclesOf(e: Exercise) {
  return [e.primary, ...e.secondary].slice(0, 3).map((id) => MUSCLE_BY_ID[id].name).join(" · ");
}

export function RoutineBuilder({ gymId, initial }: { gymId: string; initial: RoutineTemplate | null }) {
  const router = useRouter();
  const draft = initial?.versions.find((v) => v.status === "borrador") || null;
  const [id, setId] = useState(initial?.id || "");
  const [name, setName] = useState(initial?.name || "");
  const [goal, setGoal] = useState(initial?.goal || "Hipertrofia");
  const [level, setLevel] = useState<RoutineLevel>(initial?.level || "Intermedio");
  const seeded = draft?.days?.length ? draft.days : seedDays();
  const [days, setDays] = useState<RoutineDay[]>(seeded);
  const [dayId, setDayId] = useState(seeded[0]?.id || "");
  const [picker, setPicker] = useState<null | { blockId?: string }>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    const exerciseId = new URLSearchParams(window.location.search).get("ejercicio");
    if (!exerciseId || !catalog(exerciseId)) return;
    const item = blankItem(exerciseId);
    setOpenId(item.id);
    setDays((current) => {
      if (current.some((day) => day.blocks.length)) return current;
      const first = current.find((day) => !day.rest);
      if (!first) return current;
      return current.map((day) => day.id === first.id ? { ...day, blocks: [{ id: uid(), kind: "ejercicio", items: [item] }] } : day);
    });
  }, [initial]);

  useEffect(() => {
    if (!days.length) return;
    if (!days.some((d) => d.id === dayId)) setDayId(days[0].id);
  }, [days, dayId]);

  const day = days.find((d) => d.id === dayId) || days[0];
  const version = initial?.versions.find((v) => v.id && v.status === "borrador") || draft;
  const publishedBefore = (initial?.versions.filter((v) => v.status === "publicada").length || 0) > 0;

  const payload = useMemo(() => ({ gym: gymId, name, goal, level, days }), [gymId, name, goal, level, days]);

  function patchDay(next: RoutineDay) {
    setDays((cur) => cur.map((d) => (d.id === next.id ? next : d)));
  }

  function addExercise(exercise: Exercise) {
    if (!day || day.rest) return;
    const item = blankItem(exercise.id);
    setOpenId(item.id);
    setDays((cur) => cur.map((d) => {
      if (d.id !== day.id) return d;
      if (picker?.blockId) {
        return {
          ...d,
          blocks: d.blocks.map((b) => {
            if (b.id !== picker.blockId) return b;
            if (b.items.some((i) => i.exerciseId === exercise.id)) return b;
            const kind: BlockKind = b.kind === "ejercicio" ? "superserie" : b.kind;
            return { ...b, kind, items: [...b.items, item] };
          }),
        };
      }
      return { ...d, blocks: [...d.blocks, { id: uid(), kind: "ejercicio", items: [item] }] };
    }));
    setPicker(null);
  }

  async function persist(action?: "publicar") {
    if (!name.trim()) {
      setMsg("Escribe el nombre de la plantilla.");
      return;
    }
    setBusy(true);
    setMsg("");
    let current = id;
    if (!current) {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setBusy(false);
        setMsg(data.error || "No se pudo crear.");
        return;
      }
      current = data.template.id;
      setId(current);
      if (action !== "publicar") router.replace(`/rutinas/${current}/editar`);
    } else {
      const res = await fetch(`/api/routines/${current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        setBusy(false);
        setMsg(data.error || "No se pudo guardar.");
        return;
      }
    }
    if (action === "publicar") {
      const res = await fetch(`/api/routines/${current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym: gymId, action: "publicar" }),
      });
      const data = await res.json();
      setBusy(false);
      if (!data.ok) {
        setMsg(data.error || "No se pudo publicar.");
        return;
      }
      router.push(`/rutinas/${current}`);
      return;
    }
    setBusy(false);
    setMsg("Borrador guardado. La versión publicada, si ya había una, no cambió.");
  }

  async function remove() {
    if (!id) {
      router.push("/rutinas");
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    await fetch(`/api/routines/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, action: "eliminar" }),
    });
    router.push("/rutinas");
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">{id ? "Plantilla" : "Nueva plantilla"}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre de la rutina" className="mt-1 w-full max-w-md bg-transparent text-2xl font-extrabold text-white outline-none placeholder:text-gym-muted" />
          <p className="mt-1 text-xs text-gym-muted">
            {version ? `Versión ${version.number} · borrador` : "Borrador · sin asignar"}
            {" · "}{trainingDays(days)} días / semana · {exerciseCount(days) === 1 ? "1 ejercicio" : `${exerciseCount(days)} ejercicios`}
            {publishedBefore ? " · publicar conserva la versión anterior" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/rutinas" className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver">Volver</a>
          {id && <a href={`/rutinas/${id}`} className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver">Vista previa</a>}
          <button type="button" disabled={busy} onClick={() => persist()} className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver disabled:opacity-40">Guardar borrador</button>
          <button type="button" disabled={busy} onClick={() => persist("publicar")} className="btn-gym disabled:opacity-40">Publicar</button>
        </div>
      </div>

      {msg && <p className="mb-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</p>}
      <p className="mb-4 text-xs text-gym-muted">Publicar congela esta versión. Asignarla a un socio se hace después, desde la vista previa.</p>

      <div className="mb-4 flex flex-wrap gap-2">
        {ROUTINE_GOALS.map((g) => (
          <button key={g} type="button" onClick={() => setGoal(g)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${goal === g ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{g}</button>
        ))}
        <span className="mx-1 w-px bg-gym-border" />
        {LEVELS.map((l) => (
          <button key={l} type="button" onClick={() => setLevel(l)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${level === l ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{l}</button>
        ))}
      </div>

      <VolumePlan days={days} />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {days.map((d, i) => {
          const count = d.blocks.reduce((n, block) => n + block.items.length, 0);
          return (
            <button key={d.id} type="button" onClick={() => setDayId(d.id)} className={`min-w-[9.5rem] rounded-xl border px-3 py-2 text-left ${d.id === day?.id ? "border-gym-primary bg-gym-primary/10" : "border-gym-border"}`}>
              <div className="text-[11px] uppercase tracking-wide text-gym-muted">{d.label || `Día ${i + 1}`}</div>
              <div className="truncate text-sm font-semibold text-white">{d.rest ? "Descanso" : d.title || "Sesión"}</div>
              <div className={`mt-1 text-[11px] font-semibold ${d.rest ? "text-gym-muted" : "text-gym-primary"}`}>{d.rest ? "Sin ejercicios" : `${count} ejercicio${count === 1 ? "" : "s"}`}</div>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            const next: RoutineDay = { id: uid(), label: `Día ${days.length + 1}`, title: "Sesión", rest: false, blocks: [] };
            setDays((cur) => [...cur, next]);
            setDayId(next.id);
          }}
          className="min-w-[7rem] rounded-xl border border-dashed border-gym-border px-3 py-2 text-sm text-gym-muted"
        >
          Añadir día
        </button>
      </div>

      {day && (
        <section className="glass p-4">
          <div className="flex flex-wrap items-center gap-2">
            <input value={day.label} onChange={(e) => patchDay({ ...day, label: e.target.value })} className="w-24 rounded-lg border border-gym-border bg-transparent px-2 py-1.5 text-sm text-white outline-none" />
            <input value={day.title} onChange={(e) => patchDay({ ...day, title: e.target.value })} disabled={day.rest} className="min-w-0 flex-1 rounded-lg border border-gym-border bg-transparent px-2 py-1.5 text-sm text-white outline-none disabled:opacity-40" />
            <button type="button" onClick={() => patchDay({ ...day, rest: !day.rest, title: !day.rest ? "Descanso" : "Sesión", blocks: !day.rest ? [] : day.blocks })} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${day.rest ? "border-gym-primary text-gym-primary" : "border-gym-border text-gym-muted"}`}>
              {day.rest ? "Es descanso" : "Marcar descanso"}
            </button>
            {days.length > 1 && (
              <button type="button" onClick={() => setDays((cur) => cur.filter((d) => d.id !== day.id))} className="text-xs text-status-err">Quitar día</button>
            )}
          </div>

          {day.rest ? (
            <p className="mt-6 text-sm text-gym-muted">Este día no lleva ejercicios.</p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {day.blocks.map((block, bi) => (
                <article key={block.id} className="rounded-xl border border-gym-border/70 bg-gym-black/20 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <select
                      value={block.kind}
                      onChange={(e) => patchDay({ ...day, blocks: day.blocks.map((b) => b.id === block.id ? { ...b, kind: e.target.value as BlockKind, items: e.target.value === "ejercicio" ? b.items.slice(0, 1) : b.items } : b) })}
                      className="rounded-lg border border-gym-border bg-gym-navy px-2 py-1 text-xs text-white"
                    >
                      {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                    <span className="text-[11px] text-gym-muted">{block.items.length} ejercicio{block.items.length === 1 ? "" : "s"}</span>
                    <div className="ml-auto flex gap-2">
                      <button type="button" disabled={bi === 0} onClick={() => patchDay({ ...day, blocks: swap(day.blocks, bi, bi - 1) })} className="text-xs text-gym-muted disabled:opacity-30">Subir</button>
                      <button type="button" disabled={bi === day.blocks.length - 1} onClick={() => patchDay({ ...day, blocks: swap(day.blocks, bi, bi + 1) })} className="text-xs text-gym-muted disabled:opacity-30">Bajar</button>
                      {block.kind !== "ejercicio" && (
                        <button type="button" onClick={() => setPicker({ blockId: block.id })} className="text-xs font-semibold text-gym-primary">Añadir al grupo</button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {block.items.map((item, index) => {
                      const ex = catalog(item.exerciseId);
                      const swaps = substitutesOf(item.exerciseId);
                      const swapIds = new Set(swaps.map((entry) => entry.id));
                      const others = EXERCISES.filter((entry) => entry.id !== item.exerciseId && !swapIds.has(entry.id));
                      const open = openId === item.id;
                      const order = day.blocks.slice(0, bi).reduce((n, entry) => n + entry.items.length, 0) + index + 1;
                      return (
                        <div key={item.id} className="rounded-lg border border-gym-border/50 px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-white">
                                <span className="mr-2 text-gym-muted">{String(order).padStart(2, "0")}</span>
                                {ex?.name || "Ejercicio quitado del catálogo"}
                              </div>
                              <div className="mt-0.5 text-xs text-gym-muted">
                                {item.sets} series · {item.reps} · {item.restSec} s descanso
                                {ex ? ` · ${ex.equipment}` : ""}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-3">
                              <button type="button" onClick={() => setOpenId(open ? null : item.id)} className="text-xs font-semibold text-gym-primary">{open ? "Cerrar" : "Ajustar"}</button>
                              <button type="button" onClick={() => patchDay({ ...day, blocks: day.blocks.flatMap((b) => b.id !== block.id ? [b] : [{ ...b, items: b.items.filter((i) => i.id !== item.id) }]).filter((b) => b.items.length) })} className="text-xs text-status-err">Quitar</button>
                            </div>
                          </div>
                          {open && (
                            <div className="mt-3 border-t border-gym-border/50 pt-3">
                              <ExecutionPeek
                                exerciseId={item.exerciseId}
                                prescription={{ sets: item.sets, reps: item.reps, restSec: item.restSec, tempo: item.tempo || ex?.tempo || "" }}
                              >
                                <div className="text-[11px] text-gym-muted">{ex ? `${musclesOf(ex)}` : "Sin ficha"}</div>
                              </ExecutionPeek>
                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <Field label="Series" value={String(item.sets)} onChange={(v) => setItem(day, block.id, item.id, { sets: Math.max(1, Math.round(Number(v) || 1)) })} />
                                <Field label="Repeticiones" value={item.reps} onChange={(v) => setItem(day, block.id, item.id, { reps: v })} placeholder="8-10 o 30 s" />
                                <Field label="Descanso (s)" value={String(item.restSec)} onChange={(v) => setItem(day, block.id, item.id, { restSec: Math.max(0, Math.round(Number(v) || 0)) })} />
                                <Field label="Carga" value={item.load} onChange={(v) => setItem(day, block.id, item.id, { load: v })} placeholder="Opcional" />
                                <Field label="RIR o RPE" value={item.effort} onChange={(v) => setItem(day, block.id, item.id, { effort: v })} placeholder="Opcional" />
                                <Field label="Tempo" value={item.tempo} onChange={(v) => setItem(day, block.id, item.id, { tempo: v })} placeholder={ex?.tempo || "2 · 1 · 2"} />
                                <label className="col-span-2 text-[11px] text-gym-muted">
                                  Alternativa
                                  <select value={item.alternativeId} onChange={(e) => setItem(day, block.id, item.id, { alternativeId: e.target.value })} className="mt-1 block w-full rounded-lg border border-gym-border bg-gym-navy px-2 py-1.5 text-sm text-white">
                                    <option value="">Ninguna</option>
                                    {swaps.length > 0 && <optgroup label="Mismo patrón y misma mecánica">{swaps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>}
                                    <optgroup label="Resto del catálogo">{others.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>
                                  </select>
                                  {!item.alternativeId && swaps[0] && (
                                    <button type="button" onClick={() => setItem(day, block.id, item.id, { alternativeId: swaps[0].id })} className="mt-1 text-left text-[11px] font-semibold text-gym-primary">
                                      Si falta el equipo: {swaps[0].name}
                                    </button>
                                  )}
                                </label>
                              </div>
                              <label className="mt-2 block text-[11px] text-gym-muted">
                                Nota para este socio
                                <input value={item.note} onChange={(e) => setItem(day, block.id, item.id, { note: e.target.value })} placeholder="Técnica, máquina ocupada, rango de dolor…" className="mt-1 w-full rounded-lg border border-gym-border bg-transparent px-2 py-1.5 text-sm text-white outline-none" />
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
              <button type="button" onClick={() => setPicker({})} className="rounded-xl border border-dashed border-gym-border px-4 py-3 text-sm font-semibold text-gym-silver">Añadir ejercicio desde el atlas</button>
            </div>
          )}
        </section>
      )}

      <div className="mt-4">
        <button type="button" onClick={remove} className={`text-xs font-semibold ${confirmDelete ? "text-status-err" : "text-gym-muted"}`}>{confirmDelete ? "Sí, eliminar esta plantilla y sus versiones" : "Eliminar plantilla"}</button>
      </div>

      {picker && <ExercisePicker onClose={() => setPicker(null)} onPick={addExercise} />}
    </div>
  );

  function setItem(current: RoutineDay, blockId: string, itemId: string, patch: Record<string, string | number>) {
    patchDay({
      ...current,
      blocks: current.blocks.map((b) => b.id !== blockId ? b : {
        ...b,
        items: b.items.map((i) => i.id === itemId ? { ...i, ...patch } : i),
      }),
    });
  }
}

function VolumePlan({ days }: { days: RoutineDay[] }) {
  const rows = useMemo(() => {
    const counts = new Map<MuscleId, number>();
    for (const day of days) {
      if (day.rest) continue;
      for (const block of day.blocks) {
        for (const item of block.items) {
          const ex = EXERCISES.find((e) => e.id === item.exerciseId);
          if (!ex) continue;
          counts.set(ex.primary, (counts.get(ex.primary) || 0) + Math.max(0, Number(item.sets) || 0));
        }
      }
    }
    return MUSCLES.filter((m) => m.id !== "full-body").map((m) => ({ name: m.name, sets: counts.get(m.id) || 0 }));
  }, [days]);
  const used = rows.filter((r) => r.sets > 0);
  const empty = rows.filter((r) => r.sets === 0);
  return (
    <section className="mb-4 rounded-xl border border-gym-border/70 px-4 py-3">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gym-muted">Volumen planificado</div>
      <p className="mt-1 text-[11px] text-gym-muted">Series de trabajo por músculo principal. No mide activación: cada ejercicio cuenta una sola vez.</p>
      {used.length === 0 ? (
        <p className="mt-2 text-sm text-gym-silver">Todavía no hay series. Aparecen al añadir ejercicios.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {used.map((r) => (
            <li key={r.name} className="rounded-full bg-gym-primary/15 px-2.5 py-1 text-xs font-semibold text-gym-primary">{r.name} · {r.sets}</li>
          ))}
        </ul>
      )}
      {used.length > 0 && <p className="mt-2 text-[11px] text-gym-muted">Sin series en esta plantilla: {empty.map((r) => r.name).join(", ")}.</p>}
    </section>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="text-[11px] text-gym-muted">
      {label}
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-gym-border bg-transparent px-2 py-1.5 text-sm text-white outline-none" />
    </label>
  );
}

function seedDays(): RoutineDay[] {
  return [
    { id: uid(), label: "Día 1", title: "Tren superior", rest: false, blocks: [] },
    { id: uid(), label: "Día 2", title: "Tren inferior", rest: false, blocks: [] },
    { id: uid(), label: "Día 3", title: "Descanso", rest: true, blocks: [] },
    { id: uid(), label: "Día 4", title: "Tren superior", rest: false, blocks: [] },
    { id: uid(), label: "Día 5", title: "Tren inferior", rest: false, blocks: [] },
  ];
}

function swap<T>(list: T[], a: number, b: number) {
  const next = list.slice();
  const tmp = next[a];
  next[a] = next[b];
  next[b] = tmp;
  return next;
}
