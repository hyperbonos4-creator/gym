import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { listEvents } from "../../../../lib/accessBackend";
import { listMemberships } from "../../../../lib/memberships";
import { listOwnerInvitations } from "../../../../lib/invitations";
import { getSocio } from "../../../../lib/sociosStore";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  MATCHED: "Identidad verificada",
  UNKNOWN_SUBJECT: "Rostro no reconocido",
  NOT_AUTHORIZED: "Sin autorización en la sede",
  MEMBERSHIP_EXPIRED: "Membresía vencida o sin plan",
  OUT_OF_SCHEDULE: "Fuera del horario del plan",
  LIVENESS_FAILED: "Prueba de vida no superada",
  CHALLENGE_REQUIRED: "Faltó el reto de vida",
  NO_CONSENT: "Sin consentimiento biométrico",
  MANUAL: "Apertura manual",
  DEMO: "Demostración de portería",
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const id = new URL(req.url).searchParams.get("id") || "";
  const socio = getSocio(id);
  if (!socio || socio.gymId !== gymId) return NextResponse.json({ ok: false }, { status: 404 });

  const events = await listEvents(500, id);
  const accesos = events
    .filter((ev) => String(ev.subjectId || ev.subject_id || "") === id)
    .map((ev) => {
      const reason = String(ev.reason || "");
      const decision = String(ev.decision || "").toUpperCase();
      return {
        id: String(ev.id || ""),
        at: ev.recordedAt || ev.recorded_at || null,
        ok: reason !== "DEMO" && decision === "GRANTED",
        decision,
        reason,
        detail: REASON[reason] || "Intento de acceso",
        match: num(ev.matchScore ?? ev.match_score),
        liveness: num(ev.livenessScore ?? ev.liveness_score),
        livenessMode: ev.livenessMode || ev.liveness_mode || null,
        door: Boolean(ev.doorActuated ?? ev.door_actuated),
      };
    });

  const membresias = listMemberships(gymId)
    .filter((m) => m.socioId === id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((m) => ({
      id: m.id,
      planName: m.planName,
      kind: m.kind || "membresia",
      startsOn: m.startsOn,
      endsOn: m.endsOn,
      live: m.live,
      createdAt: m.createdAt,
      price: m.price,
      method: m.method || null,
      payState: m.payState || null,
      cancelReason: m.cancelReason || null,
      creditsTotal: m.creditsTotal ?? null,
      creditsLeft: m.creditsLeft ?? null,
    }));

  const invitaciones = listOwnerInvitations(gymId, id).map((r) => ({
    id: r.id,
    guestName: r.guestName,
    guestDoc: r.guestDoc,
    status: r.status,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    enrolledAt: r.enrolledAt || null,
    usedAt: r.usedAt || null,
    entryVia: r.entryVia || null,
    creditsLeftAfter: r.creditsLeftAfter ?? null,
    settled: Boolean(r.settled),
  }));

  return NextResponse.json({
    ok: true,
    socio: {
      id: socio.id,
      nombre: socio.nombre,
      docTipo: socio.docTipo,
      docNumero: socio.docNumero,
      codigoPais: socio.codigoPais,
      celular: socio.celular,
    },
    accesos,
    membresias,
    invitaciones,
  });
}
