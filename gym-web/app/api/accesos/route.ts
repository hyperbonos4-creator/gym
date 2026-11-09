import { NextResponse } from "next/server";
import { accessScope, eventBelongsToGym } from "../../../lib/accessScope";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { listEvents, listPoints } from "../../../lib/accessBackend";
import { accessStory } from "../../../lib/accessCopy";
import { listGymInvitations } from "../../../lib/invitations";
import { listMemberships } from "../../../lib/memberships";
import { listSocios } from "../../../lib/sociosStore";

export const dynamic = "force-dynamic";

const TOPE = 2000;

function diaBogota(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

function horaBogota(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function pct(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n <= 1 ? n * 100 : n);
}

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;

  const scope = accessScope(gymId);
  const [events, points] = await Promise.all([listEvents(TOPE), listPoints().catch(() => [])]);
  const socios = listSocios(gymId);
  const byId = new Map(socios.map((s) => [s.id, s]));
  const invites = listGymInvitations(gymId);
  const bySubject = new Map(invites.filter((i) => i.subjectId).map((i) => [i.subjectId as string, i]));
  const memberships = listMemberships(gymId);
  const doorName = new Map(points.map((p) => [p.id, p.name || "Puerta"]));

  const rows = events.filter((ev) => eventBelongsToGym(ev, scope)).flatMap((ev) => {
    const when = ev.recordedAt || ev.recorded_at;
    if (!when) return [];
    const at = new Date(when).toISOString();
    const day = diaBogota(at);
    const subjectId = (ev.subjectId || ev.subject_id || null) as string | null;
    const reason = String(ev.reason || "");
    const demo = reason === "DEMO";
    const ok = !demo && String(ev.decision || "").toUpperCase() === "GRANTED";
    const story = accessStory(reason, ok);
    const door = ev.doorActuated === true || ev.door_actuated === true;
    const socio = subjectId ? byId.get(subjectId) : undefined;
    const invite = subjectId ? bySubject.get(subjectId) : undefined;
    const manual = reason === "MANUAL";
    const vigente = (socioId: string | null | undefined) => socioId
      ? memberships
          .filter((m) => m.socioId === socioId && m.status !== "cancelada" && m.startsOn <= day && m.endsOn >= day)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0]
      : undefined;
    const cubre = vigente(subjectId);
    const delAnfitrion = !cubre ? vigente(invite?.ownerSocioId) : undefined;
    const planRow = cubre || delAnfitrion;
    let quien: "cliente" | "invitado" | "desconocido" | "prueba" | "reconocido" = "desconocido";
    if (manual) quien = "prueba";
    else if (invite || socio?.rol === "invitado") quien = "invitado";
    else if (socio) quien = "cliente";
    else if (subjectId) quien = "reconocido";
    return [{
      id: String(ev.id || at),
      at,
      dia: day,
      hora: horaBogota(at),
      subjectId,
      nombre: manual
        ? "Prueba de acceso"
        : invite?.guestName || socio?.nombre || (subjectId ? "Persona reconocida" : "Persona no reconocida"),
      documento: invite?.guestDoc || (socio ? `${socio.docTipo} ${socio.docNumero}` : ""),
      quien,
      invitadoDe: invite?.ownerName || null,
      plan: planRow?.planName || null,
      planTipo: planRow ? (planRow.kind === "tiquetera" ? "Tiquetera" : "Membresía") : null,
      planDe: cubre ? "propio" : delAnfitrion ? "anfitrion" : null,
      decision: demo ? "DEMO" : ok ? "GRANTED" : "DENIED",
      reason,
      title: story.title,
      why: story.why,
      match: pct(ev.matchScore ?? ev.match_score),
      liveness: pct(ev.livenessScore ?? ev.liveness_score),
      livenessMode: String(ev.livenessMode || ev.liveness_mode || ""),
      puerta: doorName.get(String(ev.accessPointId || ev.access_point_id || "")) || "Puerta",
      door,
      origen: demo ? "demostracion" : manual ? (door ? "panel" : "panel_sin_confirmacion") : door ? "rostro" : "ninguno",
      emergencia: "sin_senal" as const,
    }];
  });

  return NextResponse.json({
    ok: true,
    tope: TOPE,
    guardados: rows.length,
    rows,
  });
}
