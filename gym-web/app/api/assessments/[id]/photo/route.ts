import { NextResponse } from "next/server";
import { addPhoto, readPhoto } from "../../../../../lib/assessments";
import type { PhotoView } from "../../../../../lib/assessmentTypes";
import { guardGym, gymFromQuery } from "../../../../../lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR: Record<string, string> = {
  valoracion_no_encontrada: "Esa valoración no está en esta sede.",
  valoracion_cerrada: "Una valoración cerrada no admite fotos nuevas.",
  archivo_invalido: "Usa una imagen JPG, PNG o WebP de hasta 4 MB.",
  sin_consentimiento: "Primero registra el consentimiento para el seguimiento privado.",
};

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const photoId = new URL(req.url).searchParams.get("photo") || "";
  const file = readPhoto(gymId, params.id, photoId);
  if (!file) return NextResponse.json({ ok: false, error: "No está esa fotografía." }, { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.type,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const gymId = url.searchParams.get("gym") || gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: ERROR.archivo_invalido }, { status: 400 });
  const view = String(form.get("view") || "frontal") as PhotoView;
  try {
    const item = addPhoto(gymId, params.id, {
      view,
      note: String(form.get("note") || ""),
      mime: file.type,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ ok: false, error: ERROR[code] || "No se pudo guardar la fotografía." }, { status: 400 });
  }
}
