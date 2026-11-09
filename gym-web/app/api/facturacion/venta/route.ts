import { NextResponse } from "next/server";
import { guardGym } from "../../../../lib/authServer";
import { attachSaleDian } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const gymId = String(body.gym || "");
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const sale = attachSaleDian(gymId, String(body.saleId || ""), {
      cufe: String(body.cufe || ""),
      consecutivo: String(body.consecutivo || ""),
    });
    return NextResponse.json({ ok: true, sale });
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo marcar la venta.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
