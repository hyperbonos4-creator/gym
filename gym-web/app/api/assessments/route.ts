import { NextResponse } from "next/server";
import { createAssessment, listAssessments } from "../../../lib/assessments";
import type { AssessmentKind } from "../../../lib/assessmentTypes";
import { guardGym, gymFromQuery } from "../../../lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERROR: Record<string, string> = {
  socio_no_encontrado: "Ese cliente no está en esta sede.",
};

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const socioId = new URL(req.url).searchParams.get("socio") || "";
  const items = listAssessments(gymId).filter((row) => !socioId || row.socioId === socioId);
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  let body: { gym?: string; socioId?: string; kind?: AssessmentKind } = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const item = createAssessment({ gymId, socioId: String(body.socioId || ""), kind: body.kind, by: auth.nombre });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    return NextResponse.json({ ok: false, error: ERROR[code] || "No se pudo abrir la valoración." }, { status: 400 });
  }
}
