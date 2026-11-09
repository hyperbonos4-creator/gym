"use client";
import { publicBrand } from "../lib/brand";

import { useEffect, useMemo, useState } from "react";
import GymShell from "../components/GymShell";
import { cop } from "../lib/money";
import { getActiveGymId } from "../lib/session";

type Persona = { id: string; nombre: string; ensayo: boolean; rostro: boolean; vigente: boolean; habilitado: boolean; endsOn: string | null };
type Reciente = { at: string; name: string; ensayo: boolean; ok: boolean; title: string; why: string; reason: string; puerta: string; clase: string };
type Servicio = { id: string; label: string; estado: "conectado" | "sin_respuesta" | "desconectado" | "sin_dato"; detalle: string };
type Pulse = {
  caja: {
    ventas: number;
    egresos: number;
    flujo: number;
    medios: { efectivo: number; tarjeta: number; transferencia: number; wompi: number };
    efectivo: number;
    gastosEfectivo: number;
    base: number | null;
    esperado: number | null;
    abierta: boolean;
  };
  accesos: {
    hoy: number;
    aprobados: number;
    rechazados: number;
    ultimo: string | null;
    causas: { identidad: number; membresia: number; seguridad: number; panel: number; otro: number };
    recientes: Reciente[];
  };
  personas: Persona[];
  restock: number;
  sistema: { servicios: Servicio[]; actualizado: string };
  renovaciones?: { hoy: number; monto: number };
  torniquetes?: { offline: { name: string; ssid: string; lastSeen: string | null }[] };
};

const ESTADO: Record<Servicio["estado"], string> = {
  conectado: "Conectado",
  sin_respuesta: "Sin respuesta",
  desconectado: "Desconectado",
  sin_dato: "Sin dato",
};

function fechaLarga() {
  const raw = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function hora(iso: string) {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function reloj(iso: string | null) {
  if (!iso) return "sin contacto";
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

function claseTexto(clase: string) {
  if (clase === "identidad") return "Identificación";
  if (clase === "membresia") return "Membresía";
  if (clase === "seguridad") return "Seguridad";
  if (clase === "panel") return "Panel";
  if (clase === "entrada") return "Entrada";
  return "Otro";
}

export default function DashboardPage() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [gymName, setGymName] = useState("esta sede");
  const [now, setNow] = useState("");
  const [ocultarEnsayo, setOcultarEnsayo] = useState(true);
  const [vista, setVista] = useState<"todos" | "ok" | "no">("todos");

  useEffect(() => {
    if (sessionStorage.getItem("gym-ocultar-ensayo") === "0") setOcultarEnsayo(false);
  }, []);

  useEffect(() => {
    setNow(fechaLarga());
    const clock = setInterval(() => setNow(fechaLarga()), 30000);
    const id = getActiveGymId() || "fuerza-elite";
    const load = () => {
      fetch(`/api/dashboard?gym=${encodeURIComponent(id)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (d?.accesos && Array.isArray(d.personas)) setPulse(d); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 20000);
    fetch("/api/gyms", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const g = (d.items || []).find((x: { id: string }) => x.id === id);
        if (g?.name) setGymName(g.name);
      })
      .catch(() => {});
    return () => {
      clearInterval(t);
      clearInterval(clock);
    };
  }, []);

  const sede = gymName.replace(/^fuerza élite\s*/i, "").trim() || gymName;
  const gente = useMemo(
    () => (pulse?.personas || []).filter((p) => !ocultarEnsayo || !p.ensayo),
    [pulse, ocultarEnsayo],
  );
  const ensayos = (pulse?.personas || []).filter((p) => p.ensayo).length;
  const habilitados = gente.filter((p) => p.habilitado).length;
  const enrolados = gente.filter((p) => p.rostro).length;
  const sinPlan = gente.filter((p) => !p.vigente);
  const sinRostro = gente.filter((p) => !p.rostro);
  const solapan = sinPlan.filter((p) => sinRostro.some((r) => r.id === p.id)).length;
  const pct = gente.length ? Math.round((enrolados / gente.length) * 1000) / 10 : 0;
  const servicios = pulse?.sistema.servicios || [];
  const servicioCaido = servicios.some((s) => s.estado === "sin_respuesta" || s.estado === "desconectado");
  const servicioSinDato = servicios.some((s) => s.estado === "sin_dato");
  const causas = pulse?.accesos.causas;
  const recientes = (pulse?.accesos.recientes || []).filter((ev) => vista === "todos" || (vista === "ok" ? ev.ok : !ev.ok));
  const medios = pulse ? [
    pulse.caja.medios.efectivo ? `Efectivo ${cop(pulse.caja.medios.efectivo)}` : "",
    pulse.caja.medios.wompi ? `Wompi ${cop(pulse.caja.medios.wompi)}` : "",
    pulse.caja.medios.tarjeta ? `Tarjeta ${cop(pulse.caja.medios.tarjeta)}` : "",
    pulse.caja.medios.transferencia ? `Transferencia ${cop(pulse.caja.medios.transferencia)}` : "",
  ].filter(Boolean) : [];

  const asuntos: string[] = [];
  if ((pulse?.accesos.rechazados || 0) > 0) asuntos.push("acceso");
  if (sinPlan.length) asuntos.push("membresías");
  if (sinRostro.length) asuntos.push("enrolamiento");
  const operacion = !pulse
    ? "Leyendo la sede…"
    : asuntos.length
      ? `La información del día está consolidada. Hay asuntos pendientes de ${asuntos.join(", ").replace(/, ([^,]*)$/, " y $1")}.`
      : "La información del día está consolidada. La operación no tiene asuntos pendientes.";

  function toggleEnsayo() {
    const next = !ocultarEnsayo;
    setOcultarEnsayo(next);
    sessionStorage.setItem("gym-ocultar-ensayo", next ? "1" : "0");
  }

  return (
    <GymShell active="dashboard">
      <div className="px-6 py-6">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gym-muted">{publicBrand().name} / Operaciónn</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Centro de operaciones</h2>
            <p className="mt-1 text-sm text-gym-silver">{sede} · {now || "…"}</p>
          </div>
          <div className="max-w-xl text-sm">
            <p className={`font-bold ${!pulse ? "text-gym-muted" : servicioCaido ? "text-status-err" : servicioSinDato ? "text-status-warn" : "text-status-ok"}`}>
              {!pulse ? "Comprobando servicios…" : servicioCaido ? "Hay un servicio sin respuesta" : servicioSinDato ? "Hay un servicio sin dato" : "Servicios en línea"}
            </p>
            <p className={`mt-1 ${asuntos.length ? "text-status-warn" : "text-gym-silver"}`}>{operacion}</p>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <article className="glass p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Hoy</div>
            <div className="mt-2 text-2xl font-extrabold text-white">{pulse ? cop(pulse.caja.ventas) : "…"}</div>
            <div className="text-sm font-semibold text-white">Ventas cobradas</div>
            <p className="mt-1 text-[11px] text-gym-muted">{medios.length ? medios.join(" · ") : "Importe según los pagos registrados. No es la utilidad del gimnasio."}</p>
          </article>
          <article className="glass p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Puerta</div>
            <div className="mt-2 text-2xl font-extrabold text-white">{pulse ? pulse.accesos.hoy : "…"}</div>
            <div className="text-sm font-semibold text-white">Intentos de acceso</div>
            <p className="mt-1 text-[11px] text-gym-muted">{pulse ? `${pulse.accesos.aprobados} aprobados · ${pulse.accesos.rechazados} rechazados` : "…"}</p>
          </article>
          <article className="glass p-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Autorización</div>
            <div className="mt-2 text-2xl font-extrabold text-white">{pulse ? habilitados : "…"}</div>
            <div className="text-sm font-semibold text-white">Socios habilitados</div>
            <p className="mt-1 text-[11px] text-gym-muted">Plan vigente y rostro registrado. No basta con tener la ficha.</p>
          </article>
          <article className="glass p-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Identidad</div>
              <div className="text-sm font-extrabold text-white">{pulse ? `${pct}%` : "…"}</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gym-border/60">
              <div className="h-full rounded-full bg-gym-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 text-sm font-semibold text-white">Enrolamiento facial</div>
            <p className="mt-1 text-[11px] text-gym-muted">{pulse ? `${enrolados} de ${gente.length} con rostro. El rostro no autoriza la entrada.` : "…"}</p>
          </article>
        </section>

        {ensayos > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gym-muted">
            <span>{ensayos} {ensayos === 1 ? "ficha cuyo nombre contiene «prueba» está marcada" : "fichas cuyo nombre contiene «prueba» están marcadas"} como ensayo.</span>
            <button type="button" onClick={toggleEnsayo} className="rounded-full border border-gym-border px-3 py-1 font-semibold text-gym-silver">
              {ocultarEnsayo ? "Mostrar ensayos en las cifras" : "Quitar ensayos de las cifras"}
            </button>
          </div>
        )}

        <section className="glass mt-4 p-5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Requiere atención</h3>
          <div className="mt-3 flex flex-col gap-2">
            {!pulse && <p className="text-xs text-gym-muted">Cargando la operación…</p>}
            {(pulse?.torniquetes?.offline || []).map((d) => (
              <div key={d.name} className="rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-3">
                <div className="text-sm font-semibold text-status-err">Torniquete sin comunicación</div>
                <p className="mt-1 text-[11px] text-gym-silver">{d.ssid || d.name} · último contacto {reloj(d.lastSeen)} La puerta no se puede operar desde aquí hasta que el controlador vuelva a avisar.</p>
                <a href="/torniquetes" className="mt-2 inline-block text-[11px] font-semibold text-gym-primary">Revisar controlador</a>
              </div>
            ))}
            {servicios.filter((s) => (s.id === "api" || s.id === "vision") && s.estado !== "conectado").map((s) => (
              <div key={s.id} className="rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-3">
                <div className="text-sm font-semibold text-status-err">{s.label}</div>
                <p className="mt-1 text-[11px] text-gym-silver">{s.detalle}</p>
                <a href="/torniquetes" className="mt-2 inline-block text-[11px] font-semibold text-gym-primary">Revisar acceso</a>
              </div>
            ))}
            {pulse && pulse.accesos.rechazados > 0 && (
              <div className="rounded-xl border border-status-warn/40 bg-status-warn/10 px-3 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-sm font-semibold text-white">Intentos de acceso rechazados</div>
                  <div className="text-[11px] text-gym-muted">{pulse.accesos.rechazados} de {pulse.accesos.hoy}</div>
                </div>
                <p className="mt-1 text-[11px] text-gym-silver">Conviene revisar la causa antes de tratarlos como la misma falla.</p>
                <p className="mt-2 text-[11px] text-gym-muted">
                  {[
                    causas?.identidad ? `Identidad desconocida · ${causas.identidad}` : "",
                    causas?.membresia ? `Membresía · ${causas.membresia}` : "",
                    causas?.seguridad ? `Prueba de vida · ${causas.seguridad}` : "",
                    causas?.panel ? `Prueba del panel · ${causas.panel}` : "",
                    causas?.otro ? `Otro · ${causas.otro}` : "",
                  ].filter(Boolean).join("  ·  ")}
                </p>
                <a href="/accesos?dia=hoy&resultado=denegado" className="mt-2 inline-block text-[11px] font-semibold text-gym-primary">Revisar intentos</a>
              </div>
            )}
            {sinPlan.length > 0 && (
              <div className="rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-3">
                <div className="text-sm font-semibold text-status-err">Socios sin plan vigente</div>
                <p className="mt-1 text-[11px] text-gym-silver">{sinPlan.length} {sinPlan.length === 1 ? "persona no cumple" : "personas no cumplen"} la condición de membresía para entrar.</p>
                <div className="mt-2 flex flex-col gap-1">
                  {sinPlan.map((p) => (
                    <a key={p.id} href={p.endsOn ? "/membresias" : `/clientes?socio=${encodeURIComponent(p.id)}`} className="truncate text-[11px] font-semibold text-white hover:text-gym-primary">
                      {p.nombre}{p.ensayo ? " · ensayo" : ""}{p.endsOn ? ` · venció ${p.endsOn}` : " · sin plan"}
                    </a>
                  ))}
                </div>
                <a href="/membresias" className="mt-2 inline-block text-[11px] font-semibold text-gym-primary">Asignar o renovar</a>
              </div>
            )}
            {sinRostro.length > 0 && (
              <div className="rounded-xl border border-status-warn/40 bg-status-warn/10 px-3 py-3">
                <div className="text-sm font-semibold text-status-warn">Enrolamiento pendiente</div>
                <p className="mt-1 text-[11px] text-gym-silver">{sinRostro.length} {sinRostro.length === 1 ? "ficha no tiene" : "fichas no tienen"} el rostro. Enviar el enlace no cuenta como enrolamiento completado.</p>
                <a href="/clientes?filtro=rostro" className="mt-2 inline-block text-[11px] font-semibold text-gym-primary">Gestionar enrolamientos</a>
              </div>
            )}
            {solapan > 0 && (
              <p className="text-[11px] text-gym-muted">{solapan} {solapan === 1 ? "persona está" : "personas están"} en más de un asunto. Los números cuentan casos, no personas distintas.</p>
            )}
            {pulse && (pulse.renovaciones?.hoy || 0) > 0 && (
              <div className="rounded-xl border border-status-warn/40 bg-status-warn/10 px-3 py-3">
                <div className="text-sm font-semibold text-status-warn">{pulse.renovaciones?.hoy} {pulse.renovaciones?.hoy === 1 ? "plan vence" : "planes vencen"} hoy</div>
                <p className="mt-1 text-[11px] text-gym-silver">{cop(pulse.renovaciones?.monto || 0)} en los planes que vencen hoy. No es un cobro pendiente registrado.</p>
                <a href="/membresias" className="mt-2 inline-block text-[11px] font-semibold text-gym-primary">Renovar</a>
              </div>
            )}
            {pulse && pulse.restock > 0 && (
              <div className="rounded-xl border border-gym-border/60 px-3 py-3">
                <div className="text-sm font-semibold text-white">{pulse.restock} productos bajo el mínimo en el gimnasio</div>
                <a href="/productos" className="mt-2 inline-block text-[11px] font-semibold text-gym-primary">Revisar bodega</a>
              </div>
            )}
            {pulse && !servicioCaido && !(pulse.torniquetes?.offline.length) && pulse.accesos.rechazados === 0 && sinPlan.length === 0 && sinRostro.length === 0 && !(pulse.renovaciones?.hoy) && pulse.restock === 0 && (
              <p className="text-sm text-gym-silver">Nada pendiente en la operación de esta sede.</p>
            )}
          </div>
        </section>

        <section className="glass mt-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white">Actividad de acceso</h3>
              <p className="text-[11px] text-gym-muted">
                {pulse ? `${pulse.accesos.hoy} intentos registrados hoy. Se vuelve a leer cada 20 segundos. No es una transmisión en vivo.` : "…"}
              </p>
            </div>
            <a href="/accesos?dia=hoy" className="text-[11px] font-semibold text-gym-primary hover:underline">Ver historial</a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["todos", `Todos · ${pulse?.accesos.hoy ?? 0}`],
              ["ok", `Aprobados · ${pulse?.accesos.aprobados ?? 0}`],
              ["no", `Rechazados · ${pulse?.accesos.rechazados ?? 0}`],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setVista(id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${vista === id ? "bg-white text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {pulse && recientes.length === 0 && <p className="text-sm text-gym-muted">En los últimos 7 intentos no hay de este resultado. El historial tiene el día completo.</p>}
            {recientes.map((ev) => (
              <div key={`${ev.at}-${ev.name}-${ev.reason}`} className="flex items-center gap-3 rounded-xl border border-gym-border/50 bg-gym-navy/40 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{ev.name}{ev.ensayo ? " · ensayo" : ""}</div>
                  <div className="text-[11px] text-gym-silver">{claseTexto(ev.clase)} · {ev.why} · {ev.puerta} · {hora(ev.at)}</div>
                </div>
                <div className={`text-[11px] font-bold ${ev.ok ? "text-status-ok" : "text-status-err"}`}>{ev.ok ? "Aprobado" : "Rechazado"}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Caja de hoy</h3>
              <a href="/caja" className="text-[11px] font-semibold text-gym-primary hover:underline">Ver caja</a>
            </div>
            <p className="mt-1 text-[11px] text-gym-muted">{pulse?.caja.abierta ? "Turno abierto" : "Turno cerrado"}</p>
            <div className="mt-3 text-2xl font-extrabold text-white">{pulse ? cop(pulse.caja.ventas) : "…"}</div>
            <p className="text-sm text-white">Ventas cobradas hoy</p>
            <p className="text-[11px] text-gym-muted">{medios.length ? medios.join(" · ") : "Sin ventas cobradas hoy."}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gym-muted">Base inicial</dt><dd className="font-semibold text-white">{pulse?.caja.base == null ? "Sin turno" : cop(pulse.caja.base)}</dd></div>
              <div className="flex justify-between"><dt className="text-gym-muted">Ventas en efectivo</dt><dd className="font-semibold text-white">{pulse ? cop(pulse.caja.efectivo) : "…"}</dd></div>
              <div className="flex justify-between"><dt className="text-gym-muted">Egresos en efectivo</dt><dd className="font-semibold text-white">{pulse ? cop(pulse.caja.gastosEfectivo) : "…"}</dd></div>
              <div className="flex justify-between border-t border-gym-border/60 pt-2"><dt className="text-gym-muted">Efectivo esperado</dt><dd className="font-extrabold text-white">{pulse?.caja.esperado == null ? "Sin turno abierto" : cop(pulse.caja.esperado)}</dd></div>
              <div className="flex justify-between"><dt className="text-gym-muted">Ventas menos egresos</dt><dd className="font-semibold text-white">{pulse ? cop(pulse.caja.flujo) : "…"}</dd></div>
            </dl>
            <p className="mt-2 text-[11px] text-gym-muted">El efectivo esperado sale de la base, más el efectivo cobrado en el turno, menos los egresos en efectivo. No es el dinero contado en el cajón ni la utilidad del gimnasio. Una venta con tarjeta o Wompi no entra a esa cuenta.</p>
          </div>

          <div className="glass p-5">
            <h3 className="text-sm font-bold text-white">Infraestructura</h3>
            <p className="mt-1 text-[11px] text-gym-muted">Cada estado sale de la última comprobación. Si no hubo señal, no se marca como conectado.</p>
            <div className="mt-3 space-y-2">
              {servicios.map((s) => (
                <div key={s.id} className="rounded-xl border border-gym-border/60 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white">{s.label}</div>
                    <div className={`text-[11px] font-bold ${s.estado === "conectado" ? "text-status-ok" : s.estado === "sin_dato" ? "text-gym-muted" : "text-status-err"}`}>{ESTADO[s.estado]}</div>
                  </div>
                  <p className="mt-1 text-[11px] text-gym-muted">{s.detalle}</p>
                </div>
              ))}
              {!pulse && <p className="text-xs text-gym-muted">Comprobando…</p>}
            </div>
          </div>
        </section>
      </div>
    </GymShell>
  );
}
