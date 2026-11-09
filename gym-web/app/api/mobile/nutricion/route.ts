import { NextResponse } from "next/server";
import { socioFromMobileRequest } from "../../../../lib/mobileSession";
import { activeAssignment } from "../../../../lib/routineAssignments";
import { getRoutine } from "../../../../lib/routinesStore";
import { assessmentsForSocio } from "../../../../lib/assessments";
import { addLog, clientNutrition, listFoods } from "../../../../lib/nutritionStore";
import { foodLine } from "../../../../lib/nutritionTypes";
import { calendarDate } from "../../../../lib/routineProgram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  const view = clientNutrition(session.gymId, session.socio.id);
  const link = activeAssignment(session.gymId, session.socio.id);
  const routine = link ? getRoutine(session.gymId, link.templateId) : null;
  const last = assessmentsForSocio(session.gymId, session.socio.id).find((row) => row.status === "cerrada");
  const today = calendarDate();
  const foods = listFoods(session.gymId);
  const meals = (view.version?.meals || []).map((meal) => ({
    ...meal,
    items: meal.items.map((item) => ({
      ...item,
      detail: view.profile.tracking === "detallado" ? foodLine(foods.find((food) => food.id === item.foodId), item.portion).text : "",
    })),
  }));
  return NextResponse.json({
    ok: true,
    today,
    planName: view.planName,
    version: view.version?.number || null,
    focus: view.focus,
    meals,
    tracking: view.profile.tracking,
    habits: view.profile.habits.filter((habit) => habit.active),
    preferences: view.profile.preferences,
    logs: view.logs.filter((row) => row.date === today),
    routineName: routine?.name || "",
    assessmentDate: last?.measuredAt || "",
  });
}

export async function POST(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  try {
    const log = addLog({
      gymId: session.gymId,
      socioId: session.socio.id,
      date: calendarDate(),
      kind: body.kind === "comida" ? "comida" : "habito",
      habitId: String(body.habitId || ""),
      slot: body.slot as "desayuno" | "almuerzo" | "merienda" | "cena" | "",
      done: body.done !== false,
      note: String(body.note || ""),
    });
    return NextResponse.json({ ok: true, log });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo guardar el registro." }, { status: 400 });
  }
}
