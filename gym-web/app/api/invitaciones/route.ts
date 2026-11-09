import { NextResponse } from "next/server";
import { findSocioByDoc } from "../../../lib/sociosStore";
import { guestWallet } from "../../../lib/memberships";
import {
  attachGuestSubject,
  cancelInvitation,
  createInvitation,
  listOwnerInvitations,
  markFaceUsed,
} from "../../../lib/invitations";
import { buildEnrollLink } from "../../../lib/enrollLink";
import { createSubject, grantConsent, listEvents, setDoorUntil } from "../../../lib/accessBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function samePhone(stored: string, given: string) {
  const a = String(stored || "").replace(/\D/g, "");
  const b = String(given || "").replace(/\D/g, "");
  return a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10);
}

function ownerOf(gymId: string, doc: string, phone: string) {
  const socio = findSocioByDoc(gymId, doc.trim());
  if (!socio || socio.deletedAt || !samePhone(socio.celular, phone)) return null;
  return socio;
}

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

function publicRow(row: { status: string; pin: string; guestName: string; guestDoc: string; createdAt: string; usedAt?: string | null; entryVia?: string | null; id: string; ownerName: string; creditsLeftAfter?: number | null }) {
  return {
    id: row.id,
    guestName: row.guestName,
    guestDoc: row.guestDoc,
    status: row.status,
    createdAt: row.createdAt,
    usedAt: row.usedAt || null,
    entryVia: row.entryVia || null,
    ownerName: row.ownerName,
    creditsLeftAfter: row.creditsLeftAfter ?? null,
    pin: row.status === "pending" ? row.pin : null,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gymId = url.searchParams.get("gym") || "fuerza-elite";
  const socio = ownerOf(gymId, url.searchParams.get("doc") || "", url.searchParams.get("phone") || "");
  if (!socio) return NextResponse.json({ ok: false, error: "El documento y el WhatsApp no coinciden con un titular." }, { status: 401 });
  await reconcile().catch(() => undefined);
  const wallet = guestWallet(gymId, socio.id);
  const invitations = listOwnerInvitations(gymId, socio.id).map(publicRow);
  return NextResponse.json({
    ok: true,
    ownerName: socio.nombre,
    left: wallet.left,
    total: wallet.total,
    until: wallet.until,
    invitations,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || "fuerza-elite");
  const socio = ownerOf(gymId, String(body.doc || ""), String(body.phone || ""));
  if (!socio) return NextResponse.json({ ok: false, error: "El documento y el WhatsApp no coinciden con un titular." }, { status: 401 });

  if (body.action === "cancel") {
    const row = cancelInvitation(gymId, socio.id, String(body.id || ""));
    if (!row) return NextResponse.json({ ok: false, error: "Esa invitación no está en tu pase." }, { status: 404 });
    if (row.status !== "cancelled") return NextResponse.json({ ok: false, error: "Ese ingreso ya no se puede anular." }, { status: 409 });
    const wallet = guestWallet(gymId, socio.id);
    return NextResponse.json({ ok: true, left: wallet.left, total: wallet.total });
  }

  const wallet = guestWallet(gymId, socio.id);
  if (!wallet.until) return NextResponse.json({ ok: false, error: "No tienes un pase de invitados vigente." }, { status: 409 });
  if (!wallet.spend) return NextResponse.json({ ok: false, error: "El pase no tiene invitaciones disponibles." }, { status: 409 });

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
  return NextResponse.json({
    ok: true,
    id: row.id,
    guestName: row.guestName,
    guestDoc: row.guestDoc,
    ownerName: socio.nombre,
    pin: row.pin,
    enrollUrl,
    left: next.left,
    total: next.total,
    until: next.until,
  });
}
