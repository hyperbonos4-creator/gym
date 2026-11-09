import { NextResponse } from "next/server";
import { ensureAccessSubject } from "../../../../lib/accessBackend";
import { getEnrollCode } from "../../../../lib/enrollCodes";
import { enrollRedirectUrl } from "../../../../lib/enrollLink";
import { getSocio } from "../../../../lib/sociosStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const rec = getEnrollCode(params.code);
  if (!rec) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 404 });
  }
  try {
    const socio = getSocio(rec.subjectId);
    await ensureAccessSubject(rec.subjectId, socio?.nombre || rec.name, socio?.docNumero);
    const url = await enrollRedirectUrl(rec);
    return NextResponse.json({ ok: true, url });
  } catch {
    return NextResponse.json({ ok: false, error: "backend" }, { status: 503 });
  }
}
