import { NextResponse } from "next/server";
import { waSendText } from "../../../../lib/evolution";
import { buildExerciseClientLink, exerciseWhatsappMessage } from "../../../../lib/exerciseShare";
import { EXERCISES } from "../../../../lib/exercisesCatalog";
import { getSocio, listSocios } from "../../../../lib/sociosStore";
import { guardGym } from "../../../../lib/authServer";
import { gymInstance } from "../../../../lib/gymsStore";
import { assignExercises } from "../../../../lib/exerciseAssignments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }

  const exerciseId = String(b?.exerciseId || "").trim();
  const gymId = String(b?.gym || "fuerza-elite");
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const ids = Array.isArray(b?.socioIds) ? b.socioIds.map((x: unknown) => String(x || "").trim()).filter(Boolean) : [];

  const exercise = EXERCISES.find((e) => e.id === exerciseId);
  if (!exercise) return NextResponse.json({ ok: false, error: "ejercicio_no_encontrado" }, { status: 404 });
  if (ids.length === 0) return NextResponse.json({ ok: false, error: "elige_clientes" }, { status: 400 });

  const allowed = new Set(listSocios(gymId).map((s) => s.id));
  const targets = ids.filter((id: string) => allowed.has(id));
  const assigned = assignExercises(gymId, targets, exercise.id, auth.nombre || "entrenador");
  const link = await buildExerciseClientLink(req, exercise.id);
  const instance = gymInstance(gymId);

  const results = [];
  for (const id of ids) {
    if (!allowed.has(id)) {
      results.push({ id, ok: false, error: "cliente_no_encontrado" });
      continue;
    }
    const socio = getSocio(id);
    if (!socio) {
      results.push({ id, ok: false, error: "cliente_no_encontrado" });
      continue;
    }
    const tel = socio.celular.length === 10 ? socio.codigoPais + socio.celular : socio.celular;
    const wa = await waSendText(instance, tel, exerciseWhatsappMessage(socio.nombre, exercise.name));
    results.push({ id, nombre: socio.nombre, ...wa });
  }

  const sent = results.filter((r) => r.ok).length;
  return NextResponse.json({
    ok: assigned > 0,
    link,
    assigned,
    sent,
    failed: results.length - sent,
    results,
  });
}
