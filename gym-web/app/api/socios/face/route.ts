import { NextResponse } from "next/server";
import { guardGym } from "../../../../lib/authServer";
import { getSocio, updateSocio } from "../../../../lib/sociosStore";
import { resetFaceForReenroll } from "../../../../lib/accessBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Borra solo el rostro. La ficha, pagos y membresías se quedan. */
export async function DELETE(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  const id = String(b?.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id_requerido" }, { status: 400 });
  const socio = getSocio(id);
  if (!socio || socio.deletedAt) {
    return NextResponse.json({ ok: false, error: "cliente_no_encontrado" }, { status: 404 });
  }
  const auth = guardGym(req, socio.gymId || "fuerza-elite");
  if (auth instanceof NextResponse) return auth;
  try {
    await resetFaceForReenroll(id);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
  updateSocio(id, { estado: "pendiente_enrolamiento" });
  return NextResponse.json({ ok: true });
}
