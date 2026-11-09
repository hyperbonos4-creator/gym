"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { FOCUS_LABEL, STATE_LABEL, type Food, type FoodState, type MealPlan, type NutritionAssignment, type NutritionLog, type NutritionProfile, type Recipe } from "../../lib/nutritionTypes";
import { draftOf, latestPublished } from "../../lib/nutritionTypes";
import { getActiveGymId } from "../../lib/session";

type Socio = { id: string; nombre: string; rol?: string };

function dash(ready: boolean, value: number, hint: string) {
  if (!ready || value === 0) return { value: "—", hint };
  return { value: String(value), hint };
}

export default function NutricionPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [tab, setTab] = useState<"resumen" | "clientes" | "planes" | "alimentos">("resumen");
  const [query, setQuery] = useState("");
  const [socios, setSocios] = useState<Socio[] | null>(null);
  const [plans, setPlans] = useState<MealPlan[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [assignments, setAssignments] = useState<NutritionAssignment[]>([]);
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [profiles, setProfiles] = useState<NutritionProfile[]>([]);
  const [msg, setMsg] = useState("");
  const [food, setFood] = useState({ name: "", state: "unidad" as FoodState, portion: "100 g", kcal: "", protein: "", carbs: "", fat: "", source: "", allergens: "" });
  const [recipe, setRecipe] = useState({ name: "", portions: "1", steps: "", foodId: "", quantity: "", unit: "g" });

  const load = useCallback(async (id: string) => {
    const [people, data] = await Promise.all([
      fetch(`/api/socios?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/nutrition?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((res) => res.json()),
    ]);
    setSocios((people.items || []).filter((row: Socio) => row.rol !== "invitado"));
    setPlans(data.plans || []);
    setFoods(data.foods || []);
    setRecipes(data.recipes || []);
    setAssignments(data.assignments || []);
    setLogs(data.logs || []);
    setProfiles(data.profiles || []);
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id).catch(() => setSocios([]));
  }, [load]);

  async function post(body: Record<string, unknown>) {
    setMsg("");
    const res = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, gym: gymId }) });
    const data = await res.json();
    if (!data.ok) setMsg(data.error || "No se pudo guardar.");
    else await load(gymId);
    return data;
  }

  const ready = socios !== null;
  const today = new Date().toISOString().slice(0, 10);
  const vigentes = assignments.filter((row) => row.status === "vigente");
  const reviews = profiles.filter((row) => row.nextReview && row.nextReview <= today).length;
  const todayLogs = logs.filter((row) => row.date === today && row.kind === "comida").length;
  const habits = profiles.reduce((sum, row) => sum + row.habits.filter((habit) => habit.active).length, 0);
  const members = (socios || []).filter((person) => person.nombre.toLowerCase().includes(query.trim().toLowerCase()));
  const cards = [
    dash(ready, vigentes.length, vigentes.length ? "Asignaciones vigentes" : "Todavía nadie tiene un plan vigente"),
    dash(ready, reviews, reviews ? "Fechas de revisión ya cumplidas" : "Sin seguimientos vencidos"),
    dash(ready, todayLogs, todayLogs ? "Registros de comida de hoy" : "Hoy no ha llegado ningún registro"),
    dash(ready, habits, habits ? "Objetivos activos" : "Sin hábitos en seguimiento"),
  ];

  return (
    <GymShell active="nutricion">
      <div className="px-6 py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">Gimnasio</p>
        <h2 className="text-xl font-extrabold text-white">Nutrición</h2>
        <p className="mt-1 max-w-2xl text-sm text-gym-muted">Planificación alimentaria, hábitos y seguimiento. Una guía general no es una dieta clínica. Editar un plan no cambia la versión que ya tiene un cliente.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ["resumen", "Resumen"],
            ["clientes", "Clientes"],
            ["planes", "Planes alimentarios"],
            ["alimentos", "Alimentos y recetas"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${tab === id ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {["Clientes con plan", "Revisiones", "Registros de comidas", "Hábitos en seguimiento"].map((label, index) => (
            <div key={label} className="glass-soft px-4 py-3">
              <div className="text-[11px] text-gym-muted">{label}</div>
              <div className="text-2xl font-extrabold text-white">{cards[index].value}</div>
              <div className="mt-1 text-[11px] text-gym-muted">{cards[index].hint}</div>
            </div>
          ))}
        </div>
        {msg && <p className="mt-3 text-sm text-status-warn">{msg}</p>}

        {tab === "resumen" && (
          <section className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              ["Planes alimentarios", "Crea comidas, publica una versión y asígnala. La lista de compras sale de esa versión."],
              ["Biblioteca", "Alimentos con su estado, crudo o cocido, y recetas. Si falta un dato, no se inventa."],
              ["Seguimiento", "Hábitos, notas del día y la rutina asignada, sin una puntuación de alimentos buenos o malos."],
            ].map(([title, copy]) => (
              <article key={title} className="glass p-4">
                <h3 className="font-extrabold text-white">{title}</h3>
                <p className="mt-2 text-sm text-gym-muted">{copy}</p>
              </article>
            ))}
          </section>
        )}

        {tab === "clientes" && (
          <section className="mt-6">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente..." className="w-full max-w-md rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white outline-none" />
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {members.map((person) => {
                const link = vigentes.find((row) => row.socioId === person.id);
                const plan = plans.find((row) => row.id === link?.planId);
                return (
                  <li key={person.id} className="glass p-4">
                    <div className="font-extrabold text-white">{person.nombre}</div>
                    <div className="mt-1 text-xs text-gym-muted">{plan ? `${plan.name} · versión ${link?.versionNumber}` : "Sin plan alimentario"}</div>
                    <a href={`/nutricion/clientes/${person.id}`} className="mt-3 inline-block text-xs font-semibold text-gym-primary">Expediente</a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "planes" && (
          <section className="mt-6">
            <button type="button" className="btn-gym" onClick={async () => {
              const data = await post({ action: "crear", name: "Nuevo plan", focus: "habitos" });
              if (data.plan) window.location.href = `/nutricion/planes/${data.plan.id}`;
            }}>Crear plan</button>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {plans.map((plan) => {
                const published = latestPublished(plan);
                const draft = draftOf(plan);
                const people = vigentes.filter((row) => row.planId === plan.id).length;
                return (
                  <li key={plan.id} className="glass p-4">
                    <div className="font-extrabold text-white">{plan.name}</div>
                    <div className="mt-1 text-xs text-gym-muted">{FOCUS_LABEL[plan.focus]}</div>
                    <div className="mt-2 text-[11px] text-gym-silver">{published ? `Versión ${published.number} publicada` : "Sin publicar"}{draft ? " · hay borrador" : ""} · {people === 0 ? "sin asignar" : `${people} vigente${people === 1 ? "" : "s"}`}</div>
                    <a href={`/nutricion/planes/${plan.id}`} className="mt-3 inline-block text-xs font-semibold text-gym-primary">Abrir editor</a>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "alimentos" && (
          <section className="mt-6 grid gap-6 lg:grid-cols-2">
            <form className="glass space-y-2 p-4" onSubmit={(event) => { event.preventDefault(); post({ action: "alimento", ...food }); }}>
              <h3 className="font-extrabold text-white">Alimento</h3>
              <input required value={food.name} onChange={(event) => setFood({ ...food, name: event.target.value })} placeholder="Nombre" className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
              <div className="grid grid-cols-2 gap-2">
                <select value={food.state} onChange={(event) => setFood({ ...food, state: event.target.value as FoodState })} className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white">
                  {(Object.keys(STATE_LABEL) as FoodState[]).map((state) => <option key={state} value={state}>{STATE_LABEL[state]}</option>)}
                </select>
                <input value={food.portion} onChange={(event) => setFood({ ...food, portion: event.target.value })} placeholder="Porción de referencia" className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(["kcal", "protein", "carbs", "fat"] as const).map((key) => (
                  <input key={key} value={food[key]} onChange={(event) => setFood({ ...food, [key]: event.target.value })} placeholder={key === "kcal" ? "kcal" : key === "protein" ? "prot" : key === "carbs" ? "carb" : "grasa"} className="rounded-xl border border-gym-border bg-transparent px-2 py-2 text-sm text-white" />
                ))}
              </div>
              <input value={food.source} onChange={(event) => setFood({ ...food, source: event.target.value })} placeholder="Fuente del dato, si la hay" className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
              <input value={food.allergens} onChange={(event) => setFood({ ...food, allergens: event.target.value })} placeholder="Alérgenos conocidos" className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
              <p className="text-[11px] text-gym-muted">100 g crudos no son 100 g cocidos. Si no tienes el dato, déjalo vacío.</p>
              <button className="btn-gym" type="submit">Guardar alimento</button>
              <ul className="space-y-1 text-sm text-gym-silver">
                {foods.map((item) => <li key={item.id}>{item.name} · {STATE_LABEL[item.state]} · {item.kcal == null ? "sin kcal" : `${item.kcal} kcal`}</li>)}
              </ul>
            </form>
            <form className="glass space-y-2 p-4" onSubmit={(event) => {
              event.preventDefault();
              post({ action: "receta", name: recipe.name, portions: Number(recipe.portions) || 1, steps: recipe.steps, ingredients: recipe.foodId ? [{ foodId: recipe.foodId, quantity: recipe.quantity === "" ? null : Number(recipe.quantity), unit: recipe.unit }] : [] });
            }}>
              <h3 className="font-extrabold text-white">Receta</h3>
              <input required value={recipe.name} onChange={(event) => setRecipe({ ...recipe, name: event.target.value })} placeholder="Nombre" className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
              <textarea value={recipe.steps} onChange={(event) => setRecipe({ ...recipe, steps: event.target.value })} rows={3} placeholder="Preparación" className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" />
              <select value={recipe.foodId} onChange={(event) => setRecipe({ ...recipe, foodId: event.target.value })} className="w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white">
                <option value="">Ingrediente</option>
                {foods.map((item) => <option key={item.id} value={item.id}>{item.name} · {STATE_LABEL[item.state]}</option>)}
              </select>
              <p className="text-[11px] text-gym-muted">Esta ficha guarda un ingrediente. Puedes ampliar la receta después desde el plan.</p>
              <button className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver" type="submit">Guardar receta</button>
              <ul className="space-y-1 text-sm text-gym-silver">
                {recipes.map((item) => <li key={item.id}>{item.name} · {item.ingredients.length} ingrediente{item.ingredients.length === 1 ? "" : "s"}</li>)}
              </ul>
            </form>
          </section>
        )}
      </div>
    </GymShell>
  );
}
