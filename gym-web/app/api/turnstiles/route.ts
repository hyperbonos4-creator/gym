import { NextResponse } from "next/server";
import { accessScope, eventBelongsToGym } from "../../../lib/accessScope";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { clearTurnstileController, createPoint, listEvents, listPoints, setTurnstileController, visionHealth } from "../../../lib/accessBackend";
import { listSocios } from "../../../lib/sociosStore";
import { accessStory } from "../../../lib/accessCopy";
import { forgetTurnstile, listTurnstiles, markSynced, saveTurnstile, unassignedSeen } from "../../../lib/turnstiles";

export const dynamic = "force-dynamic";

function publicDevice(row: ReturnType<typeof listTurnstiles>[number]) {
  const { token, keyInvalidAt, ...rest } = row;
  return {
    ...rest,
    hasToken: token.length >= 8,
    keyInvalid: Boolean(keyInvalidAt),
  };
}

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const [points, events, vision] = await Promise.all([
    listPoints(),
    listEvents(120),
    visionHealth().catch(() => ({ ok: false })),
  ]);
  const scope = accessScope(gymId);
  const names = new Map(listSocios(gymId).map((s) => [s.id, s.nombre]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const activity = events.filter((ev) => eventBelongsToGym(ev, scope)).map((ev) => {
    const when = ev.recordedAt || ev.recorded_at;
    const reason = String(ev.reason || "");
    const ok = reason !== "DEMO" && String(ev.decision || "").toUpperCase() === "GRANTED";
    const subjectId = ev.subjectId as string | null;
    const story = accessStory(reason, ok);
    return {
      at: when ? new Date(when).toISOString() : null,
      name: reason === "MANUAL" ? "Prueba de acceso" : subjectId ? names.get(subjectId) || "Socio" : "Persona no reconocida",
      subjectId: subjectId || null,
      ok,
      reason,
      title: story.title,
      why: story.why,
      kind: story.kind,
    };
  }).filter((row) => row.at);
  const hoy = activity.filter((row) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.at!)) === today);
  return NextResponse.json({
    devices: listTurnstiles(gymId).map(publicDevice),
    seen: unassignedSeen(),
    points: points
      .filter((p) => scope.ownDoors.has(String(p.id)) || !scope.foreignDoors.has(String(p.id)))
      .map((p) => ({ id: p.id, name: p.name, kind: p.controllerKind || "NONE" })),
    activity: activity.slice(0, 80),
    today: {
      total: hoy.filter((r) => r.reason !== "DEMO").length,
      granted: hoy.filter((r) => r.ok).length,
      denied: hoy.filter((r) => r.reason !== "DEMO" && !r.ok).length,
    },
    recognition: !!vision.ok,
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  if (body.action === "create-door") {
    const name = String(body.name || "").trim();
    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ ok: false, error: "nombre" }, { status: 400 });
    }
    try {
      const point = await createPoint(name);
      return NextResponse.json({
        ok: true,
        point: { id: point.id, name: point.name, kind: point.controllerKind || "NONE" },
      });
    } catch {
      return NextResponse.json({ ok: false, error: "backend" }, { status: 502 });
    }
  }
  if (body.action === "forget") {
    const id = String(body.id || "").toUpperCase();
    const row = listTurnstiles(gymId).find((d) => d.id === id);
    forgetTurnstile(gymId, id);
    if (row?.pointId) {
      try {
        await clearTurnstileController(row.pointId);
      } catch {
        return NextResponse.json({ ok: true, door: false });
      }
    }
    return NextResponse.json({ ok: true, door: true });
  }
  const id = String(body.id || "").trim().toUpperCase();
  const token = String(body.token || "");
  const name = String(body.name || "").trim();
  if (id.length < 8 || token.length < 8 || name.length < 2) {
    return NextResponse.json({ ok: false, error: "datos" }, { status: 400 });
  }
  const row = saveTurnstile({
    id,
    gymId,
    name,
    token,
    pointId: body.pointId ? String(body.pointId) : null,
    ssid: String(body.ssid || ""),
    ip: body.ip ? String(body.ip) : null,
    fw: body.fw ? String(body.fw) : null,
  });
  let door = false;
  if (row.pointId && row.lastIp) {
    try {
      await setTurnstileController(row.pointId, row.lastIp, row.token);
      markSynced(row.id, row.lastIp);
      door = true;
    } catch {
      door = false;
    }
  }
  return NextResponse.json({ ok: true, device: publicDevice(row), door });
}
