import { NextResponse } from "next/server";
import { socioFromMobileRequest } from "../../../../lib/mobileSession";
import { guestWallet } from "../../../../lib/memberships";
import { attachGuestSubject, cancelInvitation, createInvitation, openHolds } from "../../../../lib/invitations";
import { buildEnrollLink } from "../../../../lib/enrollLink";
import { createSubject, grantConsent, setDoorUntil } from "../../../../lib/accessBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { socio, gymId } = session;

  if (body.action === "cancel") {
    const row = cancelInvitation(gymId, socio.id, String(body.id || ""));
    if (!row) return NextResponse.json({ ok: false, error: "Esa invitación no está en tu pase." }, { status: 404 });
    if (row.status !== "cancelled") return NextResponse.json({ ok: false, error: "Ese ingreso ya no se puede anular." }, { status: 409 });
    const wallet = guestWallet(gymId, socio.id);
    return NextResponse.json({ ok: true, left: wallet.left, total: wallet.total });
  }

  const wallet = guestWallet(gymId, socio.id);
  const apartados = openHolds(gymId, socio.id);
  if (!wallet.until) return NextResponse.json({ ok: false, error: "No tienes un pase de invitados vigente." }, { status: 409 });
  if (!wallet.spend || wallet.left - apartados < 1) return NextResponse.json({ ok: false, error: "El pase no tiene invitaciones disponibles." }, { status: 409 });

  let row;
  try {
    row = createInvitation({
      gymId,
      ownerSocioId: socio.id,
      ownerName: socio.nombre,
      guestName: String(body.guestName || ""),
      guestDoc: String(body.guestDoc || ""),
      expiresAt: wallet.spend.validUntil,
    });
  } catch (e: any) {
    const code = String(e?.message || "");
    const error = code === "nombre_invitado"
      ? "Escribe el nombre del invitado."
      : code === "documento_invitado"
        ? "Escribe el documento del invitado."
        : code === "sin_creditos" || code === "sin_pase"
          ? "El pase no tiene invitaciones disponibles."
          : "No se pudo crear la invitación.";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }

  let enrollUrl = "";
  try {
    const subject = await createSubject(`${row.guestName} · invitado de ${socio.nombre}`.slice(0, 160), `guest:${row.id}`);
    const subjectId = String(subject?.id || "");
    if (subjectId) {
      await grantConsent(subjectId);
      await setDoorUntil(subjectId, row.expiresAt);
      enrollUrl = await buildEnrollLink(req, subjectId, row.guestName);
      attachGuestSubject(row.id, subjectId, enrollUrl);
    }
  } catch {
    enrollUrl = "";
  }
  if (!enrollUrl) {
    cancelInvitation(gymId, socio.id, row.id);
    return NextResponse.json({ ok: false, error: "No se pudo preparar el enlace de registro. No se descontó el ingreso." }, { status: 503 });
  }

  const next = guestWallet(gymId, socio.id);
  const holds = openHolds(gymId, socio.id);
  return NextResponse.json({
    ok: true,
    id: row.id,
    guestName: row.guestName,
    guestDoc: row.guestDoc,
    ownerName: socio.nombre,
    pin: row.pin,
    enrollUrl,
    left: next.left,
    disponibles: Math.max(0, next.left - holds),
    apartados: holds,
    total: next.total,
    until: next.until,
  });
}
