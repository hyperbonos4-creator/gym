import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { getPiece, publishPiece, restorePrevious, savePiece, unpublishPiece } from "../../../../lib/motionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const piece = getPiece(gymId, params.id);
  if (!piece) return NextResponse.json({ ok: false, error: "No está en esta sede." }, { status: 404 });
  return NextResponse.json({ ok: true, piece });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* cuerpo vacío */ }
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const action = String(body.action || "guardar");
  try {
    if (action === "publicar") savePiece(gymId, params.id, body);
    const piece = action === "publicar"
      ? publishPiece(gymId, params.id, auth.nombre)
      : action === "despublicar"
        ? unpublishPiece(gymId, params.id)
        : action === "restaurar"
          ? restorePrevious(gymId, params.id)
          : savePiece(gymId, params.id, body);
    return NextResponse.json({ ok: true, piece });
  } catch (e: unknown) {
    const code = e instanceof Error ? e.message : "error";
    const status = code === "no_encontrado" ? 404 : 400;
    return NextResponse.json({ ok: false, error: messageOf(code) }, { status });
  }
}

function messageOf(code: string) {
  if (code === "nombre_requerido") return "Escribe el nombre del ejercicio.";
  if (code === "sin_movimiento") return "El cuerpo sigue de pie. Mueve las articulaciones y guarda al menos una pose distinta antes de publicar.";
  if (code === "no_encontrado") return "Este ejercicio ya no está en la sede.";
  if (code === "sin_historial") return "No hay una versión anterior.";
  return "No se pudo guardar.";
}
