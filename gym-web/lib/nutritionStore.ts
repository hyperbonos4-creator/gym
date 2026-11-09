import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSocio } from "./sociosStore";
import {
  emptyMeals,
  type Food,
  type FoodState,
  type MealPlan,
  type MealSlot,
  type NutritionAssignment,
  type NutritionHabit,
  type NutritionLog,
  type NutritionProfile,
  type PlanFocus,
  type PlanItem,
  type PlanMeal,
  type Recipe,
  type TrackingMode,
} from "./nutritionTypes";

const DIR = path.join(process.cwd(), "data");

function file(name: string) {
  return path.join(DIR, name);
}

function read<T>(name: string): T[] {
  try {
    const raw = JSON.parse(fs.readFileSync(file(name), "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write<T>(name: string, rows: T[]) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file(name), JSON.stringify(rows, null, 2), "utf-8");
}

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function optionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10000) throw new Error("dato_invalido");
  return Math.round(n * 10) / 10;
}

function stateOf(value: unknown): FoodState {
  const allowed: FoodState[] = ["crudo", "cocido", "escurrido", "preparado", "unidad"];
  return allowed.includes(value as FoodState) ? value as FoodState : "unidad";
}

function focusOf(value: unknown): PlanFocus {
  return value === "apoyo" || value === "individual" ? value : "habitos";
}

function trackingOf(value: unknown): TrackingMode {
  return value === "fotos" || value === "detallado" ? value : "habitos";
}

export function listFoods(gymId: string) {
  return read<Food>("nutrition-foods.json").filter((row) => row.gymId === gymId).sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function saveFood(gymId: string, input: Record<string, unknown>) {
  const rows = read<Food>("nutrition-foods.json");
  const id = text(input.id, 80);
  const next: Food = {
    id: id || randomUUID(),
    gymId,
    name: text(input.name, 120),
    state: stateOf(input.state),
    portion: text(input.portion, 40) || "100 g",
    kcal: optionalNumber(input.kcal),
    protein: optionalNumber(input.protein),
    carbs: optionalNumber(input.carbs),
    fat: optionalNumber(input.fat),
    allergens: text(input.allergens, 240),
    source: text(input.source, 160),
    note: text(input.note, 400),
  };
  if (!next.name) throw new Error("nombre_requerido");
  const index = rows.findIndex((row) => row.id === next.id && row.gymId === gymId);
  if (index >= 0) rows[index] = next;
  else rows.push(next);
  write("nutrition-foods.json", rows);
  return next;
}

export function listRecipes(gymId: string) {
  return read<Recipe>("nutrition-recipes.json").filter((row) => row.gymId === gymId);
}

export function saveRecipe(gymId: string, input: Record<string, unknown>) {
  const rows = read<Recipe>("nutrition-recipes.json");
  const ingredients = Array.isArray(input.ingredients) ? input.ingredients.slice(0, 40).map((row) => {
    const item = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    return { foodId: text(item.foodId, 80), quantity: optionalNumber(item.quantity), unit: text(item.unit, 20) };
  }).filter((item) => item.foodId) : [];
  const next: Recipe = {
    id: text(input.id, 80) || randomUUID(),
    gymId,
    name: text(input.name, 120),
    portions: Math.max(1, Math.min(40, Number(input.portions) || 1)),
    steps: text(input.steps, 2000),
    ingredients,
  };
  if (!next.name) throw new Error("nombre_requerido");
  const index = rows.findIndex((row) => row.id === next.id && row.gymId === gymId);
  if (index >= 0) rows[index] = next;
  else rows.push(next);
  write("nutrition-recipes.json", rows);
  return next;
}

function mealsOf(input: unknown): PlanMeal[] {
  const base = emptyMeals();
  if (!Array.isArray(input)) return base;
  return base.map((meal) => {
    const raw = input.find((row) => row && typeof row === "object" && (row as PlanMeal).slot === meal.slot) as PlanMeal | undefined;
    if (!raw) return meal;
    const items = Array.isArray(raw.items) ? raw.items.slice(0, 20).map((row) => {
      const item = row as PlanItem;
      return {
        id: text(item.id, 80) || randomUUID(),
        foodId: text(item.foodId, 80),
        recipeId: text(item.recipeId, 80),
        label: text(item.label, 120),
        portion: text(item.portion, 40),
        alternatives: text(item.alternatives, 240),
        note: text(item.note, 240),
      };
    }).filter((item) => item.foodId || item.recipeId || item.label) : [];
    return { slot: meal.slot, note: text(raw.note, 400), items };
  });
}

export function listPlans(gymId: string) {
  return read<MealPlan>("nutrition-plans.json").filter((row) => row.gymId === gymId);
}

export function getPlan(gymId: string, id: string) {
  return listPlans(gymId).find((row) => row.id === id) || null;
}

export function createPlan(gymId: string, name: string, focus: unknown) {
  const plan: MealPlan = {
    id: randomUUID(),
    gymId,
    name: text(name, 120) || "Plan sin nombre",
    focus: focusOf(focus),
    versions: [{ id: randomUUID(), number: 1, status: "borrador", meals: emptyMeals(), createdAt: new Date().toISOString() }],
    updatedAt: new Date().toISOString(),
  };
  const rows = read<MealPlan>("nutrition-plans.json");
  rows.push(plan);
  write("nutrition-plans.json", rows);
  return plan;
}

export function savePlanDraft(gymId: string, id: string, input: Record<string, unknown>) {
  const rows = read<MealPlan>("nutrition-plans.json");
  const index = rows.findIndex((row) => row.gymId === gymId && row.id === id);
  if (index < 0) throw new Error("plan_no_encontrado");
  const plan = rows[index];
  let draft = plan.versions.find((version) => version.status === "borrador");
  if (!draft) {
    const number = plan.versions.reduce((max, version) => Math.max(max, version.number), 0) + 1;
    const published = [...plan.versions].reverse().find((version) => version.status === "publicada");
    draft = { id: randomUUID(), number, status: "borrador", meals: published ? JSON.parse(JSON.stringify(published.meals)) : emptyMeals(), createdAt: new Date().toISOString() };
    plan.versions.push(draft);
  }
  if (input.name != null) plan.name = text(input.name, 120) || plan.name;
  if (input.focus != null) plan.focus = focusOf(input.focus);
  if (input.meals != null) draft.meals = mealsOf(input.meals);
  plan.updatedAt = new Date().toISOString();
  rows[index] = plan;
  write("nutrition-plans.json", rows);
  return plan;
}

export function publishPlan(gymId: string, id: string) {
  const rows = read<MealPlan>("nutrition-plans.json");
  const index = rows.findIndex((row) => row.gymId === gymId && row.id === id);
  if (index < 0) throw new Error("plan_no_encontrado");
  const draft = rows[index].versions.find((version) => version.status === "borrador");
  if (!draft) throw new Error("sin_borrador");
  if (!draft.meals.some((meal) => meal.items.length)) throw new Error("plan_vacio");
  draft.status = "publicada";
  rows[index].updatedAt = new Date().toISOString();
  write("nutrition-plans.json", rows);
  return rows[index];
}

export function listAssignments(gymId: string) {
  return read<NutritionAssignment>("nutrition-assignments.json").filter((row) => row.gymId === gymId);
}

export function activeNutrition(gymId: string, socioId: string) {
  return listAssignments(gymId).find((row) => row.socioId === socioId && row.status === "vigente") || null;
}

export function assignPlan(input: { gymId: string; socioId: string; planId: string; by: string }) {
  const socio = getSocio(text(input.socioId, 80));
  if (!socio || socio.deletedAt || socio.gymId !== input.gymId || socio.rol === "invitado") throw new Error("socio_no_encontrado");
  const plan = getPlan(input.gymId, text(input.planId, 80));
  const version = plan ? [...plan.versions].reverse().find((item) => item.status === "publicada") : null;
  if (!plan || !version) throw new Error("sin_version_publicada");
  const rows = read<NutritionAssignment>("nutrition-assignments.json");
  rows.forEach((row) => {
    if (row.gymId === input.gymId && row.socioId === socio.id && row.status === "vigente") row.status = "cerrada";
  });
  const next: NutritionAssignment = {
    id: randomUUID(),
    gymId: input.gymId,
    socioId: socio.id,
    planId: plan.id,
    versionId: version.id,
    versionNumber: version.number,
    status: "vigente",
    assignedAt: new Date().toISOString(),
    assignedBy: text(input.by, 80),
  };
  rows.push(next);
  write("nutrition-assignments.json", rows);
  return next;
}

export function listProfiles(gymId: string) {
  return read<NutritionProfile>("nutrition-profiles.json").filter((row) => row.gymId === gymId);
}

export function getProfile(gymId: string, socioId: string): NutritionProfile {
  const found = read<NutritionProfile>("nutrition-profiles.json").find((row) => row.gymId === gymId && row.socioId === socioId);
  if (found) return found;
  return {
    id: "",
    gymId,
    socioId,
    goal: "",
    schedule: "",
    preferences: "",
    budget: "",
    cookTime: "",
    allergies: "",
    medical: "",
    excluded: "",
    cultural: "",
    tracking: "habitos",
    habits: [],
    nextReview: "",
    updatedAt: "",
  };
}

export function saveProfile(gymId: string, socioId: string, input: Record<string, unknown>) {
  const socio = getSocio(socioId);
  if (!socio || socio.deletedAt || socio.gymId !== gymId || socio.rol === "invitado") throw new Error("socio_no_encontrado");
  const rows = read<NutritionProfile>("nutrition-profiles.json");
  const current = getProfile(gymId, socioId);
  const habits = Array.isArray(input.habits) ? input.habits.slice(0, 12).map((row) => {
    const item = (row && typeof row === "object" ? row : {}) as NutritionHabit;
    return { id: text(item.id, 80) || randomUUID(), label: text(item.label, 120), active: item.active !== false };
  }).filter((item) => item.label) : current.habits;
  const next: NutritionProfile = {
    ...current,
    id: current.id || randomUUID(),
    goal: input.goal == null ? current.goal : text(input.goal, 240),
    schedule: input.schedule == null ? current.schedule : text(input.schedule, 400),
    preferences: input.preferences == null ? current.preferences : text(input.preferences, 800),
    budget: input.budget == null ? current.budget : text(input.budget, 80),
    cookTime: input.cookTime == null ? current.cookTime : text(input.cookTime, 80),
    allergies: input.allergies == null ? current.allergies : text(input.allergies, 800),
    medical: input.medical == null ? current.medical : text(input.medical, 800),
    excluded: input.excluded == null ? current.excluded : text(input.excluded, 800),
    cultural: input.cultural == null ? current.cultural : text(input.cultural, 400),
    tracking: input.tracking == null ? current.tracking : trackingOf(input.tracking),
    habits,
    nextReview: input.nextReview == null ? current.nextReview : text(input.nextReview, 10),
    updatedAt: new Date().toISOString(),
  };
  if (next.nextReview && !/^\d{4}-\d{2}-\d{2}$/.test(next.nextReview)) throw new Error("fecha_invalida");
  const index = rows.findIndex((row) => row.gymId === gymId && row.socioId === socioId);
  if (index >= 0) rows[index] = next;
  else rows.push(next);
  write("nutrition-profiles.json", rows);
  return next;
}

export function listLogs(gymId: string, socioId = "") {
  return read<NutritionLog>("nutrition-logs.json")
    .filter((row) => row.gymId === gymId && (!socioId || row.socioId === socioId))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function addLog(input: { gymId: string; socioId: string; date: string; kind: "habito" | "comida"; habitId?: string; slot?: MealSlot | ""; done?: boolean; note?: string }) {
  const date = text(input.date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("fecha_invalida");
  const rows = read<NutritionLog>("nutrition-logs.json");
  const next: NutritionLog = {
    id: randomUUID(),
    gymId: input.gymId,
    socioId: input.socioId,
    date,
    kind: input.kind,
    habitId: text(input.habitId, 80),
    slot: input.slot === "desayuno" || input.slot === "almuerzo" || input.slot === "merienda" || input.slot === "cena" ? input.slot : "",
    done: Boolean(input.done),
    note: text(input.note, 500),
    at: new Date().toISOString(),
  };
  rows.push(next);
  write("nutrition-logs.json", rows);
  return next;
}

export function clientNutrition(gymId: string, socioId: string) {
  const profile = getProfile(gymId, socioId);
  const link = activeNutrition(gymId, socioId);
  const plan = link ? getPlan(gymId, link.planId) : null;
  const version = plan?.versions.find((item) => item.id === link?.versionId) || null;
  return {
    profile: { ...profile, allergies: "", medical: "" },
    privateProfile: profile,
    assignment: link,
    planName: plan?.name || "",
    focus: plan?.focus || "",
    version: version ? { number: version.number, meals: version.meals } : null,
    logs: listLogs(gymId, socioId).slice(0, 40),
  };
}
