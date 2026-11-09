import { NextResponse } from "next/server";
import { claimInvitation, markFaceUsed, unclaimInvitation } from "../../../../lib/invitations";
import { guestWallet } from "../../../../lib/memberships";
import { accessApi, doorTestOpen, listEvents, listPoints, setDoorUntil } from "../../../../lib/accessBackend";

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").replace(/\s/g, "");
  if (!code) return NextResponse.json({ ok: false, error: "Escribe el PIN." }, { status: 400 });

  await reconcile().catch(() => undefined);

  const points = await listPoints();
  const relay = points.find((p) => String(p?.controllerKind || "").toUpperCase() === "RELAY" && p?.id);
  if (!relay?.id) {
    return NextResponse.json({
      ok: false,
      error: "Esta sede no tiene torniquete conectado. Ningún código abre la puerta.",
    }, { status: 409 });
  }

  const claimed = claimInvitation(code);
  if (claimed === "missing") return NextResponse.json({ ok: false, error: "Ese código no existe." }, { status: 404 });
  if (claimed === "used") return NextResponse.json({ ok: false, error: "Ese ingreso ya se usó." }, { status: 409 });
  if (claimed === "expired") return NextResponse.json({ ok: false, error: "Ese ingreso ya venció." }, { status: 409 });

  try {
    await doorTestOpen(relay.id);
  } catch {
    unclaimInvitation(claimed.id);
    return NextResponse.json({
      ok: false,
      error: "La puerta no aceptó el ingreso. El código sigue vigente.",
    }, { status: 502 });
  }

  if (claimed.subjectId) {
    try {
      await setDoorUntil(claimed.subjectId, new Date(Date.now() - 1000).toISOString());
      await accessApi("PATCH", `/access/subjects/${claimed.subjectId}`, { status: "DISABLED" });
    } catch {
      /* el cupo ya quedó usado */
    }
  }

  const wallet = guestWallet(claimed.gymId, claimed.ownerSocioId);
  return NextResponse.json({
    ok: true,
    guestName: claimed.guestName,
    guestDoc: claimed.guestDoc,
    ownerName: claimed.ownerName,
    left: claimed.creditsLeftAfter ?? wallet.left,
    total: wallet.total,
    via: claimed.entryVia,
  });
}
