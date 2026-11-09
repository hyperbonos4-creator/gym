import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { getFacturacionSede, saveFacturacionSede } from "../../../../lib/facturacionSede";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, sede: getFacturacionSede(gymId) });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const sede = saveFacturacionSede(gymId, {
    enabled: Boolean(body.enabled),
    nit: String(body.nit || ""),
  });
  return NextResponse.json({ ok: true, sede });
}
