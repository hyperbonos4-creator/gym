import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { closeAssignmentsForTemplate } from "../../../../lib/routineAssignments";
import { appendExercise, deleteRoutine, getRoutine, openDraft, publishRoutine, saveDraft } from "../../../../lib/routinesStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const template = getRoutine(gymId, params.id);
  if (!template) return NextResponse.json({ ok: false, error: "No está en esta sede." }, { status: 404 });
  return NextResponse.json({ ok: true, template });
}

export async function PATCH(req: Request, { params }: Ctx) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const template = saveDraft(gymId, params.id, b);
    return NextResponse.json({ ok: true, template });
  } catch (e: any) {
    const code = String(e?.message || "");
    const error = code === "sin_borrador" ? "Esta versión ya está publicada. Abre una nueva para cambiarla." : code === "nombre_requerido" ? "Escribe el nombre de la plantilla." : "No se pudo guardar.";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: Ctx) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    if (b?.action === "publicar") return NextResponse.json({ ok: true, template: publishRoutine(gymId, params.id) });
    if (b?.action === "borrador") return NextResponse.json({ ok: true, template: openDraft(gymId, params.id) });
    if (b?.action === "anadir") {
      return NextResponse.json({ ok: true, template: appendExercise(gymId, params.id, String(b?.exerciseId || "")) });
    }
    if (b?.action === "eliminar") {
      closeAssignmentsForTemplate(gymId, params.id);
      deleteRoutine(gymId, params.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
  } catch (e: any) {
    const code = String(e?.message || "");
    const error = code === "borrador_vacio"
      ? "Publicar pide un nombre y al menos un ejercicio en un día de entrenamiento."
      : code === "sin_borrador"
        ? "No hay un borrador abierto. Entra a editar para crear la siguiente versión."
        : code === "sin_dia"
          ? "El borrador no tiene un día de entrenamiento."
          : code === "ejercicio_desconocido"
            ? "Ese ejercicio no está en el catálogo."
            : "No se pudo actualizar la plantilla.";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
}
