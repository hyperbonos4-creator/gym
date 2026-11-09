export type FoodState = "crudo" | "cocido" | "escurrido" | "preparado" | "unidad";
export type PlanFocus = "habitos" | "apoyo" | "individual";
export type MealSlot = "desayuno" | "almuerzo" | "merienda" | "cena";
export type TrackingMode = "habitos" | "fotos" | "detallado";

export type Food = {
  id: string;
  gymId: string;
  name: string;
  state: FoodState;
  portion: string;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  allergens: string;
  source: string;
  note: string;
};

export type RecipeIngredient = {
  foodId: string;
  quantity: number | null;
  unit: string;
};

export type Recipe = {
  id: string;
  gymId: string;
  name: string;
  portions: number;
  steps: string;
  ingredients: RecipeIngredient[];
};

export type PlanItem = {
  id: string;
  foodId: string;
  recipeId: string;
  label: string;
  portion: string;
  alternatives: string;
  note: string;
};

export type PlanMeal = {
  slot: MealSlot;
  note: string;
  items: PlanItem[];
};

export type PlanVersion = {
  id: string;
  number: number;
  status: "borrador" | "publicada";
  meals: PlanMeal[];
  createdAt: string;
};

export type MealPlan = {
  id: string;
  gymId: string;
  name: string;
  focus: PlanFocus;
  versions: PlanVersion[];
  updatedAt: string;
};

export type NutritionHabit = {
  id: string;
  label: string;
  active: boolean;
};

export type NutritionProfile = {
  id: string;
  gymId: string;
  socioId: string;
  goal: string;
  schedule: string;
  preferences: string;
  budget: string;
  cookTime: string;
  allergies: string;
  medical: string;
  excluded: string;
  cultural: string;
  tracking: TrackingMode;
  habits: NutritionHabit[];
  nextReview: string;
  updatedAt: string;
};

export type NutritionAssignment = {
  id: string;
  gymId: string;
  socioId: string;
  planId: string;
  versionId: string;
  versionNumber: number;
  status: "vigente" | "cerrada";
  assignedAt: string;
  assignedBy: string;
};

export type NutritionLog = {
  id: string;
  gymId: string;
  socioId: string;
  date: string;
  kind: "habito" | "comida";
  habitId: string;
  slot: MealSlot | "";
  done: boolean;
  note: string;
  at: string;
};

export const SLOT_LABEL: Record<MealSlot, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  merienda: "Merienda",
  cena: "Cena",
};

export const FOCUS_LABEL: Record<PlanFocus, string> = {
  habitos: "Hábitos alimentarios y organización",
  apoyo: "Apoyo general al entrenamiento",
  individual: "Plan individual elaborado por profesional cualificado",
};

export const STATE_LABEL: Record<FoodState, string> = {
  crudo: "Crudo",
  cocido: "Cocido",
  escurrido: "Escurrido",
  preparado: "Preparado",
  unidad: "Unidad definida",
};

export const SLOTS: MealSlot[] = ["desayuno", "almuerzo", "merienda", "cena"];

export function emptyMeals(): PlanMeal[] {
  return SLOTS.map((slot) => ({ slot, note: "", items: [] }));
}

export function latestPublished(plan: MealPlan) {
  return [...plan.versions].reverse().find((version) => version.status === "publicada") || null;
}

export function draftOf(plan: MealPlan) {
  return plan.versions.find((version) => version.status === "borrador") || null;
}

export type NutrientLine = {
  label: string;
  text: string;
  incomplete: boolean;
};

export function foodLine(food: Food | undefined, portion: string): NutrientLine {
  if (!food) return { label: portion || "Porción", text: "Sin dato de alimento", incomplete: true };
  const bits = [
    food.kcal == null ? "" : `${food.kcal} kcal`,
    food.protein == null ? "" : `${food.protein} g proteína`,
    food.carbs == null ? "" : `${food.carbs} g carbohidratos`,
    food.fat == null ? "" : `${food.fat} g grasa`,
  ].filter(Boolean);
  return {
    label: `${food.name} · ${STATE_LABEL[food.state]}${portion ? ` · ${portion}` : ""}`,
    text: bits.length ? bits.join(" · ") : "Sin datos nutricionales para este estado",
    incomplete: bits.length < 4,
  };
}
