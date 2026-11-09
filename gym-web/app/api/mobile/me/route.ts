import { NextResponse } from "next/server";
import { socioFromMobileRequest } from "../../../../lib/mobileSession";
import { currentMembership, doorSchedule, doorUntil, guestWallet, markDoorPushed, takeHolderEntries, ticketsNeedingDoor } from "../../../../lib/memberships";
import { listOwnerInvitations, markFaceUsed, openHolds } from "../../../../lib/invitations";
import { confirmGuestRegistrations } from "../../../../lib/guestRegistry";
import { listEvents, setDoorUntil } from "../../../../lib/accessBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function reconcile() {
  const events = await listEvents(200);
  const ids = new Set<string>();
  for (const ev of events) {
    const decision = String(ev?.decision || "").toUpperCase();
    const reason = String(ev?.reason || "").toUpperCase();
    const sid = ev?.subjectId || ev?.subject_id;
    if (decision === "GRANTED" && reason === "MATCHED" && sid) ids.add(String(sid));
  }
  markFaceUsed(ids, new Date().toISOString());
}

export async function GET(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  const events = await listEvents(200).catch(() => []);
  await reconcile().catch(() => undefined);
  await confirmGuestRegistrations().catch(() => undefined);
  takeHolderEntries(session.gymId, events);
  for (const row of ticketsNeedingDoor(session.gymId)) {
    try {
      const current = currentMembership(session.gymId, row.socioId);
      await setDoorUntil(row.socioId, doorUntil(session.gymId, row.socioId), current ? doorSchedule(current) : null);
      markDoorPushed(session.gymId, row.id, row.stamp);
    } catch {
      /* se reintenta en la siguiente consulta */
    }
  }
  const wallet = guestWallet(session.gymId, session.socio.id);
  const apartados = openHolds(session.gymId, session.socio.id);
  const acceso = currentMembership(session.gymId, session.socio.id);
  const invitations = listOwnerInvitations(session.gymId, session.socio.id).map((row) => ({
    id: row.id,
    guestName: row.guestName,
    guestDoc: row.guestDoc,
    status: row.status,
    createdAt: row.createdAt,
    usedAt: row.usedAt || null,
    entryVia: row.entryVia || null,
    ownerName: row.ownerName,
    creditsLeftAfter: row.creditsLeftAfter ?? null,
    enrolledAt: row.enrolledAt || null,
    pin: row.status === "pending" ? row.pin : null,
    enrollUrl: row.status === "pending" ? row.enrollUrl || "" : "",
  }));
  return NextResponse.json({
    ok: true,
    ownerName: session.socio.nombre,
    doc: session.socio.docNumero,
    left: wallet.left,
    disponibles: Math.max(0, wallet.left - apartados),
    apartados,
    total: wallet.total,
    until: wallet.until,
    acceso: acceso ? {
      planName: acceso.planName,
      live: acceso.live,
      endsOn: acceso.endsOn,
      days: acceso.days,
    } : null,
    invitations,
  });
}
