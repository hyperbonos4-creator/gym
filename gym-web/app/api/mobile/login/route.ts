import { NextResponse } from "next/server";
import { loginMobile } from "../../../../lib/mobileSession";
import { guestWallet } from "../../../../lib/memberships";
import { openHolds } from "../../../../lib/invitations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || "fuerza-elite");
  const session = loginMobile(gymId, String(body.doc || ""), String(body.phone || ""));
  if (!session) {
    return NextResponse.json({ ok: false, error: "El documento y el WhatsApp no coinciden con un titular." }, { status: 401 });
  }
  const wallet = guestWallet(gymId, session.socio.id);
  const apartados = openHolds(gymId, session.socio.id);
  return NextResponse.json({
    ok: true,
    token: session.token,
    ownerName: session.socio.nombre,
    doc: session.socio.docNumero,
    left: wallet.left,
    disponibles: Math.max(0, wallet.left - apartados),
    apartados,
    total: wallet.total,
    until: wallet.until,
  });
}
