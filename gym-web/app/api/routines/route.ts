import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { createRoutine, listRoutines } from "../../../lib/routinesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, items: listRoutines(gymId) });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const template = createRoutine({
      gymId,
      name: String(b?.name || ""),
      goal: String(b?.goal || ""),
      level: String(b?.level || ""),
      by: auth.nombre,
      days: b?.days,
    });
    return NextResponse.json({ ok: true, template });
  } catch (e: any) {
    const code = String(e?.message || e);
    return NextResponse.json({ ok: false, error: code === "nombre_requerido" ? "Escribe el nombre de la plantilla." : code }, { status: 400 });
  }
}
