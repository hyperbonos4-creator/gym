"use client";

import { useMemo, useState } from "react";
import { EXERCISES, type Exercise } from "../../lib/exercisesCatalog";
import { PATTERN_LABEL, libraryOf } from "../../lib/exerciseLibrary";
import { MUSCLE_BY_ID } from "../../lib/muscles";

export function ExercisePicker({
  onPick,
  onClose,
}: {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("Todas");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (zone !== "Todas" && e.classification !== zone) return false;
      if (!s) return true;
      const card = libraryOf(e);
      return `${e.name} ${e.equipment} ${e.classification} ${MUSCLE_BY_ID[e.primary].name} ${PATTERN_LABEL[card.pattern]}`.toLowerCase().includes(s);
    });
  }, [q, zone]);

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gym-border bg-gym-navy" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-gym-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold text-white">Del catálogo de ejercicios</h3>
            <button type="button" onClick={onClose} className="text-sm text-gym-muted" aria-label="Cerrar">Cerrar</button>
          </div>
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, músculo o equipo" className="mt-3 w-full rounded-xl border border-gym-border bg-gym-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gym-primary" />
          <div className="mt-2 flex flex-wrap gap-2">
            {["Todas", "Tren superior", "Tren inferior", "Core", "Full body"].map((z) => (
              <button key={z} type="button" onClick={() => setZone(z)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${zone === z ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{z}</button>
            ))}
          </div>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {list.map((e) => {
            const card = libraryOf(e);
            return (
            <li key={e.id}>
              <button type="button" onClick={() => onPick(e)} className="flex w-full flex-col px-4 py-3 text-left hover:bg-white/[0.04]">
                <span className="text-sm font-semibold text-white">{e.name}</span>
                <span className="text-[11px] text-gym-muted">{PATTERN_LABEL[card.pattern]} · {MUSCLE_BY_ID[e.primary].name} · {e.equipment}{card.studio ? " · ciclo 3D" : ""}</span>
              </button>
            </li>
            );
          })}
          {list.length === 0 && <li className="px-4 py-8 text-center text-sm text-gym-muted">Ningún ejercicio del catálogo coincide.</li>}
        </ul>
      </div>
    </div>
  );
}
