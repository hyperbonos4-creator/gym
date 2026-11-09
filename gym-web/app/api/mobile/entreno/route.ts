import { NextResponse } from "next/server";
import { socioFromMobileRequest } from "../../../../lib/mobileSession";
import { programForSocio } from "../../../../lib/routineProgram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Solo la rutina vigente. Los envíos sueltos anteriores no salen en la app. */
export async function GET(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  const program = programForSocio(session.gymId, session.socio.id);
  const today = program && "items" in program ? program.items : [];
  return NextResponse.json({ ok: true, items: today, program });
}
