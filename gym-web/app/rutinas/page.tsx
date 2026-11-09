"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { draftOf, exerciseCount, latestPublished, trainingDays, type RoutineTemplate } from "../../lib/routineTypes";
import { getActiveGymId } from "../../lib/session";

type Assignment = { templateId: string; status: string };

export default function RutinasPage() {
  const [items, setItems] = useState<RoutineTemplate[] | null>(null);
  const [assigned, setAssigned] = useState<Assignment[]>([]);
  const [goal, setGoal] = useState("Todos");

  const load = useCallback(async (id: string) => {
    const [routines, links] = await Promise.all([
      fetch(`/api/routines?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/routine-assignments?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
    ]);
    setItems(routines.items || []);
    setAssigned(links.items || []);
  }, []);

  useEffect(() => {
    load(getActiveGymId() || "fuerza-elite");
  }, [load]);

  const goals = ["Todos", ...Array.from(new Set((items || []).map((item) => item.goal)))];
  const visible = (items || []).filter((item) => goal === "Todos" || item.goal === goal);
  const published = (items || []).filter((item) => latestPublished(item)).length;
  const drafts = (items || []).filter((item) => draftOf(item)).length;
  const vigentes = assigned.filter((item) => item.status === "vigente").length;
  const holders = (id: string) => assigned.filter((item) => item.templateId === id && item.status === "vigente").length;

  return (
    <GymShell active="rutinas">
      <div className="px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">Entrenamiento</p>
            <h2 className="text-xl font-extrabold text-white">Centro de programación</h2>
            <p className="mt-1 max-w-xl text-sm text-gym-muted">Diseña la semana, publica una versión y asígnala a un socio. Editar después no cambia lo que ya tiene asignado.</p>
          </div>
          <a href="/rutinas/crear" className="btn-gym">Crear rutina</a>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["Plantillas", items ? String(items.length) : "—", "En esta sede"],
            ["Publicadas", items ? String(published) : "—", "Listas para asignar"],
            ["Borradores", items ? String(drafts) : "—", "Todavía no entregadas"],
            ["Asignaciones", items ? String(vigentes) : "—", vigentes === 0 ? "Todavía nadie tiene una versión" : "Versiones vigentes"],
          ].map(([label, value, hint]) => (
            <div key={label} className="glass-soft px-4 py-3">
              <div className="text-[11px] text-gym-muted">{label}</div>
              <div className="text-2xl font-extrabold text-white">{value}</div>
              <div className="mt-1 text-[11px] text-gym-muted">{hint}</div>
            </div>
          ))}
        </div>

        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-white">Biblioteca</h3>
            <div className="flex flex-wrap gap-2">
              {goals.map((item) => (
                <button key={item} type="button" onClick={() => setGoal(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${goal === item ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{item}</button>
              ))}
            </div>
          </div>
          {items === null && <p className="mt-4 text-sm text-gym-muted">Leyendo plantillas…</p>}
          {items && visible.length === 0 && <p className="mt-4 text-sm text-gym-muted">Todavía no hay plantillas en esta sede.</p>}
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {visible.map((item) => {
              const pub = latestPublished(item);
              const draft = draftOf(item);
              const days = (draft || pub)?.days || [];
              const people = holders(item.id);
              return (
                <li key={item.id} className="glass p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-extrabold text-white">{item.name}</div>
                      <div className="mt-1 text-xs text-gym-muted">{item.goal} · {item.level}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${draft && !pub ? "bg-status-warn/15 text-status-warn" : "bg-status-ok/15 text-status-ok"}`}>
                      {draft && !pub ? "Borrador" : pub && draft ? "Hay borrador" : "Publicada"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold">
                    <span className="rounded-full bg-white/5 px-2 py-1 text-gym-silver">{trainingDays(days)} días / semana</span>
                    <span className="rounded-full bg-white/5 px-2 py-1 text-gym-silver">{exerciseCount(days)} ejercicios</span>
                    {pub && <span className="rounded-full bg-white/5 px-2 py-1 text-gym-silver">Versión {pub.number}</span>}
                    <span className="rounded-full bg-white/5 px-2 py-1 text-gym-silver">{people === 0 ? "Sin asignar" : people === 1 ? "1 socio" : `${people} socios`}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={`/rutinas/${item.id}/editar`} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">{draft ? "Continuar edición" : "Nueva versión"}</a>
                    <a href={`/rutinas/${item.id}`} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Vista previa</a>
                    {pub && <a href={`/rutinas/${item.id}#asignar`} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gym-navy">Asignar</a>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </GymShell>
  );
}
