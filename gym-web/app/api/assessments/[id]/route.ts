import { NextResponse } from "next/server";
import { deleteDraft, getAssessment, updateAssessment } from "../../../../lib/assessments";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR: Record<string, string> = {
  valoracion_no_encontrada: "Esa valoración no está en esta sede.",
  valoracion_cerrada: "Una valoración cerrada no se modifica. Abre un seguimiento nuevo.",
  fecha_invalida: "Revisa la fecha.",
  medida_invalida: "Hay una medida fuera de rango.",
  sin_cribado: "Confirma la revisión de preparación antes de cerrar.",
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const item = getAssessment(gymId, params.id);
  if (!item) return NextResponse.json({ ok: false, error: ERROR.valoracion_no_encontrada }, { status: 404 });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const item = updateAssessment(gymId, params.id, body);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ ok: false, error: ERROR[code] || "No se pudo guardar." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    deleteDraft(gymId, params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ ok: false, error: ERROR[code] || "No se pudo descartar el borrador." }, { status: 400 });
  }
}
