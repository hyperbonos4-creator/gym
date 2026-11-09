"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GymShell from "../../components/GymShell";
import type { Assessment } from "../../lib/assessmentTypes";
import { KIND_LABEL } from "../../lib/assessmentTypes";
import { getActiveGymId } from "../../lib/session";

type Socio = { id: string; nombre: string; rol?: string };
type Link = { socioId: string; templateName: string; versionNumber: number; status: string };

function dash(ready: boolean, value: number, emptyHint: string) {
  if (!ready) return { value: "—", hint: "Leyendo registros" };
  if (value === 0) return { value: "—", hint: emptyHint };
  return { value: String(value), hint: emptyHint };
}

export default function ValoracionesPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [socios, setSocios] = useState<Socio[] | null>(null);
  const [items, setItems] = useState<Assessment[] | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [tab, setTab] = useState<"resumen" | "clientes" | "historial">("resumen");
  const [query, setQuery] = useState("");

  const load = useCallback(async (id: string) => {
    const [people, reviews, assigned] = await Promise.all([
      fetch(`/api/socios?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/assessments?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/routine-assignments?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
    ]);
    setSocios((people.items || []).filter((row: Socio) => row.rol !== "invitado"));
    setItems(reviews.items || []);
    setLinks((assigned.items || []).filter((row: Link) => row.status === "vigente"));
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id).catch(() => {
      setSocios([]);
      setItems([]);
    });
  }, [load]);

  const ready = socios !== null && items !== null;
  const closed = (items || []).filter((row) => row.status === "cerrada");
  const clientsWith = new Set(closed.map((row) => row.socioId)).size;
  const today = new Date().toISOString().slice(0, 10);
  const pending = closed.filter((row) => row.nextReview && row.nextReview <= today && !closed.some((other) => other.socioId === row.socioId && other.measuredAt > row.measuredAt)).length;
  const members = socios || [];
  const missingInitial = members.filter((person) => !closed.some((row) => row.socioId === person.id && row.kind === "inicial")).length;
  const latest = closed[0];
  const programOf = (socioId: string) => links.find((row) => row.socioId === socioId);
  const nameOf = (socioId: string) => members.find((row) => row.id === socioId)?.nombre || "Cliente";
  const visible = members.filter((person) => person.nombre.toLowerCase().includes(query.trim().toLowerCase()));

  const cards = useMemo(() => [
    dash(ready, clientsWith, clientsWith ? "Con valoración cerrada" : "Todavía no hay una valoración cerrada"),
    dash(ready, pending, pending ? "La fecha ya llegó y no hay una posterior" : "Nadie tiene una revisión vencida"),
    dash(ready, ready ? missingInitial : 0, missingInitial ? "Socios sin evaluación inicial cerrada" : "Todos tienen evaluación inicial"),
    { value: latest ? latest.measuredAt : "—", hint: latest ? nameOf(latest.socioId) : "Sin actividad" },
  ], [ready, clientsWith, pending, missingInitial, latest, members]);

  return (
    <GymShell active="valoraciones">
      <div className="px-6 py-6">
        <div className="mb-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">Gimnasio</p>
          <h2 className="text-xl font-extrabold text-white">Valoraciones</h2>
          <p className="mt-1 max-w-2xl text-sm text-gym-muted">Cómo empezó cada cliente, qué cambió y qué conviene revisar en su programa. Una medida nueva no borra la anterior.</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {([
            ["resumen", "Resumen"],
            ["clientes", "Clientes"],
            ["historial", "Historial"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === id ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["Clientes con evaluación", "Revisiones pendientes", "Evaluaciones iniciales", "Último registro"].map((label, index) => (
            <div key={label} className="glass-soft px-4 py-3">
              <div className="text-[11px] text-gym-muted">{label}</div>
              <div className="text-2xl font-extrabold text-white">{cards[index].value}</div>
              <div className="mt-1 text-[11px] text-gym-muted">{cards[index].hint}</div>
            </div>
          ))}
        </div>

        {tab === "resumen" && (
          <section className="mt-6">
            <h3 className="text-sm font-bold text-white">Seguimiento programado</h3>
            <p className="mt-1 text-sm text-gym-muted">Aparece cuando una valoración cerrada tiene fecha de revisión y esa fecha ya pasó, sin una evaluación posterior.</p>
            {ready && pending === 0 && <p className="mt-4 text-sm text-gym-muted">No hay revisiones vencidas.</p>}
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {closed.filter((row) => row.nextReview && row.nextReview <= today && !closed.some((other) => other.socioId === row.socioId && other.measuredAt > row.measuredAt)).map((row) => (
                <li key={row.id} className="glass p-4">
                  <div className="font-extrabold text-white">{nameOf(row.socioId)}</div>
                  <div className="mt-1 text-xs text-gym-muted">Revisión prevista el {row.nextReview}</div>
                  <a href={`/valoraciones/${row.socioId}`} className="mt-3 inline-block text-xs font-semibold text-gym-primary">Abrir expediente</a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "clientes" && (
          <section className="mt-6">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente por nombre..." className="w-full max-w-md rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white outline-none" />
            {ready && visible.length === 0 && <p className="mt-4 text-sm text-gym-muted">No hay clientes con ese nombre.</p>}
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {visible.map((person) => {
                const last = closed.find((row) => row.socioId === person.id);
                const draft = (items || []).find((row) => row.socioId === person.id && row.status === "borrador");
                const program = programOf(person.id);
                return (
                  <li key={person.id} className="glass p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-extrabold text-white">{person.nombre}</div>
                        <div className="mt-1 text-xs text-gym-muted">{program ? `${program.templateName} · versión ${program.versionNumber}` : "Sin rutina asignada"}</div>
                      </div>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-gym-silver">Activo</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-[11px] text-gym-muted">Última valoración</div>
                        <div className="font-semibold text-white">{last ? last.measuredAt : "Sin registro"}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-gym-muted">Próxima revisión</div>
                        <div className="font-semibold text-white">{last?.nextReview || "Por programar"}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <a href={`/valoraciones/${person.id}`} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Expediente</a>
                      {draft && <a href={`/valoraciones/${person.id}/valorar?id=${draft.id}`} className="rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gym-navy">Continuar borrador</a>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "historial" && (
          <section className="mt-6">
            {ready && closed.length === 0 && <p className="text-sm text-gym-muted">Todavía no hay valoraciones cerradas.</p>}
            <ul className="mt-3 divide-y divide-white/5">
              {closed.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold text-white">{nameOf(row.socioId)}</div>
                    <div className="text-xs text-gym-muted">{row.measuredAt} · {KIND_LABEL[row.kind]}{row.routineName ? ` · ${row.routineName}` : ""}</div>
                  </div>
                  <a href={`/valoraciones/${row.socioId}`} className="text-xs font-semibold text-gym-primary">Ver expediente</a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="mt-8 text-[11px] text-gym-muted">Los números solo aparecen cuando hay un registro cerrado. Un campo vacío no es un cero.</p>
      </div>
    </GymShell>
  );
}
