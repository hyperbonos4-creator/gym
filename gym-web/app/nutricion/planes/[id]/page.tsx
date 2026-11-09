"use client";

import { useEffect, useMemo, useState } from "react";
import GymShell from "../../../../components/GymShell";
import { FOCUS_LABEL, SLOT_LABEL, SLOTS, STATE_LABEL, draftOf, emptyMeals, foodLine, type Food, type MealPlan, type MealSlot, type PlanFocus, type PlanMeal, type Recipe } from "../../../../lib/nutritionTypes";
import { getActiveGymId } from "../../../../lib/session";

export default function PlanEditorPage({ params }: { params: { id: string } }) {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [name, setName] = useState("");
  const [focus, setFocus] = useState<PlanFocus>("habitos");
  const [meals, setMeals] = useState<PlanMeal[]>(emptyMeals());
  const [pick, setPick] = useState<Record<MealSlot, { kind: "food" | "recipe"; id: string; portion: string; alternatives: string }>>({
    desayuno: { kind: "food", id: "", portion: "", alternatives: "" },
    almuerzo: { kind: "food", id: "", portion: "", alternatives: "" },
    merienda: { kind: "food", id: "", portion: "", alternatives: "" },
    cena: { kind: "food", id: "", portion: "", alternatives: "" },
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load(id: string) {
    const data = await fetch(`/api/nutrition?gym=${encodeURIComponent(id)}&plan=${encodeURIComponent(params.id)}`, { cache: "no-store" }).then((res) => res.json());
    const next = data.plan as MealPlan | null;
    setPlan(next);
    setFoods(data.foods || []);
    setRecipes(data.recipes || []);
    if (next) {
      const draft = draftOf(next);
      setName(next.name);
      setFocus(next.focus);
      setMeals(draft?.meals || emptyMeals());
    }
  }

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id).catch(() => setMsg("No se pudo abrir el plan."));
  }, [params.id]);

  const shopping = useMemo(() => {
    const lines = new Map<string, { name: string; text: string }>();
    meals.forEach((meal) => meal.items.forEach((item) => {
      if (item.recipeId) {
        const recipe = recipes.find((row) => row.id === item.recipeId);
        recipe?.ingredients.forEach((ingredient) => {
          const food = foods.find((row) => row.id === ingredient.foodId);
          const key = ingredient.foodId || food?.name || "sin-dato";
          const qty = ingredient.quantity == null ? "cantidad sin dato" : `${ingredient.quantity} ${ingredient.unit}`;
          const previous = lines.get(key);
          lines.set(key, { name: food ? `${food.name} (${STATE_LABEL[food.state]})` : "Ingrediente sin ficha", text: previous ? `${previous.text} + ${qty}` : qty });
        });
      } else if (item.foodId) {
        const food = foods.find((row) => row.id === item.foodId);
        lines.set(item.id, { name: food ? `${food.name} (${STATE_LABEL[food.state]})` : item.label, text: item.portion || food?.portion || "porción sin dato" });
      }
    }));
    return [...lines.values()];
  }, [meals, recipes, foods]);

  function addItem(slot: MealSlot) {
    const choice = pick[slot];
    const food = foods.find((row) => row.id === choice.id);
    const recipe = recipes.find((row) => row.id === choice.id);
    if (choice.kind === "food" && !food) return setMsg("Elige un alimento.");
    if (choice.kind === "recipe" && !recipe) return setMsg("Elige una receta.");
    setMsg("");
    setMeals(meals.map((meal) => meal.slot === slot ? {
      ...meal,
      items: [...meal.items, {
        id: crypto.randomUUID(),
        foodId: choice.kind === "food" ? choice.id : "",
        recipeId: choice.kind === "recipe" ? choice.id : "",
        label: food?.name || recipe?.name || "",
        portion: choice.portion,
        alternatives: choice.alternatives,
        note: "",
      }],
    } : meal));
  }

  async function save(publish: boolean) {
    setBusy(true);
    setMsg("");
    const saved = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "guardar", gym: gymId, id: params.id, name, focus, meals }) }).then((res) => res.json());
    if (!saved.ok) {
      setBusy(false);
      setMsg(saved.error || "No se pudo guardar.");
      return;
    }
    if (publish) {
      const published = await fetch("/api/nutrition", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publicar", gym: gymId, id: params.id }) }).then((res) => res.json());
      if (!published.ok) setMsg(published.error || "No se pudo publicar.");
    }
    await load(gymId);
    setBusy(false);
  }

  const draft = plan ? draftOf(plan) : null;

  return (
    <GymShell active="nutricion">
      <div className="px-6 py-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">Nutrición / editor</p>
        <h2 className="text-xl font-extrabold text-white">Plan alimentario</h2>
        <p className="mt-1 text-sm text-gym-muted">{draft ? `Borrador · versión ${draft.number}` : "No hay borrador. Al guardar se abre uno nuevo a partir de la última versión publicada."}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white" placeholder="Nombre del plan" />
          <select value={focus} onChange={(event) => setFocus(event.target.value as PlanFocus)} className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-white">
            {(Object.keys(FOCUS_LABEL) as PlanFocus[]).map((key) => <option key={key} value={key}>{FOCUS_LABEL[key]}</option>)}
          </select>
        </div>
        {focus === "individual" && <p className="mt-2 text-xs text-status-warn">Un plan individual para una condición de salud lo elabora un profesional cualificado. Esta ficha no lo certifica.</p>}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {SLOTS.map((slot) => (
            <section key={slot} className="glass p-4">
              <h3 className="font-extrabold text-white">{SLOT_LABEL[slot]}</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {meals.find((meal) => meal.slot === slot)?.items.map((item) => {
                  const food = foods.find((row) => row.id === item.foodId);
                  const line = foodLine(food, item.portion);
                  return (
                    <li key={item.id} className="rounded-xl border border-gym-border px-3 py-2">
                      <div className="font-semibold text-white">{item.label || line.label}</div>
                      <div className="text-[11px] text-gym-muted">{item.recipeId ? "Receta" : line.text}</div>
                      {item.alternatives && <div className="text-[11px] text-gym-silver">Alternativa indicada: {item.alternatives}. No se trata como equivalente automático.</div>}
                      <button type="button" className="mt-1 text-[11px] text-status-warn" onClick={() => setMeals(meals.map((meal) => meal.slot === slot ? { ...meal, items: meal.items.filter((row) => row.id !== item.id) } : meal))}>Quitar</button>
                    </li>
                  );
                })}
                {!meals.find((meal) => meal.slot === slot)?.items.length && <li className="text-xs text-gym-muted">Sin alimentos</li>}
              </ul>
              <div className="mt-3 grid gap-2">
                <div className="flex gap-2">
                  <select value={pick[slot].kind} onChange={(event) => setPick({ ...pick, [slot]: { ...pick[slot], kind: event.target.value as "food" | "recipe", id: "" } })} className="rounded-xl border border-gym-border bg-transparent px-2 py-2 text-xs text-white">
                    <option value="food">Alimento</option>
                    <option value="recipe">Receta</option>
                  </select>
                  <select value={pick[slot].id} onChange={(event) => setPick({ ...pick, [slot]: { ...pick[slot], id: event.target.value } })} className="min-w-0 flex-1 rounded-xl border border-gym-border bg-transparent px-2 py-2 text-xs text-white">
                    <option value="">Elegir</option>
                    {pick[slot].kind === "food" ? foods.map((item) => <option key={item.id} value={item.id}>{item.name} · {STATE_LABEL[item.state]}</option>) : recipes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </div>
                <input value={pick[slot].portion} onChange={(event) => setPick({ ...pick, [slot]: { ...pick[slot], portion: event.target.value } })} placeholder="Porción orientativa o gramos" className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-xs text-white" />
                <input value={pick[slot].alternatives} onChange={(event) => setPick({ ...pick, [slot]: { ...pick[slot], alternatives: event.target.value } })} placeholder="Alternativa, si la indicas tú" className="rounded-xl border border-gym-border bg-transparent px-3 py-2 text-xs text-white" />
                <button type="button" onClick={() => addItem(slot)} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver">Añadir</button>
              </div>
            </section>
          ))}
        </div>
        <section className="glass mt-4 p-4">
          <h3 className="font-extrabold text-white">Lista de compras</h3>
          <p className="mt-1 text-xs text-gym-muted">Sale de los ingredientes y porciones de este borrador. Las cantidades repetidas se dejan visibles; no se convierten solas entre crudo y cocido.</p>
          <ul className="mt-2 space-y-1 text-sm text-gym-silver">
            {shopping.map((line) => <li key={line.name + line.text}>{line.name} · {line.text}</li>)}
            {!shopping.length && <li>Todavía no hay ingredientes.</li>}
          </ul>
        </section>
        {msg && <p className="mt-3 text-sm text-status-warn">{msg}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" disabled={busy} onClick={() => save(false)} className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver">Guardar borrador</button>
          <button type="button" disabled={busy} onClick={() => save(true)} className="btn-gym">Publicar versión</button>
          <a href="/nutricion" className="px-3 py-2 text-sm text-gym-muted">Volver</a>
        </div>
      </div>
    </GymShell>
  );
}
