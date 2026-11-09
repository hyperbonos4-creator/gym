"use client";

import { useEffect, useMemo, useState } from "react";
import { EXERCISES } from "../../lib/exercisesCatalog";
import {
  JOINTS,
  nearestLabel,
  poseAt,
  standingPose,
  starterKeys,
  type JointId,
  type MotionKeyframe,
  type MotionPiece,
  type Pose,
} from "../../lib/motionModel";
import { getActiveGymId } from "../../lib/session";
import MotionStudioViewport from "../motion-studio/MotionStudioViewport";
import { MotionStage } from "./MotionStage";

type Summary = {
  id: string;
  name: string;
  exerciseId: string;
  status: "borrador" | "publicado";
  version: number;
  updatedAt: string;
};

const VIEWS = [
  { id: "frente", label: "Frente" },
  { id: "perfil", label: "Perfil" },
  { id: "espalda", label: "Espalda" },
] as const;

export default function Studio() {
  const gym = getActiveGymId() || "fuerza-elite";
  const [items, setItems] = useState<Summary[] | null>(null);
  const [piece, setPiece] = useState<MotionPiece | null>(null);
  const [selectedId, setSelectedId] = useState<string>("inicio");
  const [joint, setJoint] = useState<JointId>("cadera-izq");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("frente");
  const [lane, setLane] = useState<"poses" | "personaje">("personaje");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [catalog, setCatalog] = useState("");
  const [previewTime, setPreviewTime] = useState(0);
  const previewKeys = starterKeys(catalog);

  async function reload() {
    const res = await fetch(`/api/motion?gym=${encodeURIComponent(gym)}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items || []);
  }

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (piece) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPreviewTime((t) => (t + dt / 3.2) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [piece, catalog]);

  useEffect(() => {
    if (!playing || !piece) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((t) => (t + dt / 3.2) % 1);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, piece?.id]);

  const selected = piece?.draft.find((k) => k.id === selectedId) || piece?.draft[0] || null;
  const editing = Boolean(piece && selected && !playing && Math.abs(selected.t - time) < 0.03);
  const pose = useMemo(() => {
    if (!piece) return standingPose();
    if (editing && selected) return selected.pose;
    return poseAt(piece.draft, time);
  }, [piece, editing, time, selected]);

  async function open(id: string) {
    setPlaying(false);
    const res = await fetch(`/api/motion/${id}?gym=${encodeURIComponent(gym)}`, { cache: "no-store" });
    const data = await res.json();
    if (!data.piece) return;
    setPiece(data.piece);
    setSelectedId(data.piece.draft[0]?.id || "");
    setTime(0);
    setPlaying(true);
    setNote("Reproduciendo. Elegí una pose y mové una articulación: la animación cambia en ese punto.");
  }

  async function create() {
    setBusy(true);
    setNote("");
    const res = await fetch("/api/motion", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gym, name, exerciseId: catalog }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setNote(data.error || "No se pudo crear.");
      return;
    }
    setName("");
    setCatalog("");
    await reload();
    await open(data.piece.id);
  }

  function patchDraft(next: MotionKeyframe[]) {
    setPiece((curr) => (curr ? { ...curr, draft: next } : curr));
  }

  function editPose(part: "flex" | "open", value: number) {
    if (!piece || !selected || !editing) return;
    const draft = piece.draft.map((key) => {
      if (key.id !== selected.id) return key;
      return { ...key, pose: { ...key.pose, [joint]: { ...key.pose[joint], [part]: value } } };
    });
    patchDraft(draft);
  }

  function addPose() {
    if (!piece) return;
    const poseNow = poseAt(piece.draft, time);
    const id = `pose-${Date.now()}`;
    const next = [...piece.draft, { id, t: round(time), label: `Pose ${piece.draft.length + 1}`, pose: poseNow }];
    patchDraft(next);
    setSelectedId(id);
    setPlaying(false);
  }

  function removePose() {
    if (!piece || piece.draft.length <= 2 || !selected) return;
    const next = piece.draft.filter((k) => k.id !== selected.id);
    patchDraft(next);
    setSelectedId(next[0].id);
  }

  function mirror(kind: "piernas" | "brazos") {
    if (!piece || !selected) return;
    const poseNow: Pose = { ...selected.pose };
    if (kind === "piernas") {
      poseNow["cadera-der"] = { ...poseNow["cadera-izq"] };
      poseNow["rodilla-der"] = { ...poseNow["rodilla-izq"] };
    } else {
      poseNow["brazo-der"] = { ...poseNow["brazo-izq"] };
      poseNow["codo-der"] = { ...poseNow["codo-izq"] };
    }
    patchDraft(piece.draft.map((k) => (k.id === selected.id ? { ...k, pose: poseNow } : k)));
  }

  async function persist(action: "guardar" | "publicar" | "despublicar" | "restaurar") {
    if (!piece) return;
    setBusy(true);
    setNote("");
    const res = await fetch(`/api/motion/${piece.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gym,
        action,
        name: piece.name,
        exerciseId: piece.exerciseId,
        equipment: piece.equipment,
        muscles: piece.muscles,
        technique: piece.technique,
        mistakes: piece.mistakes,
        sets: piece.sets,
        reps: piece.reps,
        draft: piece.draft,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setNote(data.error || "No se pudo guardar.");
      return;
    }
    setPiece(data.piece);
    setNote(action === "publicar"
      ? `Publicada la versión ${data.piece.published?.version}. Los alumnos ven esta versión hasta que publiques otra.`
      : action === "despublicar"
        ? "Dejó de publicarse. El alumno vuelve a las fotos del catálogo."
        : action === "restaurar"
          ? `Visible otra vez la versión ${data.piece.published?.version}.`
          : "Borrador guardado. Aún no cambia lo que ve el alumno.");
    await reload();
  }

  const jointDef = JOINTS.find((j) => j.id === joint)!;
  const angle = selected?.pose[joint] || { flex: 0, open: 0 };

  return (
    <div className="px-3 py-3 sm:px-4 sm:py-5 lg:px-6">
      <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="hidden text-xl font-extrabold text-white sm:block">Motion Studio 3D</h2>
          <p className="text-[13px] leading-relaxed text-gym-muted sm:max-w-2xl sm:text-sm">
            El maniquí 3D reproduce los ejercicios del catálogo. El editor de poses queda aparte y no reemplaza ese ciclo.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-gym-border/80 bg-black/30 p-1 sm:flex sm:rounded-full">
          <button type="button" onClick={() => setLane("personaje")} className={`rounded-xl px-3 py-2 text-center text-[12px] font-bold sm:rounded-full sm:py-1 sm:text-[11px] ${lane === "personaje" ? "bg-gym-primary text-gym-navy" : "text-gym-muted"}`}>Maniquí 3D</button>
          <button type="button" onClick={() => setLane("poses")} className={`rounded-xl px-3 py-2 text-center text-[12px] font-bold sm:rounded-full sm:py-1 sm:text-[11px] ${lane === "poses" ? "bg-gym-primary text-gym-navy" : "text-gym-muted"}`}>Editor de poses</button>
        </div>
      </div>
      {lane === "personaje" && <MotionStudioViewport />}
      {lane === "poses" && (

      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="glass-soft self-start p-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">Ejercicios de la sede</div>
          <div className="mt-3 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del ejercicio" className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2.5 text-base text-white sm:py-1.5 sm:text-sm" />
            <select value={catalog} onChange={(e) => setCatalog(e.target.value)} className="w-full rounded-xl border border-gym-border bg-gym-navy px-3 py-2.5 text-base text-white sm:py-1.5 sm:text-sm">
              <option value="">Sin vincular al catálogo</option>
              {EXERCISES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button type="button" disabled={busy || !name.trim()} onClick={create} className="btn-gym w-full disabled:opacity-40">Crear</button>
          </div>
          <ul className="mt-4 space-y-1">
            {items === null && <li className="text-xs text-gym-muted">Leyendo…</li>}
            {items?.length === 0 && <li className="text-xs text-gym-muted">Todavía no hay ejercicios creados aquí.</li>}
            {items?.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => open(item.id)} className={`w-full rounded-lg px-2 py-2 text-left ${piece?.id === item.id ? "bg-gym-primary/15 text-white" : "text-gym-silver hover:bg-white/5"}`}>
                  <div className="text-sm font-semibold">{item.name}</div>
                  <div className="text-[11px] text-gym-muted">{item.status === "publicado" ? `Publicado · v${item.version}` : "Borrador"}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="self-start overflow-hidden rounded-2xl border border-gym-border/80 bg-black">
          <div className="relative h-[min(62svh,420px)] sm:h-[520px]">
            <MotionStage
              pose={piece ? pose : poseAt(previewKeys, previewTime)}
              selected={piece && !playing ? joint : null}
              onSelect={piece ? (id) => { setJoint(id); setPlaying(false); } : undefined}
              view={view}
            />
            <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gym-primary">
              {piece ? (playing ? nearestLabel(piece.draft, time) : selected?.label || "Pose") : `Vista previa · ${nearestLabel(previewKeys, previewTime)}`}
            </div>
          </div>
          <div className="space-y-2 border-t border-gym-border/60 bg-gym-panel/90 px-3 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => piece && setPlaying((v) => !v)} className="rounded-full bg-gym-primary px-3 py-1 text-[11px] font-bold text-gym-navy">
                {piece ? (playing ? "Pausa" : "Reproducir") : "En movimiento"}
              </button>
                {VIEWS.map((v) => (
                  <button key={v.id} type="button" onClick={() => setView(v.id)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${view === v.id ? "bg-gym-primary text-gym-navy" : "text-gym-muted"}`}>{v.label}</button>
                ))}
                {piece && <button type="button" onClick={addPose} className="rounded-full border border-gym-border px-2.5 py-1 text-[11px] font-semibold text-white">Guardar pose aquí</button>}
              </div>
              <input type="range" min={0} max={1000} value={Math.round((piece ? time : previewTime) * 1000)} onChange={(e) => { if (!piece) return; setPlaying(false); setTime(Number(e.target.value) / 1000); }} className="w-full" />
              {piece && (
              <div className="flex flex-wrap gap-1">
                {piece.draft.map((key) => (
                  <button key={key.id} type="button" onClick={() => { setPlaying(false); setSelectedId(key.id); setTime(key.t); }} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected?.id === key.id && !playing ? "bg-gym-primary/20 text-gym-primary" : "text-gym-muted"}`}>
                    {key.label}
                  </button>
                ))}
              </div>
              )}
              {!piece && <p className="text-[11px] text-gym-silver">Elegí el ejercicio en el catálogo para ver su movimiento. Después poné el nombre y crealo: vas a poder corregir cada pose.</p>}
            </div>
        </section>

        <aside className="glass-soft self-start space-y-3 p-3">
          {!piece && <p className="text-sm text-gym-muted">La persona de la vista previa ya está en movimiento. Creá el ejercicio para corregir sus poses.</p>}
          {piece && selected && (
            <>
              <Field label="Nombre" value={piece.name} onChange={(name) => setPiece({ ...piece, name })} />
              <label className="block text-[11px] text-gym-muted">
                Catálogo
                <select value={piece.exerciseId} onChange={(e) => setPiece({ ...piece, exerciseId: e.target.value })} className="mt-1 w-full rounded-lg border border-gym-border bg-gym-navy px-2 py-1.5 text-sm text-white">
                  <option value="">Sin vincular</option>
                  {EXERCISES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <div className="text-[11px] text-gym-muted">
                {piece.published ? `Los alumnos ven la versión ${piece.published.version}. El borrador no la cambia hasta publicar.` : "Sin publicar. El alumno sigue viendo las fotos."}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">Pose · {selected.label}</div>
                <input value={selected.label} onChange={(e) => patchDraft(piece.draft.map((k) => k.id === selected.id ? { ...k, label: e.target.value.slice(0, 40) } : k))} className="mt-1 w-full rounded-lg border border-gym-border bg-transparent px-2 py-1.5 text-sm text-white" />
              </div>
              <label className="block text-[11px] text-gym-muted">
                {jointDef.label} · flexión {Math.round(angle.flex)}°
                <input type="range" min={jointDef.min} max={jointDef.max} value={angle.flex} disabled={!editing} onChange={(e) => editPose("flex", Number(e.target.value))} className="mt-1 w-full disabled:opacity-40" />
              </label>
              {jointDef.open && (
                <label className="block text-[11px] text-gym-muted">
                  Apertura lateral {Math.round(angle.open)}°
                  <input type="range" min={0} max={90} value={angle.open} disabled={!editing} onChange={(e) => editPose("open", Number(e.target.value))} className="mt-1 w-full disabled:opacity-40" />
                </label>
              )}
              {!editing && <p className="text-[11px] text-gym-muted">Estás viendo la transición. Elige una pose para mover las articulaciones.</p>}
              <div className="flex flex-wrap gap-1">
                {JOINTS.map((j) => (
                  <button key={j.id} type="button" onClick={() => setJoint(j.id)} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${joint === j.id ? "bg-gym-primary text-gym-navy" : "text-gym-muted"}`}>{j.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" onClick={() => mirror("piernas")} className="rounded-full border border-gym-border px-2 py-1 text-[11px] text-white">Igualar piernas</button>
                <button type="button" onClick={() => mirror("brazos")} className="rounded-full border border-gym-border px-2 py-1 text-[11px] text-white">Igualar brazos</button>
                <button type="button" onClick={removePose} disabled={piece.draft.length <= 2} className="rounded-full border border-gym-border px-2 py-1 text-[11px] text-white disabled:opacity-40">Quitar pose</button>
              </div>
              <Field label="Equipo" value={piece.equipment} onChange={(equipment) => setPiece({ ...piece, equipment })} />
              <Field label="Músculos" value={piece.muscles} onChange={(muscles) => setPiece({ ...piece, muscles })} />
              <Field label="Series" value={piece.sets} onChange={(sets) => setPiece({ ...piece, sets })} />
              <Field label="Repeticiones" value={piece.reps} onChange={(reps) => setPiece({ ...piece, reps })} />
              <Area label="Técnica" value={piece.technique} onChange={(technique) => setPiece({ ...piece, technique })} />
              <Area label="Errores frecuentes" value={piece.mistakes} onChange={(mistakes) => setPiece({ ...piece, mistakes })} />
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => persist("guardar")} className="rounded-lg border border-gym-border px-3 py-2 text-sm text-white disabled:opacity-40">Guardar borrador</button>
                <button type="button" disabled={busy} onClick={() => persist("publicar")} className="btn-gym disabled:opacity-40">Publicar</button>
                {piece.published && <button type="button" disabled={busy} onClick={() => persist("despublicar")} className="rounded-lg border border-gym-border px-3 py-2 text-sm text-white disabled:opacity-40">Retirar</button>}
                {piece.history.length > 0 && <button type="button" disabled={busy} onClick={() => persist("restaurar")} className="rounded-lg border border-gym-border px-3 py-2 text-sm text-white disabled:opacity-40">Volver a la versión anterior</button>}
              </div>
              {note && <p className="text-[12px] leading-snug text-gym-silver">{note}</p>}
              <p className="text-[11px] leading-snug text-gym-muted">Los límites de cada articulación evitan giros extremos. No certifican la técnica. La barra, las bandas y la captura desde video quedan para una fase siguiente.</p>
            </>
          )}
        </aside>
      </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[11px] text-gym-muted">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-gym-border bg-transparent px-2 py-1.5 text-sm text-white" />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[11px] text-gym-muted">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-gym-border bg-transparent px-2 py-1.5 text-sm text-white" />
    </label>
  );
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
