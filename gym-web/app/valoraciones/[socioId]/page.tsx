"use client";

import { useEffect, useMemo, useState } from "react";
import GymShell from "../../../components/GymShell";
import {
  compareAssessments,
  KIND_LABEL,
  MEASURE_FIELDS,
  PHOTO_LABEL,
  seriesFor,
  TEST_CATEGORY_LABEL,
  type Assessment,
  type BodyMeasures,
  type PhotoView,
} from "../../../lib/assessmentTypes";
import { getActiveGymId } from "../../../lib/session";

type Socio = { id: string; nombre: string; rol?: string };
type Link = { socioId: string; templateName: string; versionNumber: number; status: string; goal?: string };

const TABS = ["Resumen", "Medidas", "Rendimiento", "Fotografías", "Objetivos", "Historial"] as const;

function Trend({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-gym-muted">Hace falta más de un registro cerrado de esta medida para ver la tendencia.</p>;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 640;
  const height = 180;
  const coords = points.map((point, index) => {
    const x = 24 + (index / (points.length - 1)) * (width - 48);
    const y = 20 + (1 - (point.value - min) / span) * (height - 48);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-3 w-full">
      <polyline fill="none" stroke="#38BDF8" strokeWidth="3" points={coords.join(" ")} />
      {points.map((point, index) => {
        const [x, y] = coords[index].split(",");
        return <circle key={point.date} cx={x} cy={y} r="4" fill="#38BDF8" />;
      })}
    </svg>
  );
}

export default function ExpedientePage({ params }: { params: { socioId: string } }) {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [socio, setSocio] = useState<Socio | null>(null);
  const [items, setItems] = useState<Assessment[] | null>(null);
  const [program, setProgram] = useState<Link | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Resumen");
  const [measure, setMeasure] = useState<keyof BodyMeasures>("weightKg");
  const [angle, setAngle] = useState<PhotoView>("frontal");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    Promise.all([
      fetch(`/api/socios?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/assessments?gym=${encodeURIComponent(id)}&socio=${encodeURIComponent(params.socioId)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/routine-assignments?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
    ]).then(([people, reviews, assigned]) => {
      setSocio((people.items || []).find((row: Socio) => row.id === params.socioId) || null);
      setItems(reviews.items || []);
      setProgram((assigned.items || []).find((row: Link) => row.socioId === params.socioId && row.status === "vigente") || null);
    }).catch(() => setError("No se pudo leer el expediente."));
  }, [params.socioId]);

  const closed = useMemo(() => (items || []).filter((row) => row.status === "cerrada").slice().sort((a, b) => (a.measuredAt < b.measuredAt ? -1 : 1)), [items]);
  const draft = (items || []).find((row) => row.status === "borrador");
  const first = closed[0];
  const last = closed[closed.length - 1];
  const rows = first && last && first.id !== last.id ? compareAssessments(first, last) : [];
  const points = seriesFor(closed, measure);
  const photosOf = (row: Assessment | undefined, view: PhotoView) => row?.photos.filter((photo) => photo.view === view) || [];

  async function start(kind: "inicial" | "seguimiento" | "cierre") {
    setBusy(true);
    setError("");
    const res = await fetch("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, socioId: params.socioId, kind }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(data.error || "No se pudo abrir la valoración.");
      return;
    }
    window.location.href = `/valoraciones/${params.socioId}/valorar?id=${data.item.id}`;
  }

  return (
    <GymShell active="valoraciones">
      <div className="px-6 py-6">
        <a href="/valoraciones" className="text-xs font-semibold text-gym-muted">Valoraciones</a>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">{socio?.nombre || "Expediente"}</h2>
            <p className="mt-1 text-sm text-gym-muted">{program ? `Programa: ${program.templateName} · versión ${program.versionNumber}` : "Sin rutina asignada"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {draft && <a href={`/valoraciones/${params.socioId}/valorar?id=${draft.id}`} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver">Continuar borrador</a>}
            <button type="button" disabled={busy} onClick={() => start(closed.length ? "seguimiento" : "inicial")} className="btn-gym">{closed.length ? "Nueva valoración" : "Crear evaluación inicial"}</button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-status-warn">{error}</p>}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="glass-soft px-4 py-3">
            <div className="text-[11px] text-gym-muted">Objetivo principal</div>
            <div className="mt-1 font-semibold text-white">{last?.goal || "Por definir"}</div>
          </div>
          <div className="glass-soft px-4 py-3">
            <div className="text-[11px] text-gym-muted">Próximo seguimiento</div>
            <div className="mt-1 font-semibold text-white">{last?.nextReview || "Por programar"}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === item ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{item}</button>
          ))}
        </div>

        {tab === "Resumen" && (
          <section className="mt-5">
            <h3 className="text-sm font-bold text-white">Del inicio a la última valoración cerrada</h3>
            <p className="mt-1 max-w-2xl text-sm text-gym-muted">Un cambio de peso no es progreso por sí solo. Depende del objetivo. Si el protocolo o el método cambió, la comparación lo dice.</p>
            {!first && <p className="mt-4 text-sm text-gym-muted">Todavía no hay una valoración cerrada.</p>}
            {first && last && first.id === last.id && <p className="mt-4 text-sm text-gym-muted">Hay una sola valoración cerrada, del {first.measuredAt}. La comparación aparece con la siguiente.</p>}
            {rows.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-gym-muted">
                    <tr><th className="py-2">Indicador</th><th>Inicial · {first.measuredAt}</th><th>Actual · {last.measuredAt}</th><th>Cambio</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.label}-${row.before}`} className="border-t border-white/5">
                        <td className="py-2 pr-3 text-white">{row.label}{row.caution ? <div className="text-[11px] text-status-warn">{row.caution}</div> : null}</td>
                        <td className="text-gym-silver">{row.before}</td>
                        <td className="text-gym-silver">{row.after}</td>
                        <td className="font-semibold text-white">{row.delta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-6">
              <label className="text-xs text-gym-muted">Tendencia de una medida
                <select value={measure} onChange={(event) => setMeasure(event.target.value as keyof BodyMeasures)} className="ml-2 rounded-lg border border-gym-border bg-transparent px-2 py-1 text-white">
                  {MEASURE_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </label>
              <Trend points={points} />
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gym-muted">
                {points.map((point) => <span key={point.id}>{point.date}: {point.value}</span>)}
              </div>
            </div>
            {last?.routineName && (
              <div className="mt-6 glass p-4">
                <div className="text-[11px] text-gym-muted">Programa en la última valoración</div>
                <div className="mt-1 font-semibold text-white">{last.routineName}{last.routineVersion ? ` · versión ${last.routineVersion}` : ""}</div>
                <p className="mt-2 text-sm text-gym-muted">{last.routineNote || "El entrenador no dejó una nota de programa. Cerrar una valoración no cambia la rutina."}</p>
                {last.routineTemplateId && <a href={`/rutinas/${last.routineTemplateId}`} className="mt-3 inline-block text-xs font-semibold text-gym-primary">Abrir la rutina</a>}
              </div>
            )}
          </section>
        )}

        {tab === "Medidas" && (
          <section className="mt-5 space-y-3">
            {closed.length === 0 && <p className="text-sm text-gym-muted">Sin medidas cerradas.</p>}
            {closed.slice().reverse().map((row) => (
              <article key={row.id} className="glass p-4">
                <div className="font-semibold text-white">{row.measuredAt} · {KIND_LABEL[row.kind]}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gym-silver">
                  {MEASURE_FIELDS.filter((field) => row.measures[field.key] != null).map((field) => (
                    <span key={field.key} className="rounded-full bg-white/5 px-2 py-1">{field.label}: {String(row.measures[field.key])} {field.unit}</span>
                  ))}
                </div>
                {row.measures.compositionValue && <p className="mt-2 text-xs text-gym-muted">Composición: {row.measures.compositionValue} · {row.measures.compositionMethod || "sin método"}. {row.measures.compositionNote}</p>}
                {row.measures.note && <p className="mt-2 text-sm text-gym-muted">{row.measures.note}</p>}
              </article>
            ))}
          </section>
        )}

        {tab === "Rendimiento" && (
          <section className="mt-5 space-y-3">
            {closed.every((row) => row.tests.length === 0) && <p className="text-sm text-gym-muted">Todavía no hay pruebas registradas. Solo se comparan pruebas con el mismo ejercicio, unidad y protocolo.</p>}
            {closed.slice().reverse().map((row) => (
              <article key={row.id} className="glass p-4">
                <div className="font-semibold text-white">{row.measuredAt}</div>
                <ul className="mt-2 space-y-2">
                  {row.tests.map((test) => (
                    <li key={test.id} className="text-sm">
                      <div className="text-white">{test.name} · {test.result} {test.unit}</div>
                      <div className="text-xs text-gym-muted">{TEST_CATEGORY_LABEL[test.category]}{test.protocol ? ` · ${test.protocol}` : ""}{test.exerciseId ? " · ejercicio del catálogo" : ""}</div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        )}

        {tab === "Fotografías" && (
          <section className="mt-5">
            <p className="max-w-2xl text-sm text-gym-muted">Comparación privada. No estiman grasa, postura ni musculatura. Conviene repetir encuadre, distancia, luz y postura.</p>
            <div className="mt-3 flex gap-2">
              {(Object.keys(PHOTO_LABEL) as PhotoView[]).map((view) => (
                <button key={view} type="button" onClick={() => setAngle(view)} className={`rounded-full px-3 py-1 text-xs font-semibold ${angle === view ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{PHOTO_LABEL[view]}</button>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[first, last].filter(Boolean).map((row) => {
                const photo = photosOf(row, angle)[0];
                return (
                  <figure key={row!.id} className="glass overflow-hidden">
                    <div className="px-4 py-2 text-xs text-gym-muted">{row === first ? "Inicial" : "Actual"} · {row!.measuredAt}</div>
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={`/api/assessments/${row!.id}/photo?gym=${encodeURIComponent(gymId)}&photo=${photo.id}`} className="aspect-[3/4] w-full object-cover" />
                    ) : <div className="grid aspect-[3/4] place-items-center text-sm text-gym-muted">Sin foto {PHOTO_LABEL[angle].toLowerCase()}</div>}
                  </figure>
                );
              })}
            </div>
          </section>
        )}

        {tab === "Objetivos" && (
          <section className="mt-5 space-y-3">
            {closed.length === 0 && <p className="text-sm text-gym-muted">Los objetivos quedan en cada valoración cerrada.</p>}
            {closed.slice().reverse().map((row) => (
              <article key={row.id} className="glass p-4">
                <div className="text-xs text-gym-muted">{row.measuredAt} · {row.goal || "Sin objetivo"}</div>
                <p className="mt-2 text-sm text-white">{row.objectives || "Sin objetivos escritos."}</p>
                {row.limitations && <p className="mt-2 text-sm text-gym-muted">Limitaciones: {row.limitations}</p>}
                {row.routineNote && <p className="mt-2 text-sm text-gym-muted">Nota de programa: {row.routineNote}</p>}
              </article>
            ))}
          </section>
        )}

        {tab === "Historial" && (
          <section className="mt-5">
            {(items || []).length === 0 && <p className="text-sm text-gym-muted">Este expediente todavía no tiene valoraciones.</p>}
            <ul className="divide-y divide-white/5">
              {(items || []).map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold text-white">{row.measuredAt} · {KIND_LABEL[row.kind]}</div>
                    <div className="text-xs text-gym-muted">{row.status === "borrador" ? "Borrador" : "Cerrada"} · {row.measuredBy}</div>
                  </div>
                  {row.status === "borrador" && <a href={`/valoraciones/${params.socioId}/valorar?id=${row.id}`} className="text-xs font-semibold text-gym-primary">Continuar</a>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </GymShell>
  );
}
