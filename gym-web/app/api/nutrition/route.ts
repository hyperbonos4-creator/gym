import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import {
  activeNutrition,
  addLog,
  assignPlan,
  clientNutrition,
  createPlan,
  getProfile,
  listAssignments,
  listFoods,
  listLogs,
  listPlans,
  listProfiles,
  listRecipes,
  publishPlan,
  saveFood,
  savePlanDraft,
  saveProfile,
  saveRecipe,
} from "../../../lib/nutritionStore";
import { getPlan } from "../../../lib/nutritionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR: Record<string, string> = {
  nombre_requerido: "Escribe el nombre.",
  dato_invalido: "Hay un número fuera de rango. Si no tienes el dato, déjalo vacío.",
  plan_no_encontrado: "Ese plan no está en esta sede.",
  sin_borrador: "No hay un borrador para publicar.",
  plan_vacio: "Agrega al menos un alimento o una receta antes de publicar.",
  socio_no_encontrado: "Ese cliente no está en esta sede.",
  sin_version_publicada: "Publica el plan antes de asignarlo.",
  fecha_invalida: "Revisa la fecha.",
};

function fail(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return NextResponse.json({ ok: false, error: ERROR[code] || "No se pudo guardar." }, { status: 400 });
}

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const socio = url.searchParams.get("socio") || "";
  const planId = url.searchParams.get("plan") || "";
  return NextResponse.json({
    ok: true,
    foods: listFoods(gymId),
    recipes: listRecipes(gymId),
    plans: listPlans(gymId),
    plan: planId ? getPlan(gymId, planId) : null,
    assignments: listAssignments(gymId),
    profile: socio ? getProfile(gymId, socio) : null,
    client: socio ? clientNutrition(gymId, socio) : null,
    profiles: listProfiles(gymId),
    logs: listLogs(gymId, socio).slice(0, 80),
    active: socio ? activeNutrition(gymId, socio) : null,
  });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const action = String(body.action || "");
  try {
    if (action === "alimento") return NextResponse.json({ ok: true, food: saveFood(gymId, body) });
    if (action === "receta") return NextResponse.json({ ok: true, recipe: saveRecipe(gymId, body) });
    if (action === "crear") return NextResponse.json({ ok: true, plan: createPlan(gymId, String(body.name || ""), body.focus) });
    if (action === "guardar") return NextResponse.json({ ok: true, plan: savePlanDraft(gymId, String(body.id || ""), body) });
    if (action === "publicar") return NextResponse.json({ ok: true, plan: publishPlan(gymId, String(body.id || "")) });
    if (action === "asignar") return NextResponse.json({ ok: true, assignment: assignPlan({ gymId, socioId: String(body.socioId || ""), planId: String(body.planId || ""), by: auth.nombre }) });
    if (action === "perfil") return NextResponse.json({ ok: true, profile: saveProfile(gymId, String(body.socioId || ""), body) });
    if (action === "registro") {
      return NextResponse.json({ ok: true, log: addLog({
        gymId,
        socioId: String(body.socioId || ""),
        date: String(body.date || new Date().toISOString().slice(0, 10)),
        kind: body.kind === "comida" ? "comida" : "habito",
        habitId: String(body.habitId || ""),
        slot: body.slot as "desayuno" | "almuerzo" | "merienda" | "cena" | "",
        done: Boolean(body.done),
        note: String(body.note || ""),
      }) });
    }
    return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
  } catch (error) {
    return fail(error);
  }
}
