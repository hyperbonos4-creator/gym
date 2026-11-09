import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { listEvents, setDoorUntil } from "../../../lib/accessBackend";
import { enqueueDoorSync, flushDoorOutbox } from "../../../lib/doorOutbox";
import { listOwnerInvitations } from "../../../lib/invitations";
import {
  assignMembership,
  cancelMembership,
  currentMembership,
  doorSchedule,
  doorUntil,
  guestWallet,
  listMemberships,
  listPlans,
  markPaid,
  membershipSummary,
  previewMembership,
  renewalBoard,
  resumeMembership,
  suggestRenewal,
  suspendMembership,
  takeHolderEntries,
  ticketsNeedingDoor,
  markDoorPushed,
  type PayMethod,
} from "../../../lib/memberships";
import { recordServiceSale } from "../../../lib/retailStore";
import { getSocio, listSocios } from "../../../lib/sociosStore";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  MATCHED: "Entrada aprobada",
  UNKNOWN_SUBJECT: "No reconocida",
  NOT_AUTHORIZED: "Sin autorización",
  MEMBERSHIP_EXPIRED: "Acceso rechazado: membresía vencida",
  OUT_OF_SCHEDULE: "Fuera de horario",
  LIVENESS_FAILED: "Prueba de vida fallida",
  NO_CONSENT: "Sin consentimiento",
};

function methodOf(value: unknown): Exclude<PayMethod, "wompi"> {
  return value === "tarjeta" || value === "transferencia" ? value : "efectivo";
}

async function pushDoor(gymId: string, socioId: string, membershipId?: string, stamp?: string) {
  const current = currentMembership(gymId, socioId);
  const until = doorUntil(gymId, socioId);
  const schedule = current ? doorSchedule(current) : null;
  try {
    const points = await setDoorUntil(socioId, until, schedule);
    if (membershipId && stamp) markDoorPushed(gymId, membershipId, stamp);
    return { door: true, points };
  } catch (e: any) {
    enqueueDoorSync({
      gymId,
      socioId,
      membershipId,
      stamp,
      validUntil: until,
      schedule,
    });
    console.warn("[memberships] door sync queued", socioId, String(e?.message || e));
    return { door: false, points: 0 };
  }
}

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const socioId = new URL(req.url).searchParams.get("socio");
  const socios = listSocios(gymId);
  const ids = new Set(socios.map((s) => s.id));
  const events = await listEvents(80);
  const last = new Map<string, { at: string; ok: boolean; detail: string }>();
  for (const ev of events) {
    const id = String(ev?.subjectId || "");
    if (!ids.has(id)) continue;
    if (String(ev.reason || "") === "DEMO") continue;
    const at = String(ev.recordedAt || ev.recorded_at || "");
    const prev = last.get(id);
    if (prev && Date.parse(prev.at) >= Date.parse(at || "0")) continue;
    last.set(id, {
      at,
      ok: String(ev.decision || "").toUpperCase() === "GRANTED",
      detail: REASON[String(ev.reason || "")] || "Acceso",
    });
  }
  takeHolderEntries(gymId, events);
  const pendingDoor = ticketsNeedingDoor(gymId);
  for (const row of pendingDoor) {
    await pushDoor(gymId, row.socioId, row.id, row.stamp);
  }
  // Reintentos de outbox pendientes
  await flushDoorOutbox(10);

  const history = listMemberships(gymId);
  const items = socios.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    docTipo: s.docTipo,
    docNumero: s.docNumero,
    celular: s.celular || "",
    codigoPais: s.codigoPais || "",
    estado: s.estado,
    membresia: currentMembership(gymId, s.id),
    pase: (() => {
      const w = guestWallet(gymId, s.id);
      if (!w.until) return null;
      return { planName: w.spend?.planName || "Pase de invitados", creditsLeft: w.left, creditsTotal: w.total, endsOn: w.until, live: "activa" as const };
    })(),
    invitados: listOwnerInvitations(gymId, s.id).slice(0, 8).map((r) => ({
      id: r.id,
      guestName: r.guestName,
      guestDoc: r.guestDoc,
      status: r.status,
      entryVia: r.entryVia || null,
      usedAt: r.usedAt || null,
      enrolledAt: r.enrolledAt || null,
      ownerName: r.ownerName,
      creditsLeftAfter: r.creditsLeftAfter ?? null,
    })),
    historial: history.filter((m) => m.socioId === s.id),
    sugerencia: suggestRenewal(gymId, s.id),
    ultimoAcceso: last.get(s.id) || null,
  }));
  return NextResponse.json({
    plans: listPlans(gymId).filter((p) => p.active),
    items: socioId ? items.filter((s) => s.id === socioId) : items,
    history,
    summary: membershipSummary(gymId),
    bandeja: renewalBoard(gymId),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  if (body.action === "preview") {
    try {
      return NextResponse.json({ ok: true, preview: previewMembership(gymId, String(body.socioId || ""), String(body.planId || "")) });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || "no_se_pudo" }, { status: 400 });
    }
  }
  const socioId = String(body.socioId || "");
  const socio = getSocio(socioId);
  if (!socio || socio.gymId !== gymId || socio.deletedAt) {
    return NextResponse.json({ ok: false, error: "socio_no_encontrado" }, { status: 404 });
  }
  const action = String(body.action || "assign");
  try {
    let sale = null;
    let membership = null;
    if (action === "anular" || action === "cancel") {
      const reason = String(body.reason || "").trim();
      if (reason.length < 3) return NextResponse.json({ ok: false, error: "motivo_corto" }, { status: 400 });
      membership = cancelMembership(gymId, socioId, reason);
    } else if (action === "suspender") {
      membership = suspendMembership(gymId, socioId);
    } else if (action === "reactivar") {
      membership = resumeMembership(gymId, socioId);
    } else if (action === "cobrar") {
      const current = currentMembership(gymId, socioId);
      if (!current || current.payState !== "pendiente") {
        return NextResponse.json({ ok: false, error: "no_esta_pendiente" }, { status: 400 });
      }
      const method = methodOf(body.method);
      sale = recordServiceSale({
        gymId,
        cashier: auth.nombre,
        name: `${current.planName} · ${socio.nombre}`,
        amount: current.price,
        method,
        note: `membresia ${socioId}`,
      });
      membership = markPaid(gymId, current.id, method);
    } else {
      const plan = listPlans(gymId).find((p) => p.id === String(body.planId || ""));
      if (!plan) return NextResponse.json({ ok: false, error: "plan_no_disponible" }, { status: 400 });
      const pending = body.pay === "pendiente" || body.charge === false;
      const method = methodOf(body.method);
      if (!pending) {
        sale = recordServiceSale({
          gymId,
          cashier: auth.nombre,
          name: `${plan.name} · ${socio.nombre}`,
          amount: plan.price,
          method,
          note: `membresia ${socioId}`,
        });
      }
      membership = assignMembership(gymId, socioId, plan.id, {
        payState: pending ? "pendiente" : "pagada",
        method: pending ? null : method,
      });
    }
    let door = true;
    let points = 0;
    if (action !== "cobrar") {
      const pushed = await pushDoor(gymId, socioId, membership?.id, membership ? `${membership.live}|${membership.creditsLeft ?? 0}|${membership.validUntil}` : undefined);
      door = pushed.door;
      points = pushed.points;
    }
    return NextResponse.json({ ok: true, membership, door, points, sale });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "no_se_pudo" }, { status: 400 });
  }
}
