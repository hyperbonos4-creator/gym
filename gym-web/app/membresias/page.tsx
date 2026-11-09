"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

type Plan = { id: string; name: string; price: number; durationDays: number; accessWindow?: string };
type Mem = {
  id: string;
  planId: string;
  planName: string;
  endsOn: string;
  startsOn: string;
  live: "activa" | "vencida" | "cancelada" | "suspendida";
  days: number;
  price: number;
  durationDays: number;
  accessWindow?: string;
  payState?: "pagada" | "pendiente" | null;
  method?: "efectivo" | "tarjeta" | "transferencia" | "wompi" | null;
  cancelReason?: string | null;
  lastNoticeOn?: string | null;
};
type Access = { at: string; ok: boolean; detail: string };
type Suggestion = { planId: string; planName: string; price: number; times: number };
type Row = {
  id: string;
  nombre: string;
  docTipo: string;
  docNumero: string;
  celular: string;
  codigoPais: string;
  estado: string;
  membresia: Mem | null;
  historial: Mem[];
  sugerencia: Suggestion | null;
  ultimoAcceso: Access | null;
};
type Board = { count: number; amount: number };
type Method = "efectivo" | "tarjeta" | "transferencia";

function bogotaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function addDays(yyyyMmDd: string, days: number) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function fecha(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function resto(m: Mem) {
  if (m.live === "suspendida") return "Acceso cortado";
  if (m.live === "vencida") return m.days === -1 ? "Vencida hace 1 día" : `Vencida hace ${Math.abs(m.days)} días`;
  if (m.live !== "activa") return "Sin días";
  if (m.days === 0) return "Vence hoy";
  if (m.days === 1) return "Mañana";
  return `${m.days} días restantes`;
}

function hasta(m: Mem) {
  if (m.live === "activa" && m.days === 0) {
    if (m.accessWindow === "manana") return "Hasta las 12:00 p. m.";
    if (m.accessWindow === "noche") return "Hasta las 10:00 p. m.";
    return "Hasta las 11:59 p. m.";
  }
  return `${resto(m)} · ${fecha(m.endsOn)}`;
}

function empieza(m: Mem) {
  if (m.live !== "activa" || m.startsOn <= bogotaToday()) return "";
  const manana = addDays(bogotaToday(), 1);
  return m.startsOn === manana ? "Empieza mañana" : `Empieza el ${fecha(m.startsOn)}`;
}

function pago(m: Mem) {
  if (m.payState === "pendiente") return "Pendiente";
  if (m.payState === "pagada") {
    const via = m.method === "tarjeta" ? "Tarjeta" : m.method === "transferencia" ? "Transferencia" : m.method === "efectivo" ? "Efectivo" : m.method === "wompi" ? "Wompi" : "";
    return via ? `Pagada · ${via}` : "Pagada";
  }
  return "Cobro no registrado";
}

function diasPlan(n: number) {
  return n === 1 ? "1 día" : `${n} días`;
}

function preview(m: Mem | null, plan: Plan) {
  const today = bogotaToday();
  const stacks = !!(m && m.live !== "cancelada" && m.live !== "vencida" && m.endsOn >= today);
  const startsOn = stacks && m ? addDays(m.endsOn, 1) : today;
  return { startsOn, endsOn: addDays(startsOn, plan.durationDays - 1), stacks };
}

function grupo(row: Row) {
  const m = row.membresia;
  if (!m || m.live === "cancelada") return "sin";
  if (m.live === "vencida") return "vencida";
  if (m.live === "suspendida") return "suspendida";
  if (m.days === 0) return "hoy";
  if (m.days <= 7) return "semana";
  return "ok";
}

export default function MembresiasPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState({ activas: 0, vencidas: 0, porVencer: 0, renovacionesHoy: 0, ingresosHoy: 0 });
  const [bandeja, setBandeja] = useState<{ hoy: Board; manana: Board; semana: Board }>({ hoy: { count: 0, amount: 0 }, manana: { count: 0, amount: 0 }, semana: { count: 0, amount: 0 } });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [panel, setPanel] = useState<{ id: string; mode: "renovar" | "cambiar" | "anular" | "cobrar" } | null>(null);
  const [planId, setPlanId] = useState("");
  const [pay, setPay] = useState<"ahora" | "pendiente">("ahora");
  const [method, setMethod] = useState<Method>("efectivo");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "atencion" | "vigentes" | "vencidas" | "suspendidas">("todas");
  const [q, setQ] = useState("");

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/memberships?gym=${encodeURIComponent(id)}`, { cache: "no-store" });
    const d = await r.json();
    setPlans(d.plans || []);
    setRows(d.items || []);
    setSummary(d.summary || { activas: 0, vencidas: 0, porVencer: 0, renovacionesHoy: 0, ingresosHoy: 0 });
    setBandeja(d.bandeja || { hoy: { count: 0, amount: 0 }, manana: { count: 0, amount: 0 }, semana: { count: 0, amount: 0 } });
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
  }, [load]);

  const conPlan = useMemo(() => rows.filter((s) => grupo(s) !== "sin"), [rows]);
  const visibles = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    const list = conPlan.filter((s) => {
      const g = grupo(s);
      if (filtro === "atencion" && g === "ok") return false;
      if (filtro === "vigentes" && s.membresia?.live !== "activa") return false;
      if (filtro === "vencidas" && g !== "vencida") return false;
      if (filtro === "suspendidas" && g !== "suspendida") return false;
      if (!needle) return true;
      const phone = `${s.codigoPais || ""}${s.celular || ""}`.replace(/\D/g, "");
      return s.nombre.toLowerCase().includes(needle)
        || (s.docNumero || "").toLowerCase().includes(needle)
        || (digits.length >= 3 && phone.includes(digits));
    });
    return [...list].sort((a, b) => {
      const order = { hoy: 0, semana: 1, suspendida: 2, vencida: 3, sin: 4, ok: 5 };
      const d = order[grupo(a)] - order[grupo(b)];
      if (d) return d;
      return (a.membresia?.days ?? 99) - (b.membresia?.days ?? 99);
    });
  }, [conPlan, filtro, q]);

  function abrir(row: Row, mode: "renovar" | "cambiar" | "anular" | "cobrar") {
    setPanel({ id: row.id, mode });
    setReason("");
    setPay("ahora");
    const prefer = mode === "renovar" ? row.membresia?.planId || row.sugerencia?.planId || plans[0]?.id || "" : plans[0]?.id || "";
    setPlanId(prefer);
    setMsg("");
  }

  async function enviar(socioId: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(socioId + action);
    setMsg("");
    const r = await fetch("/api/memberships", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, socioId, action, planId, pay, method, ...extra }),
    });
    const d = await r.json();
    if (!r.ok) {
      setMsg(d.error === "motivo_corto" ? "Escribe el motivo de la anulación." : d.error === "caja_cerrada" ? "Abre la caja antes de cobrar en efectivo." : "No se pudo guardar.");
    } else if (action !== "cobrar" && !d.door) {
      setMsg("Quedó guardado, pero la puerta no confirmó. Repite la acción cuando el acceso responda.");
    } else if (action === "anular") setMsg("Membresía anulada. La puerta ya no abre.");
    else if (action === "suspender") setMsg("Acceso suspendido. La vigencia sigue guardada y se puede reactivar.");
    else if (action === "reactivar") setMsg("Acceso reactivado hasta el fin de este plan.");
    else if (action === "cobrar") setMsg("Cobro registrado en caja.");
    else if (pay === "pendiente") setMsg("Plan asignado. El cobro quedó pendiente.");
    else setMsg("Cobrado en caja. La puerta ya respeta la vigencia nueva.");
    setBusy(null);
    if (r.ok) setPanel(null);
    load(gymId);
  }

  async function avisar(socioId?: string) {
    setBusy(socioId || "avisos");
    setMsg("");
    const r = await fetch("/api/memberships/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, socioId: socioId || "" }),
    });
    const d = await r.json().catch(() => ({}));
    if (d.already) setMsg("A esta persona ya se le avisó hoy.");
    else if (d.sent) setMsg(d.sent === 1 ? "WhatsApp enviado." : `WhatsApp enviado a ${d.sent} socios.`);
    else if (d.failed?.length) setMsg(`No se pudo avisar: ${d.failed.join(", ")}. Revisa que WhatsApp esté conectado.`);
    else setMsg("No hay un vencimiento próximo para avisar.");
    setBusy(null);
    load(gymId);
  }

  const hoyBogota = bogotaToday();
  const porGestionar = rows.filter((s) => s.membresia && s.membresia.live === "activa" && s.membresia.days <= 1);
  const avisados = porGestionar.filter((s) => s.membresia?.lastNoticeOn === hoyBogota).length;
  const recordatorioListo = porGestionar.length > 0 && avisados >= porGestionar.length;
  const atencionCount = conPlan.filter((s) => grupo(s) !== "ok").length;
  const vigentes = conPlan.filter((s) => s.membresia?.live === "activa").length;
  const vencidasN = conPlan.filter((s) => grupo(s) === "vencida").length;
  const suspendidasN = conPlan.filter((s) => grupo(s) === "suspendida").length;
  const hayRenovaciones = bandeja.hoy.count + bandeja.manana.count + bandeja.semana.count > 0;

  const secciones = [
    ["hoy", "Vence hoy"],
    ["semana", "Vence en 7 días"],
    ["suspendida", "Suspendidas"],
    ["vencida", "Vencidas"],
    ["ok", "Al día"],
  ] as const;

  return (
    <GymShell active="membresias">
      <div className="px-6 py-6">
        <p className="mb-1 text-sm text-gym-muted">Clientes que tienen un plan. Quien no tiene membresía está en Clientes.</p>
        <p className="mb-4 text-sm text-gym-silver">
          {summary.renovacionesHoy > 0 ? (
            <span className="font-bold text-status-warn">
              {summary.renovacionesHoy} {summary.renovacionesHoy === 1 ? "persona necesita" : "personas necesitan"} atención hoy.{" "}
              {recordatorioListo
                ? `${summary.renovacionesHoy} ${summary.renovacionesHoy === 1 ? "renovación" : "renovaciones"} hoy · recordatorio enviado`
                : `${summary.renovacionesHoy} ${summary.renovacionesHoy === 1 ? "renovación" : "renovaciones"} · ${cop(summary.ingresosHoy)} pendientes de gestión`}
            </span>
          ) : atencionCount > 0 ? (
            <span className="font-bold text-white">No hay renovaciones programadas. Hay {atencionCount} {atencionCount === 1 ? "persona que necesita" : "personas que necesitan"} activar o recuperar su acceso.</span>
          ) : (
            <span className="font-bold text-status-ok">Hoy no hay renovaciones por gestionar. {vigentes} {vigentes === 1 ? "vigente puede entrar" : "vigentes pueden entrar"}.</span>
          )}
        </p>

        <div className={`mb-2 grid grid-cols-2 gap-3 ${suspendidasN ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
          {[
            ["Vigentes", String(vigentes), "Plan activo"],
            ["Vencidas", String(vencidasN), "Hay que renovar"],
            ...(suspendidasN ? [["Suspendidas", String(suspendidasN), "Acceso cortado"]] : []),
          ].map(([l, n, sub]) => (
            <div key={l} className="glass px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-gym-muted">{l}</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{n}</div>
              <div className="text-[11px] text-gym-silver">{sub}</div>
            </div>
          ))}
        </div>
        <p className="mb-5 text-[11px] text-gym-muted">Entrar también depende del rostro, la sede y las reglas del plan.</p>

        {hayRenovaciones && (
          <div className="glass mb-5 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Renovaciones</div>
              <button
                type="button"
                disabled={!!busy || recordatorioListo}
                onClick={() => {
                  const quienes = bandeja.hoy.count
                    ? `${bandeja.hoy.count} ${bandeja.hoy.count === 1 ? "socio vence" : "socios vencen"} hoy.`
                    : "Nadie vence hoy.";
                  const preview = "Hola. Tu plan vence hoy. Renueva en recepción para seguir entrando.";
                  if (window.confirm(`${quienes}\n\nSe avisará a quienes vencen en 3 días o menos y aún no fueron avisados hoy.\n\n“${preview}”`)) avisar();
                }}
                className="rounded-full border border-gym-primary/50 px-3 py-1 text-[11px] font-semibold text-gym-primary disabled:opacity-50"
              >
                {recordatorioListo ? "Recordatorio enviado" : "Enviar recordatorio"}
              </button>
            </div>
            <div className="space-y-2">
              {([
                ["Hoy", bandeja.hoy],
                ["Mañana", bandeja.manana],
                ["Próximos 7 días", bandeja.semana],
              ] as const).filter(([, b]) => b.count > 0).map(([label, b]) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-gym-border/60 bg-gym-navy/40 px-3 py-2">
                  <span className="text-lg leading-none text-status-warn">●</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">{label}</div>
                    <div className="text-sm font-semibold text-white">{b.count} {b.count === 1 ? "socio" : "socios"}</div>
                  </div>
                  <div className="text-sm font-bold text-gym-silver">{cop(b.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg && <div className="mb-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</div>}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {([
            ["todas", `Todas · ${conPlan.length}`],
            ["atencion", `Requieren atención · ${atencionCount}`],
            ["vigentes", `Vigentes · ${vigentes}`],
            ["vencidas", `Vencidas · ${vencidasN}`],
            ...(suspendidasN ? [["suspendidas", `Suspendidas · ${suspendidasN}`] as const] : []),
          ] as const).map(([f, label]) => (
            <button key={f} type="button" onClick={() => setFiltro(f)} className={`rounded-full px-3 py-1 text-xs font-semibold ${filtro === f ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>
              {label}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, WhatsApp o documento"
            className="ml-auto w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white sm:w-72"
          />
        </div>

        {visibles.length === 0 && (
          <p className="glass p-6 text-sm text-gym-muted">
            {conPlan.length === 0
              ? "Ningún cliente tiene una membresía."
              : q.trim()
                ? "Nadie coincide con esa búsqueda."
                : "Nadie en este filtro."}
          </p>
        )}

        {secciones.map(([key, title]) => {
          const list = visibles.filter((s) => grupo(s) === key);
          if (!list.length) return null;
          return (
            <section key={key} className="mb-5">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gym-muted">{title}</h3>
              <div className="space-y-3">
                {list.map((s) => (
                  <Ficha
                    key={s.id}
                    row={s}
                    plans={plans}
                    open={panel?.id === s.id ? panel.mode : null}
                    showHistory={history === s.id}
                    planId={planId}
                    pay={pay}
                    method={method}
                    reason={reason}
                    busy={busy}
                    onPlan={setPlanId}
                    onPay={setPay}
                    onMethod={setMethod}
                    onReason={setReason}
                    onOpen={(mode) => abrir(s, mode)}
                    onClose={() => setPanel(null)}
                    onHistory={() => setHistory(history === s.id ? null : s.id)}
                    onSend={(action, extra) => enviar(s.id, action, extra)}
                    onWhatsapp={() => avisar(s.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </GymShell>
  );
}

function Ficha(props: {
  row: Row;
  plans: Plan[];
  open: "renovar" | "cambiar" | "anular" | "cobrar" | null;
  showHistory: boolean;
  planId: string;
  pay: "ahora" | "pendiente";
  method: Method;
  reason: string;
  busy: string | null;
  onPlan: (id: string) => void;
  onPay: (p: "ahora" | "pendiente") => void;
  onMethod: (m: Method) => void;
  onReason: (v: string) => void;
  onOpen: (mode: "renovar" | "cambiar" | "anular" | "cobrar") => void;
  onClose: () => void;
  onHistory: () => void;
  onSend: (action: string, extra?: Record<string, unknown>) => void;
  onWhatsapp: () => void;
}) {
  const s = props.row;
  const m = s.membresia;
  const plan = props.plans.find((p) => p.id === props.planId) || null;
  const vista = plan && (props.open === "renovar" || props.open === "cambiar") ? preview(m, plan) : null;
  const [mas, setMas] = useState(false);
  const phone = `${s.codigoPais || ""}${s.celular || ""}`.replace(/\D/g, "");
  const faceOk = s.estado === "enrolado";
  const memOk = m?.live === "activa";
  const sinPlan = !m || m.live === "cancelada";
  const vencida = m?.live === "vencida";
  const suspendida = m?.live === "suspendida";
  const venceHoy = !!m && m.live === "activa" && m.days === 0;
  const porVencer = !!m && m.live === "activa" && m.days <= 7;
  const fichaHref = `/clientes?socio=${encodeURIComponent(s.id)}`;
  const badge = sinPlan ? "Sin plan" : suspendida ? "Suspendida" : vencida ? "Vencida" : venceHoy ? "Vence hoy" : memOk && !faceOk ? "Rostro pendiente" : "Vigente";
  const quiet = badge === "Vigente";
  const badgeCls = quiet ? "bg-status-ok/15 text-status-ok" : badge === "Vence hoy" || badge === "Rostro pendiente" ? "bg-status-warn/15 text-status-warn" : "bg-status-err/15 text-status-err";
  const detalle = sinPlan
    ? "No tiene membresía vigente."
    : m
      ? `${m.planName} · ${venceHoy ? hasta(m) : resto(m)}${m.price ? ` · ${cop(m.price)}` : ""}`
      : "";
  const extra = !faceOk && badge !== "Rostro pendiente"
    ? "Rostro pendiente"
    : memOk && m?.payState !== "pagada"
      ? "Cobro pendiente. La puerta sigue abierta mientras el plan esté vigente."
      : "";
  const primary: "renew" | "assign" | "resume" | "enroll" | "ficha" = suspendida
    ? "resume"
    : sinPlan
      ? "assign"
      : vencida || porVencer
        ? "renew"
        : memOk && !faceOk
          ? "enroll"
          : "ficha";
  const primaryLabel = primary === "resume" ? "Reactivar" : primary === "assign" ? "Asignar plan" : primary === "renew" ? (m ? `Renovar · ${cop(m.price)}` : "Renovar") : primary === "enroll" ? "Completar enrolamiento" : "Ver ficha";

  return (
    <article className="glass p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gym-primaryDeep to-gym-violet text-sm font-bold text-white">
          {s.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-semibold text-white">{s.nombre}</div>
              <div className="text-[11px] text-gym-muted">{s.docTipo} {s.docNumero || "sin documento"}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badgeCls}`}>{badge}</span>
          </div>
          <p className="mt-2 text-sm text-gym-silver">{detalle}{m && empieza(m) ? ` · ${empieza(m)}` : ""}</p>
          {extra && <p className="mt-1 text-xs text-gym-muted">{extra}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {primary === "enroll" || primary === "ficha" ? (
          <a href={fichaHref} className="btn-gym px-3 py-1.5 text-xs">{primaryLabel}</a>
        ) : primary === "resume" ? (
          <button type="button" className="btn-gym px-3 py-1.5 text-xs" disabled={!!props.busy} onClick={() => props.onSend("reactivar")}>{primaryLabel}</button>
        ) : (
          <button type="button" className="btn-gym px-3 py-1.5 text-xs" disabled={!!props.busy || !props.plans.length} onClick={() => props.onOpen(primary === "renew" && m && m.live === "activa" ? "renovar" : "cambiar")}>{primaryLabel}</button>
        )}
        {primary !== "ficha" && primary !== "enroll" && (
          <a href={fichaHref} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Ver ficha</a>
        )}
        {(sinPlan || vencida || porVencer) && (
          <button
            type="button"
            disabled={!!props.busy || phone.length < 10}
            onClick={() => {
              const nombre = s.nombre.split(" ")[0];
              const when = !m ? "" : m.days === 0 ? "hoy" : m.days === 1 ? "mañana" : m.days < 0 ? "y ya venció" : `en ${m.days} días`;
              const texto = m
                ? `Hola ${nombre}. Tu plan ${m.planName} vence ${when} (${m.endsOn}). Renueva en recepción para seguir entrando.`
                : `Hola ${nombre}. No tienes un plan vigente.`;
              if (window.confirm(`Se enviará a ${s.nombre}:\n\n“${texto}”`)) props.onWhatsapp();
            }}
            className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver disabled:opacity-40"
          >
            {phone.length < 10 ? "Sin WhatsApp" : "WhatsApp"}
          </button>
        )}
        <button type="button" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-muted" onClick={() => setMas((v) => !v)} aria-label="Más acciones">{mas ? "Cerrar" : "⋯"}</button>
      </div>
      {mas && (
        <div className="mt-2 flex flex-wrap gap-2">
          {m && m.live === "activa" && (
            <button type="button" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-muted" onClick={() => props.onOpen("cambiar")}>Cambiar plan</button>
          )}
          {m?.live === "activa" && (
            <button type="button" disabled={!!props.busy} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-muted" onClick={() => { if (window.confirm("Se corta el acceso ahora. La vigencia queda guardada y se puede reactivar.")) props.onSend("suspender"); }}>Suspender</button>
          )}
          {m?.payState === "pendiente" && (
            <button type="button" className="rounded-xl border border-status-warn/50 px-3 py-1.5 text-xs font-semibold text-status-warn" onClick={() => props.onOpen("cobrar")}>Registrar cobro</button>
          )}
          <button type="button" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-muted" onClick={props.onHistory}>Historial</button>
          {m && (m.live === "activa" || m.live === "suspendida") && (
            <button type="button" className="rounded-xl border border-status-err/40 px-3 py-1.5 text-xs font-semibold text-status-err" onClick={() => props.onOpen("anular")}>Anular membresía</button>
          )}
        </div>
      )}

      {(props.open === "renovar" || props.open === "cambiar") && (
        <div className="mt-4 border-t border-gym-border/50 pt-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gym-muted">{props.open === "cambiar" ? "Cambiar plan" : m ? "Renovación" : "Nueva membresía"}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {props.plans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => props.onPlan(p.id)}
                className={`rounded-xl border px-3 py-3 text-left ${props.planId === p.id ? "border-gym-primary bg-gym-primary/10" : "border-gym-border/70 bg-gym-navy/30"}`}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide text-gym-muted">{p.name}</div>
                <div className="mt-1 text-base font-extrabold text-white">{cop(p.price)}</div>
                <div className="text-xs text-gym-silver">{diasPlan(p.durationDays)}</div>
              </button>
            ))}
          </div>
          {vista && plan && (
            <div className="mt-3 rounded-xl border border-gym-border/60 bg-gym-navy/40 px-3 py-2 text-xs text-gym-silver">
              {vista.stacks && m ? <div>Vigencia actual: hasta {fecha(m.endsOn)}.</div> : <div>Empieza hoy. No queda un plan vigente que conservar.</div>}
              <div className="mt-1 font-semibold text-white">Nueva vigencia: {fecha(vista.startsOn)} → {fecha(vista.endsOn)}.</div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gym-silver">
            <label className="flex items-center gap-2"><input type="radio" checked={props.pay === "ahora"} onChange={() => props.onPay("ahora")} /> Cobrar ahora</label>
            <label className="flex items-center gap-2"><input type="radio" checked={props.pay === "pendiente"} onChange={() => props.onPay("pendiente")} /> Registrar como pendiente</label>
          </div>
          {props.pay === "ahora" && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(["efectivo", "tarjeta", "transferencia"] as const).map((via) => (
                <button key={via} type="button" onClick={() => props.onMethod(via)} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${props.method === via ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{via}</button>
              ))}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-gym px-4 py-2 text-xs" disabled={!!props.busy || !plan} onClick={() => props.onSend("assign")}>
              Confirmar {props.pay === "pendiente" ? "sin cobro" : "y cobrar"}
            </button>
            <button type="button" className="rounded-xl border border-gym-border px-3 py-2 text-xs text-gym-muted" onClick={props.onClose}>Cerrar</button>
          </div>
        </div>
      )}

      {props.open === "cobrar" && m && (
        <div className="mt-4 border-t border-gym-border/50 pt-4">
          <div className="text-sm text-white">Cobrar {m.planName} · {cop(m.price)}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["efectivo", "tarjeta", "transferencia"] as const).map((via) => (
              <button key={via} type="button" onClick={() => props.onMethod(via)} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${props.method === via ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{via}</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-gym px-4 py-2 text-xs" disabled={!!props.busy} onClick={() => props.onSend("cobrar")}>Registrar cobro</button>
            <button type="button" className="rounded-xl border border-gym-border px-3 py-2 text-xs text-gym-muted" onClick={props.onClose}>Cerrar</button>
          </div>
        </div>
      )}

      {props.open === "anular" && (
        <div className="mt-4 border-t border-status-err/30 pt-4">
          <div className="text-sm font-semibold text-white">Anular membresía</div>
          <p className="mt-1 text-xs text-gym-muted">Corta el acceso ahora. El historial se conserva. Escribe el motivo.</p>
          <textarea value={props.reason} onChange={(e) => props.onReason(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-gym-border bg-gym-navy/70 px-3 py-2 text-sm text-white" placeholder="Motivo" />
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={!!props.busy || props.reason.trim().length < 3} className="rounded-xl border border-status-err/50 px-3 py-2 text-xs font-semibold text-status-err disabled:opacity-40" onClick={() => props.onSend("anular", { reason: props.reason.trim() })}>
              Anular membresía
            </button>
            <button type="button" className="rounded-xl border border-gym-border px-3 py-2 text-xs text-gym-muted" onClick={props.onClose}>Cerrar</button>
          </div>
        </div>
      )}

      {props.showHistory && (
        <div className="mt-4 border-t border-gym-border/50 pt-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gym-muted">Historial</div>
          {s.historial.length === 0 && <p className="text-xs text-gym-muted">Aún no hay planes en esta ficha.</p>}
          <ul className="space-y-2">
            {s.historial.map((h) => (
              <li key={h.id} className="rounded-xl border border-gym-border/50 px-3 py-2 text-xs">
                <div className="font-semibold text-white">{h.id === m?.id ? "Actual · " : "Anterior · "}{h.planName}</div>
                <div className="text-gym-silver">{fecha(h.startsOn)} → {fecha(h.endsOn)} · {cop(h.price)}</div>
                <div className="text-gym-muted">{h.live === "cancelada" ? `Anulada${h.cancelReason ? ` · ${h.cancelReason}` : ""}` : pago(h)}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
