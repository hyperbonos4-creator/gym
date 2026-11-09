"use client";

import { useEffect, useState } from "react";
import GymShell from "../../../../components/GymShell";
import { FOCUS_LABEL, SLOT_LABEL, latestPublished, type MealPlan, type NutritionLog, type NutritionProfile, type PlanFocus, type TrackingMode } from "../../../../lib/nutritionTypes";
import { getActiveGymId } from "../../../../lib/session";

type Socio = { id: string; nombre: string };
type Link = { socioId: string; templateName: string; versionNumber: number; status: string };

const TABS = ["Perfil", "Restricciones", "Plan", "Diario", "Hábitos", "Evolución"] as const;

export default function NutritionFilePage({ params }: { params: { socioId: string } }) {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [socio, setSocio] = useState<Socio | null>(null);
  const [profile, setProfile] = useState<NutritionProfile | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [assignedName, setAssignedName] = useState("");
  const [assignedVersion, setAssignedVersion] = useState<number | null>(null);
  const [versionMeals, setVersionMeals] = useState<{ slot: keyof typeof SLOT_LABEL; items: { id: string; label: string; portion: string; alternatives: string }[] }[]>([]);
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [routine, setRoutine] = useState<Link | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Perfil");
  const [habit, setHabit] = useState("");
  const [msg, setMsg] = useState("");

  async function load(id: string) {
    const [people, data, assigned] = await Promise.all([
      fetch(`/api/socios?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/nutrition?gym=${encodeURIComponent(id)}&socio=${encodeURIComponent(params.socioId)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/routine-assignments?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
    ]);
    setSocio((people.items || []).find((row: Socio) => row.id === params.socioId) || null);
    setProfile(data.profile);
    setPlans(data.plans || []);
    setLogs(data.logs || []);
    const client = data.client;
    setAssignedName(client?.planName || "");
    setAssignedVersion(client?.version?.number || null);
    setVersionMeals(client?.version?.meals || []);
    setRoutine((assigned.items || []).find((row: Link) => row.socioId === params.socioId && row.status === "vigente") || null);
  }

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id).catch(() => setMsg("No se pudo abrir el expediente."));
  }, [params.socioId]);

  async function saveProfile(extra: Partial<NutritionProfile> = {}) {
    if (!profile) return;
    const body = { ...profile, ...extra, action: "perfil", gym: gymId, socioId: params.socioId };
    const data = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((res) => res.json());
    setMsg(data.ok ? "Guardado." : data.error || "No se pudo guardar.");
    if (data.ok) setProfile(data.profile);
  }

  async function assign() {
    const data = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "asignar", gym: gymId, socioId: params.socioId, planId }) }).then((res) => res.json());
    setMsg(data.ok ? "Plan asignado. El cliente conserva esta versión hasta que la actualices." : data.error || "No se pudo asignar.");
    if (data.ok) await load(gymId);
  }

  const published = plans.filter((plan) => latestPublished(plan));

  return (
    <GymShell active="nutricion">
      <div className="px-6 py-6">
        <a href="/nutricion" className="text-xs text-gym-muted">Nutrición</a>
        <h2 className="mt-1 text-xl font-extrabold text-white">{socio?.nombre || "Cliente"}</h2>
        <p className="mt-1 text-sm text-gym-muted">Expediente alimentario de esta persona. Las alergias no salen en el listado general ni en mensajes automáticos.</p>
        <p className="mt-2 text-xs text-gym-silver">Rutina vigente: {routine ? `${routine.templateName} · versión ${routine.versionNumber}` : "Sin rutina asignada"}. Este expediente no modifica el entrenamiento.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === item ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{item}</button>)}
        </div>
        {msg && <p className="mt-3 text-sm text-status-warn">{msg}</p>}
        {!profile ? <p className="mt-6 text-sm text-gym-muted">Cargando…</p> : (
          <div className="mt-5 max-w-3xl space-y-3">
            {tab === "Perfil" && (
              <>
                {([
                  ["goal", "Meta que quiere compartir"],
                  ["schedule", "Horarios habituales de comida"],
                  ["preferences", "Preferencias personales"],
                  ["budget", "Presupuesto aproximado"],
                  ["cookTime", "Tiempo para cocinar"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-xs text-gym-muted">{label}
                    <textarea value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                  </label>
                ))}
                <button type="button" onClick={() => saveProfile()} className="btn-gym">Guardar perfil</button>
              </>
            )}
            {tab === "Restricciones" && (
              <>
                <p className="text-sm text-gym-muted">Las alergias y las restricciones de salud van aparte de las preferencias. El sistema no propone un cambio que las contradiga.</p>
                {([
                  ["allergies", "Alergias que la persona comunica"],
                  ["medical", "Restricciones de salud"],
                  ["excluded", "Alimentos que prefiere excluir"],
                  ["cultural", "Preferencias culturales"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block text-xs text-gym-muted">{label}
                    <textarea value={profile[key]} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                  </label>
                ))}
                <button type="button" onClick={() => saveProfile()} className="btn-gym">Guardar restricciones</button>
              </>
            )}
            {tab === "Plan" && (
              <>
                <p className="text-sm text-white">{assignedName ? `${assignedName} · versión ${assignedVersion}` : "Sin plan asignado"}</p>
                {versionMeals.map((meal) => (
                  <article key={meal.slot} className="glass p-3">
                    <h3 className="font-extrabold text-white">{SLOT_LABEL[meal.slot]}</h3>
                    {!meal.items.length && <p className="text-xs text-gym-muted">Sin alimentos</p>}
                    {meal.items.map((item) => <p key={item.id} className="mt-1 text-sm text-gym-silver">{item.label}{item.portion ? ` · ${item.portion}` : ""}{item.alternatives ? ` · alternativa: ${item.alternatives}` : ""}</p>)}
                  </article>
                ))}
                <div className="flex flex-wrap gap-2">
                  <select value={planId} onChange={(event) => setPlanId(event.target.value)} className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white">
                    <option value="">Elegir plan publicado</option>
                    {published.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {FOCUS_LABEL[plan.focus as PlanFocus]}</option>)}
                  </select>
                  <button type="button" onClick={assign} className="btn-gym">Asignar esta versión</button>
                </div>
              </>
            )}
            {tab === "Diario" && (
              <ul className="space-y-2 text-sm text-gym-silver">
                {logs.filter((row) => row.kind === "comida").map((row) => <li key={row.id} className="glass px-3 py-2">{row.date} · {row.slot || "comida"} · {row.note || "Sin comentario"}</li>)}
                {!logs.some((row) => row.kind === "comida") && <li>Todavía no hay registros de comida.</li>}
              </ul>
            )}
            {tab === "Hábitos" && (
              <>
                <label className="block text-xs text-gym-muted">Cómo registra este cliente
                  <select value={profile.tracking} onChange={(event) => setProfile({ ...profile, tracking: event.target.value as TrackingMode })} className="mt-1 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white">
                    <option value="habitos">Hábitos sencillos</option>
                    <option value="fotos">Diario con nota y foto cuando la autorice</option>
                    <option value="detallado">Registro con alimentos, solo si se habilita</option>
                  </select>
                </label>
                <label className="block text-xs text-gym-muted">Próxima revisión
                  <input type="date" value={profile.nextReview} onChange={(event) => setProfile({ ...profile, nextReview: event.target.value })} className="mt-1 rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                </label>
                <div className="flex gap-2">
                  <input value={habit} onChange={(event) => setHabit(event.target.value)} placeholder="Hábito acordado" className="flex-1 rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
                  <button type="button" className="rounded-xl border border-gym-border px-3 text-xs text-gym-silver" onClick={() => { if (!habit.trim()) return; setProfile({ ...profile, habits: [...profile.habits, { id: crypto.randomUUID(), label: habit.trim(), active: true }] }); setHabit(""); }}>Añadir</button>
                </div>
                <ul className="space-y-1 text-sm text-gym-silver">
                  {profile.habits.map((item) => <li key={item.id}>{item.label}</li>)}
                </ul>
                <button type="button" onClick={() => saveProfile()} className="btn-gym">Guardar hábitos</button>
              </>
            )}
            {tab === "Evolución" && (
              <div className="glass p-4 text-sm text-gym-muted">
                <p>Registros de comida: {logs.filter((row) => row.kind === "comida").length || "—"}</p>
                <p className="mt-2">Hábitos marcados: {logs.filter((row) => row.kind === "habito" && row.done).length || "—"}</p>
                <p className="mt-2">Observaciones recientes: {logs.map((row) => row.note).filter(Boolean).slice(0, 3).join(" · ") || "—"}</p>
                <p className="mt-3">Estos números describen lo registrado. No concluyen que la alimentación, el peso o el rendimiento estén bien o mal.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </GymShell>
  );
}
