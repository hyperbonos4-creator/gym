import { NextResponse } from "next/server";
import { guardGym } from "../../../../lib/authServer";
import { gymInstance } from "../../../../lib/gymsStore";
import { listSocios, updateSocio } from "../../../../lib/sociosStore";
import { waSendText } from "../../../../lib/evolution";
import { ensureAccessSubject } from "../../../../lib/accessBackend";
import { buildEnrollLink, enrollMessage } from "../../../../lib/enrollLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  const id = String(b?.id || "").trim();
  const gymId = String(b?.gym || "fuerza-elite");
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const socio = listSocios(gymId).find((s) => s.id === id);
  if (!socio) return NextResponse.json({ ok: false, error: "socio_no_encontrado" }, { status: 404 });

  const telE164 = socio.celular.length === 10 ? socio.codigoPais + socio.celular : socio.celular;
  try {
    await ensureAccessSubject(socio.id, socio.nombre, socio.docNumero);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "puerta_sin_ficha", detail: String(e?.message || e) }, { status: 502 });
  }
  const link = await buildEnrollLink(req, socio.id, socio.nombre);
  updateSocio(socio.id, { enrollLink: link });
  const wa = await waSendText(gymInstance(gymId), telE164, enrollMessage(socio.nombre, link));
  return NextResponse.json({ ok: true, link, wa });
}
