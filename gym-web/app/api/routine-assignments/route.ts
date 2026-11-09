import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import {
  assignRoutine,
  closeAssignment,
  listAssignments,
  presentAssignment,
  updateAssignmentVersion,
} from "../../../lib/routineAssignments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR: Record<string, string> = {
  fecha_invalida: "Elige la fecha de inicio.",
  socio_no_encontrado: "Ese socio no está en esta sede.",
  sin_version_publicada: "Publica la rutina antes de asignarla.",
  asignacion_no_encontrada: "Esa asignación no está en esta sede.",
  asignacion_cerrada: "Esa asignación ya está cerrada.",
  ya_actualizada: "Esa asignación ya usa la última versión publicada.",
};

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const templateId = new URL(req.url).searchParams.get("template") || "";
  const items = listAssignments(gymId)
    .filter((row) => !templateId || row.templateId === templateId)
    .map(presentAssignment);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const gymId = String(body?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    if (body?.action === "cerrar") {
      return NextResponse.json({ ok: true, assignment: presentAssignment(closeAssignment(gymId, String(body?.id || ""))) });
    }
    if (body?.action === "actualizar") {
      return NextResponse.json({ ok: true, assignment: presentAssignment(updateAssignmentVersion(gymId, String(body?.id || ""))) });
    }
    const assignment = assignRoutine({
      gymId,
      socioId: String(body?.socioId || ""),
      templateId: String(body?.templateId || ""),
      startDate: String(body?.startDate || ""),
      note: String(body?.note || ""),
      by: auth.nombre,
    });
    return NextResponse.json({ ok: true, assignment: presentAssignment(assignment) });
  } catch (error: any) {
    const code = String(error?.message || "");
    return NextResponse.json({ ok: false, error: ERROR[code] || "No se pudo asignar la rutina." }, { status: 400 });
  }
}
