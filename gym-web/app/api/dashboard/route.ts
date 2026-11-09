import { NextResponse } from "next/server";
import { accessScope, eventBelongsToGym } from "../../../lib/accessScope";
import { gymFromQuery, guardGym } from "../../../lib/authServer";
import { listSocios } from "../../../lib/sociosStore";
import { daySummary, listRestock, listSales } from "../../../lib/retailStore";
import { accessCoverage, currentMembership, renewalBoard } from "../../../lib/memberships";
import { gymInstance } from "../../../lib/gymsStore";
import { waStatus } from "../../../lib/evolution";
import { backendUp, listEvents, listPoints, visionHealth } from "../../../lib/accessBackend";
import { accessStory } from "../../../lib/accessCopy";
import { listTurnstiles } from "../../../lib/turnstiles";

export const dynamic = "force-dynamic";

function bogota(iso: string | Date) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;

  const socios = listSocios(gymId);
  const enrolados = socios.filter((s) => s.estado === "enrolado").length;
  const pendientes = socios.length - enrolados;
  const summary = daySummary(gymId);
  const restock = listRestock(gymId);
  const sales = listSales(gymId, summary.day);

  const [up, vision, points, rawEvents] = await Promise.all([
    backendUp(),
    visionHealth().catch(() => ({ ok: false })),
    listPoints().catch(() => [] as any[]),
    listEvents(60),
  ]);
  let whatsapp: boolean | null = null;
  try {
    whatsapp = (await waStatus(gymInstance(gymId))).state === "open";
  } catch {
    whatsapp = null;
  }

  const scope = accessScope(gymId);
  const esEnsayo = (nombre: string) => /prueba/i.test(nombre || "");
  const mine = new Map(socios.map((s) => [s.id, s]));
  const doorName = new Map(points.map((p) => [String(p.id), String(p.name || "Puerta")]));
  const claseDe = (reason: string, ok: boolean) => {
    if (reason === "MANUAL") return "panel";
    if (ok) return "entrada";
    if (reason === "UNKNOWN_SUBJECT") return "identidad";
    if (reason === "LIVENESS_FAILED" || reason === "CHALLENGE_REQUIRED") return "seguridad";
    if (reason === "MEMBERSHIP_EXPIRED" || reason === "NOT_AUTHORIZED" || reason === "OUT_OF_SCHEDULE" || reason === "NO_CONSENT") return "membresia";
    return "otro";
  };
  const hours = Array.from({ length: 24 }, () => 0);
  const saleHours = Array.from({ length: 24 }, () => 0);
  for (const sale of sales) {
    if (sale.status !== "pagada") continue;
    const b = bogota(sale.createdAt);
    if (b && b.day === summary.day) saleHours[b.hour] += 1;
  }

  const recientes: {
    at: string; name: string; ensayo: boolean; ok: boolean; title: string; why: string; reason: string; puerta: string; clase: string;
  }[] = [];
  const causas = { identidad: 0, membresia: 0, seguridad: 0, panel: 0, otro: 0 };
  let accesosHoy = 0;
  let aprobados = 0;
  let ultimo: string | null = null;
  for (const ev of rawEvents) {
    if (!eventBelongsToGym(ev, scope)) continue;
    const subjectId = (ev.subjectId || null) as string | null;
    const socio = subjectId ? mine.get(subjectId) : undefined;
    const when = ev.recordedAt || ev.recorded_at;
    const b = bogota(when);
    if (!b || b.day !== summary.day) continue;
    const reason = String(ev.reason || "");
    if (reason === "DEMO") continue;
    accesosHoy += 1;
    const ok = String(ev.decision || "").toUpperCase() === "GRANTED";
    const clase = claseDe(reason, ok);
    if (ok) aprobados += 1;
    else if (clase === "identidad" || clase === "membresia" || clase === "seguridad" || clase === "panel" || clase === "otro") causas[clase] += 1;
    hours[b.hour] += 1;
    const at = new Date(when).toISOString();
    if (!ultimo || at > ultimo) ultimo = at;
    if (recientes.length < 7) {
      const story = accessStory(reason, ok);
      const nombre = reason === "MANUAL" ? "Prueba del panel" : socio?.nombre || (subjectId ? "Persona reconocida" : "Persona no reconocida");
      recientes.push({
        at,
        name: nombre,
        ensayo: socio ? esEnsayo(socio.nombre) : false,
        ok,
        title: story.title,
        why: story.why,
        reason,
        puerta: doorName.get(String(ev.accessPointId || ev.access_point_id || "")) || "Puerta",
        clase,
      });
    }
  }

  const devices = listTurnstiles(gymId);
  const doorOffline = devices.filter((d) => !d.lastSeen || Date.now() - Date.parse(d.lastSeen) >= 45_000);
  const doorOnline = devices.filter((d) => d.lastSeen && Date.now() - Date.parse(d.lastSeen) < 45_000);
  const servicios = [
    {
      id: "api",
      label: "Backend de acceso",
      estado: up ? "conectado" : "sin_respuesta",
      detalle: up ? "Respondió en esta lectura." : "No respondió en esta lectura.",
    },
    {
      id: "vision",
      label: "Reconocimiento",
      estado: vision.ok ? "conectado" : "sin_respuesta",
      detalle: vision.ok
        ? "El servicio de visión respondió. Eso no confirma que la cámara física esté enchufada."
        : "El servicio de visión no respondió.",
    },
    {
      id: "door",
      label: "Torniquete",
      estado: devices.length === 0 ? "sin_dato" : doorOnline.length ? "conectado" : "desconectado",
      detalle: devices.length === 0
        ? "No hay controlador asignado a esta sede."
        : doorOnline.length
          ? `${doorOnline.map((d) => d.name).join(", ")} avisó hace menos de un minuto.`
          : `${doorOffline.map((d) => d.name).join(", ")} no avisa.`,
    },
    {
      id: "wa",
      label: "WhatsApp",
      estado: whatsapp === null ? "sin_dato" : whatsapp ? "conectado" : "desconectado",
      detalle: whatsapp === null ? "No se pudo comprobar en esta lectura." : whatsapp ? "La sesión de mensajes está abierta." : "La sesión de mensajes no está abierta.",
    },
  ];
  const checks = servicios.map((s) => ({
    id: s.id,
    label: s.label,
    ok: s.estado === "conectado",
    unknown: s.estado === "sin_dato",
  }));
  const down = checks.filter((c) => !c.ok && !c.unknown).length;
  const medios = { efectivo: 0, tarjeta: 0, transferencia: 0, wompi: 0 };
  for (const sale of sales) {
    if (sale.status !== "pagada") continue;
    const esWompi = sale.cashier === "Wompi" || /wompi/i.test(sale.note || "");
    let left = sale.total;
    for (const p of [...sale.payments].sort((a, b) => (a.method === "efectivo" ? 1 : -1))) {
      const take = Math.min(left, p.amount);
      if (esWompi && p.method === "tarjeta") medios.wompi += take;
      else medios[p.method] += take;
      left -= take;
    }
  }
  const personas = socios.map((s) => {
    const plan = currentMembership(gymId, s.id);
    const vigente = plan?.live === "activa";
    const rostro = s.estado === "enrolado";
    return {
      id: s.id,
      nombre: s.nombre,
      ensayo: esEnsayo(s.nombre),
      rostro,
      vigente,
      habilitado: vigente && rostro,
      endsOn: vigente ? null : plan?.endsOn || null,
    };
  });

  return NextResponse.json({
    day: summary.day,
    socios: socios.length,
    enrolados,
    pendientes,
    caja: {
      ventas: summary.total,
      ingresos: summary.total,
      egresos: summary.expenses,
      flujo: summary.total - summary.expenses,
      neto: summary.total - summary.expenses,
      tickets: summary.tickets,
      medios,
      efectivo: summary.efectivoTurno,
      gastosEfectivo: summary.gastosEfectivoTurno,
      base: summary.session ? summary.session.openingFloat : null,
      esperado: summary.session && !summary.session.closedAt ? summary.expectedCash : null,
      enCajon: summary.expectedCash,
      abierta: !!summary.session && !summary.session.closedAt,
    },
    accesos: { hoy: accesosHoy, aprobados, rechazados: accesosHoy - aprobados, ultimo, causas, recientes },
    personas,
    horas: hours,
    ventasHora: saleHours,
    restock: restock.length,
    membresias: (() => {
      const cov = accessCoverage(gymId, socios.map((s) => s.id));
      const name = new Map(socios.map((s) => [s.id, s.nombre]));
      return {
        ...cov,
        bloqueados: cov.bloqueados.slice(0, 6).map((b) => ({ ...b, nombre: name.get(b.id) || "Socio" })),
      };
    })(),
    sistema: { checks, down, servicios, actualizado: new Date().toISOString() },
    renovaciones: (() => {
      const hoy = renewalBoard(gymId).hoy;
      return { hoy: hoy.count, monto: hoy.amount };
    })(),
    torniquetes: {
      offline: doorOffline.map((d) => ({ name: d.name, ssid: d.ssid, lastSeen: d.lastSeen })),
    },
  });
}
