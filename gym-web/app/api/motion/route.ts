import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { createPiece, listPieces, publishedClip } from "../../../lib/motionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const exercise = new URL(req.url).searchParams.get("exercise") || "";
  if (exercise) return NextResponse.json({ ok: true, clip: publishedClip(exercise) });
  return NextResponse.json({ ok: true, items: listPieces(gymId) });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const piece = createPiece({
      gymId,
      name: String(body.name || ""),
      exerciseId: String(body.exerciseId || ""),
      author: auth.nombre,
    });
    return NextResponse.json({ ok: true, piece });
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: messageOf(code) }, { status: 400 });
  }
}

function messageOf(code: string) {
  if (code === "nombre_requerido") return "Escribe el nombre del ejercicio.";
  return "No se pudo crear el ejercicio.";
}
