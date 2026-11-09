"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cop } from "../lib/money";

export type VistaLibro = "invitaciones" | "actividad";
type Socio = { id: string; nombre: string; docTipo: string; docNumero: string; codigoPais: string; celular: string };
type Invitado = { id: string; guestName: string; guestDoc: string; status: string; createdAt?: string; expiresAt?: string; entryVia?: string | null; usedAt?: string | null; enrolledAt?: string | null; creditsLeftAfter?: number | null };
type Acceso = { id: string; at: string | null; ok: boolean; reason: string; detail: string; match: number | null; liveness: number | null; livenessMode: string | null; door: boolean };
type Plan = { id: string; planName: string; kind: string; startsOn: string; endsOn: string; live: string; createdAt?: string; price: number; method?: string | null; payState?: string | null; cancelReason?: string | null; creditsTotal?: number | null; creditsLeft?: number | null };
type Libro = { socio: Socio; accesos: Acceso[]; membresias: Plan[]; invitaciones: Invitado[] };

function cuando(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const hora = d.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
  if (dia === hoy) return `Hoy · ${hora}`;
  const fecha = d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" });
  return `${fecha} · ${hora}`;
}

function phone(s: Socio) {
  const d = `${s.codigoPais}${s.celular}`.replace(/[^\d]/g, "");
  if (d.length >= 12 && d.startsWith("57")) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`.trim();
  return d ? `+${d}` : "—";
}

function pct(v: number | null) {
  if (v == null) return "—";
  return `${Math.round(v * 100)}%`;
}

function estadoInvitacion(g: Invitado) {
  if (g.status === "cancelled") return "Anulada";
  if (g.status === "expired") return "Venció sin usarse";
  if (g.status === "used" && g.entryVia === "pin") return "Ingresó con PIN";
  if (g.status === "used") return "Ingresó con el rostro";
  if (g.enrolledAt) return "Rostro registrado, sin ingreso";
  return "Enlace enviado, sin registro";
}

function grupoInvitacion(g: Invitado) {
  if (g.status === "cancelled") return "anuladas";
  if (g.status === "expired") return "vencidas";
  if (g.status === "used") return "usadas";
  return "pendientes";
}

function estadoPlan(live: string) {
  if (live === "activa") return "Activa";
  if (live === "vencida") return "Vencida";
  if (live === "cancelada") return "Cancelada";
  if (live === "suspendida") return "Suspendida";
  return live || "—";
}

function pagoTexto(m: Plan) {
  const via = m.method === "efectivo" ? "Efectivo" : m.method === "tarjeta" ? "Tarjeta" : m.method === "transferencia" ? "Transferencia" : m.method === "wompi" ? "Wompi" : "";
  const estado = m.payState === "pagada" ? "Pagada" : m.payState === "pendiente" ? "Pago pendiente" : "Sin cobro registrado";
  return via ? `${estado} · ${via}` : estado;
}

function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${on ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{children}</button>
  );
}

export default function ClienteLibro({ id, gymId, vista, onVista, onClose }: {
  id: string;
  gymId: string;
  vista: VistaLibro;
  onVista: (vista: VistaLibro) => void;
  onClose?: () => void;
}) {
  const [libro, setLibro] = useState<Libro | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [invF, setInvF] = useState("todas");
  const [puertaF, setPuertaF] = useState("todas");

  useEffect(() => { setQ(""); }, [vista]);

  useEffect(() => {
    if (!id) return;
    let stop = false;
    setError("");
    setLibro(null);
    fetch(`/api/socios/actividad?gym=${encodeURIComponent(gymId)}&id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (stop) return;
        if (!d.ok) setError("No está esta ficha en la sede.");
        else setLibro(d);
      })
      .catch(() => { if (!stop) setError("No se pudo cargar el historial."); });
    return () => { stop = true; };
  }, [id, gymId]);

  const needle = q.trim().toLowerCase();
  const invitados = useMemo(() => {
    return (libro?.invitaciones || []).filter((g) => {
      if (invF !== "todas" && grupoInvitacion(g) !== invF) return false;
      return !needle || `${g.guestName} ${g.guestDoc} ${estadoInvitacion(g)}`.toLowerCase().includes(needle);
    });
  }, [libro, invF, needle]);
  const puerta = useMemo(() => {
    return (libro?.accesos || []).filter((a) => {
      if (puertaF === "concedidos" && !a.ok) return false;
      if (puertaF === "denegados" && a.ok) return false;
      return !needle || `${a.detail} ${a.reason}`.toLowerCase().includes(needle);
    });
  }, [libro, puertaF, needle]);
  const planes = useMemo(() => {
    return (libro?.membresias || []).filter((m) => !needle || `${m.planName} ${estadoPlan(m.live)} ${pagoTexto(m)} ${m.cancelReason || ""}`.toLowerCase().includes(needle));
  }, [libro, needle]);

  const socio = libro?.socio;
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gym-border/60 bg-gym-navy px-5 py-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">{vista === "invitaciones" ? "Historial de invitaciones" : "Historial de actividad"}</h1>
          <p className="mt-1 text-sm text-gym-muted">
            {socio ? `${socio.nombre} · ${socio.docTipo} ${socio.docNumero || "sin documento"} · ${phone(socio)}` : id ? "Cargando la ficha…" : "Falta el cliente."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={vista === "invitaciones"} onClick={() => onVista("invitaciones")}>Invitaciones{libro ? ` · ${libro.invitaciones.length}` : ""}</Chip>
          <Chip on={vista === "actividad"} onClick={() => onVista("actividad")}>Actividad{libro ? ` · ${libro.accesos.length + libro.membresias.length}` : ""}</Chip>
          {onClose ? (
            <button type="button" onClick={onClose} className="rounded-xl border border-gym-border bg-gym-navy px-4 py-2 text-sm font-semibold text-white">Cerrar</button>
          ) : (
            <a href={id ? `/clientes?socio=${encodeURIComponent(id)}` : "/clientes"} className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-white">Volver a la ficha</a>
          )}
        </div>
      </div>

      {error && <p className="rounded-xl border border-status-err/40 bg-status-err/10 px-4 py-3 text-sm text-status-err">{error}</p>}
      {!error && !libro && id && <p className="text-sm text-gym-muted">Cargando el historial…</p>}

      {libro && vista === "invitaciones" && (
        <section className="overflow-hidden rounded-2xl border border-gym-border/70 bg-black/20">
          <div className="flex flex-wrap items-center gap-2 border-b border-gym-border/60 px-4 py-3">
            <Chip on={invF === "todas"} onClick={() => setInvF("todas")}>Todas</Chip>
            <Chip on={invF === "pendientes"} onClick={() => setInvF("pendientes")}>Sin usar</Chip>
            <Chip on={invF === "usadas"} onClick={() => setInvF("usadas")}>Ingresaron</Chip>
            <Chip on={invF === "vencidas"} onClick={() => setInvF("vencidas")}>Vencidas</Chip>
            <Chip on={invF === "anuladas"} onClick={() => setInvF("anuladas")}>Anuladas</Chip>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o documento" className="ml-auto w-full rounded-lg border border-gym-border bg-gym-navy px-3 py-1.5 text-xs text-white sm:w-64" />
          </div>
          {invitados.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gym-muted">{libro.invitaciones.length === 0 ? "Esta ficha no tiene invitaciones." : "Ninguna invitación coincide con el filtro."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead className="sticky top-0 bg-gym-navy text-[10px] uppercase tracking-wider text-gym-muted">
                  <tr>
                    <th className="px-4 py-3 font-bold">#</th>
                    <th className="px-4 py-3 font-bold">Invitado</th>
                    <th className="px-4 py-3 font-bold">Documento</th>
                    <th className="px-4 py-3 font-bold">Estado</th>
                    <th className="px-4 py-3 font-bold">Creada</th>
                    <th className="px-4 py-3 font-bold">Rostro</th>
                    <th className="px-4 py-3 font-bold">Ingreso</th>
                    <th className="px-4 py-3 font-bold">Cupos después</th>
                  </tr>
                </thead>
                <tbody>
                  {invitados.map((g, i) => (
                    <tr key={g.id} className="border-t border-gym-border/40 text-gym-silver">
                      <td className="px-4 py-3 text-gym-muted">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-white">{g.guestName}</td>
                      <td className="px-4 py-3">{g.guestDoc || "—"}</td>
                      <td className="px-4 py-3">{estadoInvitacion(g)}</td>
                      <td className="px-4 py-3">{cuando(g.createdAt)}</td>
                      <td className="px-4 py-3">{g.enrolledAt ? cuando(g.enrolledAt) : "Sin registro"}</td>
                      <td className="px-4 py-3">{g.usedAt ? cuando(g.usedAt) : "Sin ingreso"}{g.expiresAt ? <span className="block text-[11px] text-gym-muted">Vence {cuando(g.expiresAt)}</span> : null}</td>
                      <td className="px-4 py-3">{g.creditsLeftAfter == null ? "Aún no se descontó" : g.creditsLeftAfter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-gym-border/50 px-4 py-3 text-[11px] text-gym-muted">{invitados.length} de {libro.invitaciones.length} invitaciones de esta ficha. El PIN no se muestra.</p>
        </section>
      )}

      {libro && vista === "actividad" && (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-gym-border/70 bg-black/20">
            <div className="flex flex-wrap items-center gap-2 border-b border-gym-border/60 px-4 py-3">
              <h2 className="mr-2 text-sm font-bold text-white">Puerta</h2>
              <Chip on={puertaF === "todas"} onClick={() => setPuertaF("todas")}>Todas</Chip>
              <Chip on={puertaF === "concedidos"} onClick={() => setPuertaF("concedidos")}>Concedidos</Chip>
              <Chip on={puertaF === "denegados"} onClick={() => setPuertaF("denegados")}>Denegados</Chip>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Motivo" className="ml-auto w-full rounded-lg border border-gym-border bg-gym-navy px-3 py-1.5 text-xs text-white sm:w-64" />
            </div>
            {puerta.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gym-muted">{libro.accesos.length === 0 ? "Esta ficha no tiene intentos en la puerta." : "Ningún intento coincide con el filtro."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-gym-navy text-[10px] uppercase tracking-wider text-gym-muted">
                    <tr>
                      <th className="px-4 py-3 font-bold">#</th>
                      <th className="px-4 py-3 font-bold">Cuándo</th>
                      <th className="px-4 py-3 font-bold">Resultado</th>
                      <th className="px-4 py-3 font-bold">Motivo</th>
                      <th className="px-4 py-3 font-bold">Coincidencia</th>
                      <th className="px-4 py-3 font-bold">Prueba de vida</th>
                      <th className="px-4 py-3 font-bold">Puerta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puerta.map((a, i) => (
                      <tr key={a.id || `${a.at}-${i}`} className="border-t border-gym-border/40 text-gym-silver">
                        <td className="px-4 py-3 text-gym-muted">{i + 1}</td>
                        <td className="px-4 py-3">{cuando(a.at)}</td>
                        <td className={`px-4 py-3 font-semibold ${a.ok ? "text-status-ok" : "text-status-err"}`}>{a.ok ? "Concedido" : "Denegado"}</td>
                        <td className="px-4 py-3">{a.detail}<span className="block text-[11px] text-gym-muted">{a.reason || "—"}</span></td>
                        <td className="px-4 py-3">{pct(a.match)}</td>
                        <td className="px-4 py-3">{a.livenessMode === "UNAVAILABLE" ? "No medida" : pct(a.liveness)}</td>
                        <td className="px-4 py-3">{a.door ? "Apertura ordenada" : a.ok ? "Sin orden de apertura" : "No se abrió"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-gym-border/50 px-4 py-3 text-[11px] text-gym-muted">{puerta.length} de {libro.accesos.length} intentos. La puerta conserva los últimos 500 de esta ficha.</p>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gym-border/70 bg-black/20">
            <div className="border-b border-gym-border/60 px-4 py-3">
              <h2 className="text-sm font-bold text-white">Membresías · {planes.length}</h2>
            </div>
            {planes.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-gym-muted">{libro.membresias.length === 0 ? "Esta ficha no tiene membresías." : "Ningún plan coincide con la búsqueda."}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-gym-navy text-[10px] uppercase tracking-wider text-gym-muted">
                    <tr>
                      <th className="px-4 py-3 font-bold">#</th>
                      <th className="px-4 py-3 font-bold">Plan</th>
                      <th className="px-4 py-3 font-bold">Estado</th>
                      <th className="px-4 py-3 font-bold">Vigencia</th>
                      <th className="px-4 py-3 font-bold">Cobro</th>
                      <th className="px-4 py-3 font-bold">Ingresos</th>
                      <th className="px-4 py-3 font-bold">Registrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planes.map((m, i) => (
                      <tr key={m.id} className="border-t border-gym-border/40 text-gym-silver">
                        <td className="px-4 py-3 text-gym-muted">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-white">{m.planName}<span className="block text-[11px] font-normal text-gym-muted">{m.kind === "tiquetera" ? "Tiquetera" : "Membresía"}</span></td>
                        <td className={`px-4 py-3 font-semibold ${m.live === "activa" ? "text-status-ok" : m.live === "suspendida" ? "text-status-warn" : "text-status-err"}`}>{estadoPlan(m.live)}{m.cancelReason ? <span className="block text-[11px] font-normal text-gym-muted">{m.cancelReason}</span> : null}</td>
                        <td className="px-4 py-3">{m.startsOn} → {m.endsOn}</td>
                        <td className="px-4 py-3">{pagoTexto(m)}{m.price ? <span className="block text-[11px] text-gym-muted">{cop(m.price)}</span> : null}</td>
                        <td className="px-4 py-3">{m.creditsTotal == null ? "—" : `${m.creditsLeft ?? 0} de ${m.creditsTotal}`}</td>
                        <td className="px-4 py-3">{cuando(m.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
