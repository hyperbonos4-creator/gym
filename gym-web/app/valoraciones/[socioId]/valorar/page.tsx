"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GymShell from "../../../../components/GymShell";
import { EXERCISES } from "../../../../lib/exercisesCatalog";
import {
  emptyMeasures,
  GOAL_OPTIONS,
  KIND_LABEL,
  MEASURE_FIELDS,
  PHOTO_LABEL,
  TEST_CATEGORY_LABEL,
  type Assessment,
  type AssessmentKind,
  type PerformanceTest,
  type PhotoView,
  type TestCategory,
} from "../../../../lib/assessmentTypes";
import { getActiveGymId } from "../../../../lib/session";

const STEPS = ["Ficha", "Medidas", "Rendimiento", "Fotografías", "Cierre"];

function blankTest(): PerformanceTest {
  return { id: crypto.randomUUID(), category: "muscular", exerciseId: "", name: "", protocol: "", result: "", unit: "", note: "" };
}

export default function ValorarPage({ params }: { params: { socioId: string } }) {
  return (
    <Suspense fallback={<GymShell active="valoraciones"><p className="px-6 py-6 text-sm text-gym-muted">Abriendo la valoración…</p></GymShell>}>
      <ValorarForm params={params} />
    </Suspense>
  );
}

function ValorarForm({ params }: { params: { socioId: string } }) {
  const search = useSearchParams();
  const id = search.get("id") || "";
  const [gymId, setGymId] = useState("fuerza-elite");
  const [item, setItem] = useState<Assessment | null>(null);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [program, setProgram] = useState("");

  useEffect(() => {
    const gym = getActiveGymId() || "fuerza-elite";
    setGymId(gym);
    if (!id) return;
    fetch(`/api/assessments/${id}?gym=${encodeURIComponent(gym)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setItem(data.item || null))
      .catch(() => setMsg("No se pudo abrir la valoración."));
    fetch(`/api/routine-assignments?gym=${encodeURIComponent(gym)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const link = (data.items || []).find((row: { socioId: string; status: string; templateName: string; versionNumber: number }) => row.socioId === params.socioId && row.status === "vigente");
        setProgram(link ? `${link.templateName} · versión ${link.versionNumber}` : "Sin rutina asignada");
      })
      .catch(() => undefined);
  }, [id, params.socioId]);

  const measures = item?.measures || emptyMeasures();
  const tests = item?.tests || [];

  async function save(patch: Record<string, unknown>, close = false) {
    if (!item) return null;
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/assessments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, gym: gymId, close }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setMsg(data.error || "No se pudo guardar.");
      return null;
    }
    setItem(data.item);
    return data.item as Assessment;
  }

  async function upload(view: PhotoView, file: File) {
    if (!item) return;
    const saved = await save({ photoConsent: item.photoConsent });
    if (!saved) return;
    const body = new FormData();
    body.set("file", file);
    body.set("view", view);
    setBusy(true);
    const res = await fetch(`/api/assessments/${item.id}/photo?gym=${encodeURIComponent(gymId)}`, { method: "POST", body });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) setMsg(data.error || "No se pudo guardar la fotografía.");
    else setItem(data.item);
  }

  const titles = useMemo(() => STEPS, []);

  if (!id) {
    return <GymShell active="valoraciones"><p className="px-6 py-6 text-sm text-gym-muted">Abre la valoración desde el expediente del cliente.</p></GymShell>;
  }

  return (
    <GymShell active="valoraciones">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <a href={`/valoraciones/${params.socioId}`} className="text-xs font-semibold text-gym-muted">Volver al expediente</a>
        <h2 className="mt-2 text-xl font-extrabold text-white">Nueva valoración</h2>
        <p className="mt-1 text-sm text-gym-muted">Paso {step + 1} de {titles.length} · {titles[step]}. Puedes guardar y continuar después.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {titles.map((label, index) => (
            <button key={label} type="button" onClick={() => setStep(index)} className={`rounded-full px-3 py-1 text-xs font-semibold ${step === index ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
          ))}
        </div>
        {msg && <p className="mt-3 text-sm text-status-warn">{msg}</p>}
        {!item && <p className="mt-6 text-sm text-gym-muted">Leyendo borrador…</p>}

        {item && item.status === "cerrada" && <p className="mt-6 text-sm text-gym-muted">Esta valoración ya está cerrada. El historial conserva estos datos. Para un cambio nuevo, abre un seguimiento.</p>}

        {item && item.status === "borrador" && step === 0 && (
          <section className="mt-6 space-y-4">
            <fieldset>
              <legend className="text-sm font-semibold text-white">Tipo de valoración</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(KIND_LABEL) as AssessmentKind[]).map((kind) => (
                  <button key={kind} type="button" onClick={() => setItem({ ...item, kind })} className={`rounded-full px-3 py-1 text-xs font-semibold ${item.kind === kind ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{KIND_LABEL[kind]}</button>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm text-gym-muted">Fecha de la medición
              <input type="date" value={item.measuredAt} onChange={(event) => setItem({ ...item, measuredAt: event.target.value })} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
            </label>
            <label className="block text-sm text-gym-muted">Objetivo principal
              <select value={item.goal} onChange={(event) => setItem({ ...item, goal: event.target.value })} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white">
                <option value="">Por definir</option>
                {GOAL_OPTIONS.map((goal) => <option key={goal} value={goal}>{goal}</option>)}
              </select>
            </label>
            <label className="block text-sm text-gym-muted">Observaciones iniciales
              <textarea value={item.notes} onChange={(event) => setItem({ ...item, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
            </label>
            <label className="block text-sm text-gym-muted">Limitaciones que comunique el cliente
              <textarea value={item.limitations} onChange={(event) => setItem({ ...item, limitations: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
            </label>
            <p className="text-xs leading-relaxed text-gym-muted">Registra las limitaciones relevantes y el cribado previo al ejercicio. Si una respuesta exige valoración profesional, esta ficha no es una autorización médica.</p>
            <label className="flex items-start gap-2 text-sm text-white">
              <input type="checkbox" checked={item.screeningChecked} onChange={(event) => setItem({ ...item, screeningChecked: event.target.checked })} className="mt-1" />
              He revisado las respuestas de preparación física y las restricciones pertinentes.
            </label>
          </section>
        )}

        {item && item.status === "borrador" && step === 1 && (
          <section className="mt-6 space-y-3">
            <p className="text-sm text-gym-muted">Deja en blanco lo que no mediste. Un campo vacío no se guarda como cero.</p>
            {MEASURE_FIELDS.map((field) => (
              <label key={field.key} className="grid gap-1 text-sm text-gym-muted md:grid-cols-[1fr_140px]">
                <span>{field.label}<span className="mt-0.5 block text-[11px]">{field.hint}</span></span>
                <input
                  inputMode="decimal"
                  value={measures[field.key] ?? ""}
                  onChange={(event) => setItem({ ...item, measures: { ...measures, [field.key]: event.target.value === "" ? null : Number(event.target.value) } })}
                  placeholder={field.unit}
                  className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white"
                />
              </label>
            ))}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-gym-muted">Método de composición, si se usó
                <input value={measures.compositionMethod} onChange={(event) => setItem({ ...item, measures: { ...measures, compositionMethod: event.target.value } })} placeholder="Báscula, pliegues u otro" className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
              </label>
              <label className="text-sm text-gym-muted">Resultado
                <input value={measures.compositionValue} onChange={(event) => setItem({ ...item, measures: { ...measures, compositionValue: event.target.value } })} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
              </label>
            </div>
            <p className="text-xs text-gym-muted">No se calcula grasa a partir de fotos. La estimación queda ligada al método y no se presenta como una medición exacta.</p>
            <label className="block text-sm text-gym-muted">Nota de medición
              <textarea value={measures.note} onChange={(event) => setItem({ ...item, measures: { ...measures, note: event.target.value } })} rows={2} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
            </label>
          </section>
        )}

        {item && item.status === "borrador" && step === 2 && (
          <section className="mt-6 space-y-3">
            <p className="text-sm text-gym-muted">Registra solo las pruebas que hiciste. El ejercicio del catálogo evita comparar después dos variantes distintas.</p>
            {tests.map((test, index) => (
              <article key={test.id} className="glass space-y-2 p-4">
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(TEST_CATEGORY_LABEL) as TestCategory[]).map((category) => (
                    <button key={category} type="button" onClick={() => setItem({ ...item, tests: tests.map((row, i) => i === index ? { ...row, category } : row) })} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${test.category === category ? "bg-gym-primary text-gym-navy" : "text-gym-muted"}`}>{TEST_CATEGORY_LABEL[category]}</button>
                  ))}
                </div>
                <select value={test.exerciseId} onChange={(event) => {
                  const exercise = EXERCISES.find((entry) => entry.id === event.target.value);
                  setItem({ ...item, tests: tests.map((row, i) => i === index ? { ...row, exerciseId: event.target.value, name: exercise?.name || row.name } : row) });
                }} className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white">
                  <option value="">Sin ejercicio del catálogo</option>
                  {EXERCISES.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
                </select>
                <input value={test.name} onChange={(event) => setItem({ ...item, tests: tests.map((row, i) => i === index ? { ...row, name: event.target.value } : row) })} placeholder="Nombre de la prueba" className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                <div className="grid gap-2 md:grid-cols-3">
                  <input value={test.result} onChange={(event) => setItem({ ...item, tests: tests.map((row, i) => i === index ? { ...row, result: event.target.value } : row) })} placeholder="Resultado" className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                  <input value={test.unit} onChange={(event) => setItem({ ...item, tests: tests.map((row, i) => i === index ? { ...row, unit: event.target.value } : row) })} placeholder="Unidad" className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                  <input value={test.protocol} onChange={(event) => setItem({ ...item, tests: tests.map((row, i) => i === index ? { ...row, protocol: event.target.value } : row) })} placeholder="Protocolo" className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                </div>
              </article>
            ))}
            <button type="button" onClick={() => setItem({ ...item, tests: [...tests, blankTest()] })} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver">Añadir prueba</button>
          </section>
        )}

        {item && item.status === "borrador" && step === 3 && (
          <section className="mt-6 space-y-4">
            <p className="text-sm text-gym-muted">Las fotos son opcionales y privadas. No se usan para reconocer el rostro ni para calcular composición corporal. Este consentimiento no autoriza a publicarlas.</p>
            <label className="flex items-start gap-2 text-sm text-white">
              <input type="checkbox" checked={item.photoConsent} onChange={(event) => setItem({ ...item, photoConsent: event.target.checked })} className="mt-1" />
              El cliente autoriza estas imágenes solo para el seguimiento privado de su entrenamiento.
            </label>
            {(Object.keys(PHOTO_LABEL) as PhotoView[]).map((view) => (
              <label key={view} className="block text-sm text-gym-muted">{PHOTO_LABEL[view]}
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={!item.photoConsent || busy} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload(view, file);
                  event.target.value = "";
                }} className="mt-1 block text-xs" />
              </label>
            ))}
            <p className="text-xs text-gym-muted">{item.photos.length === 0 ? "Sin fotografías." : `${item.photos.length} fotografía${item.photos.length === 1 ? "" : "s"} en este borrador.`}</p>
          </section>
        )}

        {item && item.status === "borrador" && step === 4 && (
          <section className="mt-6 space-y-4">
            <div className="glass p-4 text-sm">
              <div className="text-[11px] text-gym-muted">Programa asignado ahora</div>
              <div className="mt-1 font-semibold text-white">{program}</div>
              <p className="mt-2 text-gym-muted">Cerrar esta valoración no cambia la rutina. Si hace falta ajustarla, lo haces en Rutinas y queda registrada la versión.</p>
            </div>
            <label className="block text-sm text-gym-muted">Qué revisar del programa
              <textarea value={item.routineNote} onChange={(event) => setItem({ ...item, routineNote: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
            </label>
            <label className="block text-sm text-gym-muted">Objetivos para el siguiente tramo
              <textarea value={item.objectives} onChange={(event) => setItem({ ...item, objectives: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
            </label>
            <label className="block text-sm text-gym-muted">Próxima revisión
              <input type="date" value={item.nextReview} onChange={(event) => setItem({ ...item, nextReview: event.target.value })} className="mt-1 rounded-xl border border-gym-border bg-transparent px-3 py-2 text-white" />
            </label>
          </section>
        )}

        {item && item.status === "borrador" && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => save({
              kind: item.kind,
              measuredAt: item.measuredAt,
              goal: item.goal,
              notes: item.notes,
              limitations: item.limitations,
              screeningChecked: item.screeningChecked,
              measures: item.measures,
              tests: item.tests,
              photoConsent: item.photoConsent,
              objectives: item.objectives,
              nextReview: item.nextReview,
              routineNote: item.routineNote,
            }).then((saved) => saved && setMsg("Borrador guardado."))} className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver">Guardar borrador</button>
            {step < 4 && <button type="button" onClick={() => setStep(step + 1)} className="btn-gym">Siguiente</button>}
            {step === 4 && <button type="button" disabled={busy} onClick={() => save({
              kind: item.kind,
              measuredAt: item.measuredAt,
              goal: item.goal,
              notes: item.notes,
              limitations: item.limitations,
              screeningChecked: item.screeningChecked,
              measures: item.measures,
              tests: item.tests,
              photoConsent: item.photoConsent,
              objectives: item.objectives,
              nextReview: item.nextReview,
              routineNote: item.routineNote,
            }, true).then((saved) => {
              if (saved) window.location.href = `/valoraciones/${params.socioId}`;
            })} className="btn-gym">Cerrar valoración</button>}
          </div>
        )}
      </div>
    </GymShell>
  );
}
