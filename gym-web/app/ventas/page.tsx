"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

type Medio = "efectivo" | "tarjeta" | "transferencia" | "mixto" | "wompi";
type Estado = "todas" | "pagada" | "anulada";
type Rango = "hoy" | "ayer" | "7" | "30" | "fechas";

type Item = { name: string; sku: string; qty: number; price: number; lineTotal: number };
type Pay = { method: string; amount: number };
type Sale = {
  id: string;
  number: number;
  createdAt: string;
  items: Item[];
  subtotal: number;
  discount: number;
  total: number;
  payments: Pay[];
  change: number;
  note: string;
  status: "pagada" | "anulada";
  cashier: string;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  dian?: { cufe?: string; consecutivo?: string } | null;
  medio: Medio;
  turno: "abierto" | "cerrado" | "sin_turno";
};
type Summary = {
  tickets: number;
  anuladas: number;
  total: number;
  discount: number;
  medios: { efectivo: number; tarjeta: number; transferencia: number; wompi: number };
};

const MEDIO: Record<Medio, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  mixto: "Mixto",
  wompi: "Wompi",
};
const PAGE = 40;

function hoyBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

function sumarDias(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function rangoDe(r: Rango, desde: string, hasta: string) {
  const hoy = hoyBogota();
  if (r === "ayer") {
    const ayer = sumarDias(hoy, -1);
    return { from: ayer, to: ayer };
  }
  if (r === "7") return { from: sumarDias(hoy, -6), to: hoy };
  if (r === "30") return { from: sumarDias(hoy, -29), to: hoy };
  if (r === "fechas") {
    const a = desde || hoy;
    const b = hasta || a;
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  return { from: hoy, to: hoy };
}

function hora(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function fechaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(new Date(iso));
}

function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function diaDe(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso));
}

function resumenItems(items: Item[]) {
  if (!items.length) return "Sin artículos";
  const head = items.slice(0, 2).map((i) => `${i.qty} ${i.name}`);
  const rest = items.length - head.length;
  return rest > 0 ? `${head.join(", ")} y ${rest} más` : head.join(", ");
}

function pagoTexto(s: Sale) {
  if (s.medio === "wompi") return "Wompi";
  if (s.medio === "mixto") return s.payments.map((p) => `${MEDIO[p.method as Medio] || p.method} ${cop(p.amount)}`).join(" + ");
  return MEDIO[s.medio];
}

export default function VentasPage() {
  const [gymId, setGymId] = useState("");
  const [rango, setRango] = useState<Rango>("hoy");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<Estado>("todas");
  const [medio, setMedio] = useState<"todos" | Medio>("todos");
  const [items, setItems] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [porNumero, setPorNumero] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Sale | null>(null);
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [aviso, setAviso] = useState("");

  const bounds = useMemo(() => rangoDe(rango, desde, hasta), [rango, desde, hasta]);

  const load = useCallback(async (id: string, b: { from: string; to: string }, query: string, est: Estado, med: string) => {
    setError("");
    const p = new URLSearchParams({ gym: id, historial: "1", from: b.from, to: b.to, estado: est, medio: med });
    if (query.trim()) p.set("q", query.trim());
    const r = await fetch(`/api/retail/sales?${p}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) {
      setError("No se pudo leer el historial de ventas.");
      setListo(true);
      return;
    }
    const rows = (d.items || []) as Sale[];
    setItems(rows);
    setSummary(d.summary || null);
    setTotalCount(d.totalCount || rows.length);
    setPorNumero(!!d.porNumero);
    setListo(true);
    setSel((cur) => (cur ? rows.find((s) => s.id === cur.id) || cur : null));
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    const params = new URLSearchParams(window.location.search);
    const ticket = params.get("ticket") || "";
    if (ticket) setQ(ticket);
  }, []);

  useEffect(() => {
    if (!gymId) return;
    const t = window.setTimeout(() => {
      setPage(0);
      load(gymId, bounds, q, estado, medio);
    }, 180);
    return () => window.clearTimeout(t);
  }, [gymId, bounds, q, estado, medio, load]);

  useEffect(() => {
    if (!q || !/^\d+$/.test(q.trim()) || !items.length) return;
    const hit = items.find((s) => String(s.number) === q.trim());
    if (hit) setSel(hit);
  }, [items, q]);

  const slice = items.slice(page * PAGE, page * PAGE + PAGE);
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  const hoy = hoyBogota();

  function puedeAnular(s: Sale) {
    return s.status === "pagada" && diaDe(s.createdAt) === hoy && s.turno !== "cerrado";
  }

  async function anular() {
    if (!sel || !puedeAnular(sel)) return;
    const reason = motivo.trim();
    if (!reason) {
      setAviso("Escribe el motivo de la anulación.");
      return;
    }
    setAnulando(true);
    setAviso("");
    const res = await fetch("/api/retail/sales", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, id: sel.id, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setAnulando(false);
    if (!data.ok) {
      const err = String(data.error || "");
      setAviso(err === "solo_hoy" ? "Solo se anulan ventas de hoy." : err === "turno_cerrado" ? "Esa venta es de un turno ya cerrado." : err === "motivo_requerido" ? "Escribe el motivo de la anulación." : err || "No se pudo anular.");
      return;
    }
    setMotivo("");
    setAviso(`Venta ${sel.number} anulada. El stock de mostrador volvió al gimnasio.`);
    load(gymId, bounds, q, estado, medio);
  }

  function imprimir() {
    window.print();
  }

  return (
    <GymShell active="ventas">
      <div className="px-6 py-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gym-muted">Buscar</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Número de ticket, producto, cajero o nota"
              className="w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-gym-silver outline-none focus:border-gym-primary"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              ["hoy", "Hoy"],
              ["ayer", "Ayer"],
              ["7", "7 días"],
              ["30", "30 días"],
              ["fechas", "Elegir fechas"],
            ] as [Rango, string][]).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setRango(id)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${rango === id ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
            ))}
          </div>
        </div>

        {rango === "fechas" && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-gym-muted">
              Desde
              <input type="date" value={desde} max={hoy} onChange={(e) => setDesde(e.target.value)} className="mt-1 block rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-gym-silver" />
            </label>
            <label className="text-xs text-gym-muted">
              Hasta
              <input type="date" value={hasta} max={hoy} onChange={(e) => setHasta(e.target.value)} className="mt-1 block rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-gym-silver" />
            </label>
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {(["todas", "pagada", "anulada"] as Estado[]).map((id) => (
            <button key={id} type="button" onClick={() => setEstado(id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${estado === id ? "bg-white/10 text-white" : "text-gym-muted"}`}>
              {id === "todas" ? "Todas" : id === "pagada" ? "Cobradas" : "Anuladas"}
            </button>
          ))}
          <span className="mx-1 hidden h-4 w-px self-center bg-gym-border sm:block" />
          {(["todos", "efectivo", "tarjeta", "transferencia", "wompi", "mixto"] as const).map((id) => (
            <button key={id} type="button" onClick={() => setMedio(id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${medio === id ? "bg-white/10 text-white" : "text-gym-muted"}`}>
              {id === "todos" ? "Todos los medios" : MEDIO[id]}
            </button>
          ))}
        </div>

        <p className="mb-4 text-[11px] text-gym-muted">
          {porNumero
            ? "La búsqueda por número recorre todo el historial, sin límite de fecha."
            : `Del ${bounds.from} al ${bounds.to}. El cobrado suma solo tickets pagados. Una anulación no entra en ese total. Wompi no entra al cajón.`}
        </p>

        {error && <div className="mb-4 rounded-xl border border-status-err/40 bg-status-err/10 px-4 py-2 text-sm text-status-err">{error}</div>}

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            ["Cobradas", String(summary?.tickets ?? 0)],
            ["Cobrado", cop(summary?.total || 0)],
            ["Efectivo", cop(summary?.medios.efectivo || 0)],
            ["Tarjeta", cop(summary?.medios.tarjeta || 0)],
            ["Transferencia", cop(summary?.medios.transferencia || 0)],
            ["Wompi", cop(summary?.medios.wompi || 0)],
          ].map(([l, v]) => (
            <div key={l} className="glass-soft px-4 py-3">
              <div className="text-[11px] text-gym-muted">{l}</div>
              <div className="text-lg font-extrabold text-white">{v}</div>
            </div>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-4 text-xs text-gym-muted">
          <span>Anuladas {summary?.anuladas ?? 0}</span>
          <span>Descuentos {cop(summary?.discount || 0)}</span>
          {totalCount > items.length && <span>Se muestran las {items.length} más recientes de {totalCount}.</span>}
        </div>

        <div className="glass overflow-hidden">
          <div className="hidden grid-cols-[4.5rem_7rem_minmax(0,1.4fr)_9rem_6.5rem_7rem_6rem] gap-3 border-b border-gym-border/60 px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-gym-muted lg:grid">
            <span>Ticket</span><span>Fecha</span><span>Qué se vendió</span><span>Pago</span><span>Estado</span><span>Cajero</span><span className="text-right">Total</span>
          </div>
          {!listo && <p className="px-4 py-8 text-sm text-gym-muted">Leyendo ventas…</p>}
          {listo && items.length === 0 && (
            <p className="px-4 py-8 text-sm text-gym-muted">{porNumero ? "No hay un ticket con ese número." : "No hay ventas en este rango."}</p>
          )}
          <ul className="divide-y divide-gym-border/50">
            {slice.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => { setSel(s); setMotivo(""); setAviso(""); }} className={`grid w-full gap-1 px-4 py-3 text-left hover:bg-white/[0.03] lg:grid-cols-[4.5rem_7rem_minmax(0,1.4fr)_9rem_6.5rem_7rem_6rem] lg:items-center lg:gap-3 ${s.status === "anulada" ? "opacity-70" : ""}`}>
                  <span className="text-base font-extrabold text-white">#{s.number}{s.dian?.consecutivo ? <span className="mt-0.5 block text-[10px] font-semibold text-status-ok">{s.dian.consecutivo}</span> : null}</span>
                  <span className="text-xs text-gym-silver">{fechaCorta(s.createdAt)}<span className="block text-gym-muted">{hora(s.createdAt)}</span></span>
                  <span className="truncate text-sm text-gym-silver">{resumenItems(s.items)}</span>
                  <span className="text-xs text-gym-silver">{pagoTexto(s)}</span>
                  <span className={`text-xs font-semibold ${s.status === "anulada" ? "text-status-err" : "text-status-ok"}`}>{s.status === "anulada" ? "Anulada" : "Cobrada"}</span>
                  <span className="truncate text-xs text-gym-muted">{s.cashier || "—"}</span>
                  <span className={`text-sm font-bold lg:text-right ${s.status === "anulada" ? "text-gym-muted line-through" : "text-white"}`}>{cop(s.total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-xs text-gym-muted">
            <span>{page * PAGE + 1}–{Math.min(items.length, (page + 1) * PAGE)} de {items.length}</span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gym-border px-3 py-1 disabled:opacity-40">Anterior</button>
              <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gym-border px-3 py-1 disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {sel && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 print:static print:bg-white" onClick={() => setSel(null)}>
          <div id="ticket-print" className="glass max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 print:max-h-none print:overflow-visible print:bg-white print:text-black" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-white print:text-black">Ticket #{sel.number}</h2>
                <p className="text-xs text-gym-muted print:text-neutral-600">{fechaLarga(sel.createdAt)} · {sel.status === "anulada" ? "Anulada" : "Cobrada"}</p>
              </div>
              <button type="button" onClick={() => setSel(null)} className="rounded-lg border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver print:hidden">Cerrar</button>
            </div>

            {sel.status === "anulada" && (
              <p className="mt-3 rounded-xl border border-status-err/30 bg-status-err/10 px-3 py-2 text-xs text-status-err">
                Anulada{sel.voidedBy ? ` por ${sel.voidedBy}` : ""}{sel.voidedAt ? ` · ${fechaLarga(sel.voidedAt)}` : ""}{sel.voidReason ? ` · ${sel.voidReason}` : ""}
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2 text-sm">
              {sel.items.map((i, n) => (
                <div key={n} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-white print:text-black">{i.qty} × {i.name}</div>
                    <div className="text-[11px] text-gym-muted">{i.sku} · {cop(i.price)}</div>
                  </div>
                  <div className="font-semibold text-white print:text-black">{cop(i.lineTotal)}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-1 border-t border-gym-border/60 pt-3 text-sm">
              <div className="flex justify-between text-gym-muted"><span>Subtotal</span><span>{cop(sel.subtotal)}</span></div>
              {sel.discount > 0 && <div className="flex justify-between text-gym-muted"><span>Descuento</span><span>−{cop(sel.discount)}</span></div>}
              <div className="flex justify-between text-base font-extrabold text-white print:text-black"><span>Total</span><span>{cop(sel.total)}</span></div>
            </div>

            <div className="mt-3 text-sm text-gym-silver">
              {sel.payments.map((p, n) => (
                <div key={n} className="flex justify-between"><span>{p.method === "tarjeta" && sel.medio === "wompi" ? "Wompi" : MEDIO[p.method as Medio] || p.method}</span><span>{cop(p.amount)}</span></div>
              ))}
              {sel.change > 0 && <div className="mt-1 text-status-ok">Cambio {cop(sel.change)}</div>}
            </div>

            <p className="mt-3 text-xs text-gym-muted">Cajero {sel.cashier || "—"}{sel.note ? ` · ${sel.note}` : ""}{sel.turno === "sin_turno" ? " · Sin turno de caja" : sel.turno === "cerrado" ? " · Turno cerrado" : " · Turno abierto"}</p>

            {aviso && <p className="mt-3 text-xs text-status-warn print:hidden">{aviso}</p>}

            {puedeAnular(sel) && (
              <div className="mt-4 print:hidden">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-gym-muted">
                  Motivo de anulación
                  <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por qué se anula este ticket" className="mt-1 w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gym-silver outline-none focus:border-gym-primary" />
                </label>
                <button type="button" disabled={anulando} onClick={anular} className="mt-2 text-xs font-semibold text-status-err disabled:opacity-50">{anulando ? "Anulando…" : "Anular y devolver stock"}</button>
              </div>
            )}
            {sel.status === "pagada" && !puedeAnular(sel) && (
              <p className="mt-3 text-[11px] text-gym-muted print:hidden">
                {diaDe(sel.createdAt) !== hoy ? "Las ventas de otros días quedan en el historial. Solo se anula una venta de hoy." : "Esa venta es de un turno ya cerrado."}
              </p>
            )}

            <div className="mt-4 flex gap-2 print:hidden">
              <button type="button" onClick={imprimir} className="btn-gym flex-1">Imprimir</button>
              <button type="button" onClick={() => setSel(null)} className="flex-1 rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@media print { body * { visibility: hidden !important; } #ticket-print, #ticket-print * { visibility: visible !important; } #ticket-print { position: absolute; inset: 0; background: white; color: black; } }`}</style>
    </GymShell>
  );
}
