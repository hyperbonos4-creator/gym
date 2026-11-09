"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ClienteLibro, { type VistaLibro } from "../../components/ClienteLibro";
import GymShell from "../../components/GymShell";
import SocioForm, { clearClienteDraft } from "../../components/SocioForm";
import { getActiveGymId } from "../../lib/session";

type Facial = { hasBiometrics: boolean; templateCount: number; hasPortrait: boolean; hasConsent: boolean; lastAccessAt: string | null };
type Cliente = {
  id: string;
  nombre: string;
  docTipo: string;
  docNumero: string;
  fechaNac: string;
  genero: string;
  codigoPais: string;
  celular: string;
  email: string;
  enviarEmails: boolean;
  direccion: string;
  prospecto: boolean;
  empresa: string;
  contactoRespaldoNombre: string;
  contactoRespaldoTel: string;
  observaciones: string;
  estado: "pendiente_enrolamiento" | "enrolado";
  enrollLink: string;
  rol?: "miembro" | "invitado";
  invitaNombre?: string;
  createdAt: string;
  facial: Facial;
};
type Memb = { planName: string; endsOn: string; live: string; days: number; kind?: string; startsOn?: string; createdAt?: string; validUntil?: string; creditsLeft?: number; creditsTotal?: number } | null;
type Ultimo = { at: string; ok: boolean; detail: string } | null;
type Pase = { planName: string; creditsLeft: number; creditsTotal: number; endsOn: string; live: string } | null;
type Invitado = { id: string; guestName: string; guestDoc: string; status: string; createdAt?: string; expiresAt?: string; entryVia?: string | null; usedAt?: string | null; enrolledAt?: string | null; ownerName?: string; creditsLeftAfter?: number | null; settled?: boolean };
type AccesoAudit = { id: string; at: string | null; ok: boolean; decision: string; reason: string; detail: string; match: number | null; liveness: number | null; livenessMode: string | null; door: boolean };
type MembAudit = { id: string; planName: string; kind: string; startsOn: string; endsOn: string; live: string; createdAt?: string; price: number; method?: string | null; payState?: string | null; cancelReason?: string | null; creditsTotal?: number | null; creditsLeft?: number | null };
type Libro = { accesos: AccesoAudit[]; membresias: MembAudit[]; invitaciones: Invitado[] };
type Fila = { membresia: Memb; ultimo: Ultimo; pase?: Pase; invitados?: Invitado[] };
type Filtro = "todos" | "miembros" | "invitados" | "entrar" | "rostro" | "vencer" | "vencidos" | "nunca";

function phone(s: Pick<Cliente, "codigoPais" | "celular">) {
  const d = `${s.codigoPais}${s.celular}`.replace(/[^\d]/g, "");
  if (d.length >= 12 && d.startsWith("57")) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`.trim();
  return d ? `+${d}` : "—";
}

function diaBogota(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function cuando(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = diaBogota(new Date().toISOString());
  const hora = d.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
  if (diaBogota(iso) === hoy) return `Hoy · ${hora}`;
  const fecha = d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
  return `${fecha} · ${hora}`;
}

function ultimoDe(c: Cliente, fila?: Fila): Ultimo {
  if (fila?.ultimo?.at) return fila.ultimo;
  if (c.facial.lastAccessAt) return { at: c.facial.lastAccessAt, ok: true, detail: "" };
  return null;
}

function venceTexto(m: Memb) {
  if (!m || m.live !== "activa") return null;
  if (m.days === 0 && m.validUntil) {
    const hora = new Date(m.validUntil).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" });
    return `Vence hoy · ${hora}`;
  }
  if (m.days === 0) return "Vence hoy";
  if (m.days === 1) return "Vence mañana";
  return `Vence en ${m.days} días`;
}

function estadoMembresia(c: Cliente, fila?: Fila) {
  if (c.rol === "invitado") return { label: "Invitado", tone: "warn" as const, plan: c.invitaNombre ? `De ${c.invitaNombre}` : "Visita" };
  const m = fila?.membresia;
  if (!m) return { label: "Sin membresía", tone: "muted" as const, plan: "Sin plan" };
  if (m.live === "activa") return { label: "Activa", tone: "ok" as const, plan: m.planName };
  if (m.live === "vencida") return { label: "Vencida", tone: "err" as const, plan: m.planName };
  if (m.live === "suspendida") return { label: "Suspendida", tone: "warn" as const, plan: m.planName };
  if (m.live === "cancelada") return { label: "Anulada", tone: "err" as const, plan: m.planName };
  return { label: m.live, tone: "muted" as const, plan: m.planName };
}

function lectura(c: Cliente, fila: Fila | undefined) {
  const rostro = c.facial.hasBiometrics;
  if (c.rol === "invitado") {
    return {
      tone: (rostro ? "ok" : "warn") as "ok" | "warn",
      titulo: rostro ? "Invitado" : "Registro pendiente",
      why: `Invitado de ${c.invitaNombre || "un titular"}`,
      puede: false,
      listo: false,
      atencion: !rostro,
      rostro,
      venceHoy: false,
      porVencer: false,
      vencida: false,
    };
  }
  const m = fila?.membresia ?? null;
  const live = m?.live;
  const puede = rostro && live === "activa";
  const venceHoy = !!(puede && m && m.days === 0);
  const porVencer = !!(puede && m && m.days >= 0 && m.days <= 3);
  let tone: "ok" | "warn" | "err" = "err";
  let titulo = "No puede entrar";
  let why = "Sin membresía";
  if (!fila) {
    return { tone: "warn" as const, titulo: "Consultando", why: "Revisando membresía", puede: false, listo: false, atencion: false, rostro, venceHoy: false, porVencer: false, vencida: false };
  }
  if (live === "suspendida") why = "Acceso suspendido";
  else if (live === "cancelada") why = "Membresía anulada";
  else if (live === "vencida") why = "Membresía vencida";
  else if (!rostro && live === "activa") { tone = "warn"; titulo = "Requiere atención"; why = "Rostro no registrado"; }
  else if (!rostro) why = "Rostro pendiente y sin membresía vigente";
  else if (puede && venceHoy) { tone = "warn"; titulo = "Requiere atención"; why = "Membresía vence hoy"; }
  else if (puede && porVencer && m) { tone = "warn"; titulo = "Requiere atención"; why = m.days === 1 ? "Membresía vence mañana" : `Membresía vence en ${m.days} días`; }
  else if (puede) { tone = "ok"; titulo = "Puede entrar"; why = "Rostro, membresía y sede válidos"; }
  const listo = tone === "ok";
  return {
    tone, titulo, why, puede, listo,
    atencion: tone !== "ok",
    rostro, venceHoy, porVencer,
    vencida: live === "vencida",
  };
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function FaceThumb({ cliente, size, bust }: { cliente: Cliente; size: "sm" | "lg"; bust?: number }) {
  const cls = size === "lg" ? "h-16 w-16 text-lg" : "h-10 w-10 text-sm";
  if (cliente.facial.hasPortrait) {
    return (
      <img
        src={`/api/socios/portrait?id=${encodeURIComponent(cliente.id)}${bust ? `&t=${bust}` : ""}`}
        alt=""
        className={`${cls} shrink-0 rounded-full object-cover ring-1 ring-gym-border`}
      />
    );
  }
  return (
    <div className={`grid ${cls} shrink-0 place-items-center rounded-full bg-gradient-to-br from-gym-primaryDeep to-gym-violet font-bold text-white`}>
      {cliente.nombre.charAt(0).toUpperCase()}
    </div>
  );
}


export default function ClientesPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [items, setItems] = useState<Cliente[]>([]);
  const [acceso, setAcceso] = useState<Record<string, Fila>>({});
  const [memOk, setMemOk] = useState(false);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [sel, setSel] = useState<Cliente | null>(null);
  const [actividad, setActividad] = useState<Libro | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editAviso, setEditAviso] = useState("");
  const [ventana, setVentana] = useState<VistaLibro | null>(null);
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);
  const [busy, setBusy] = useState<"face" | "archive" | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [photoBust, setPhotoBust] = useState(0);
  const openedFromLink = useRef(false);

  const load = useCallback(async (id: string) => {
    const [res, mem] = await Promise.all([
      fetch(`/api/socios?gym=${encodeURIComponent(id)}`, { cache: "no-store" }),
      fetch(`/api/memberships?gym=${encodeURIComponent(id)}`, { cache: "no-store" }),
    ]);
    const data = await res.json();
    const board = await mem.json().catch(() => null);
    setItems(data.items || []);
    const map: Record<string, Fila> = {};
    if (mem.ok && Array.isArray(board?.items)) {
      for (const row of board.items) {
        map[row.id] = { membresia: row.membresia || null, ultimo: row.ultimoAcceso || null, pase: row.pase || null, invitados: row.invitados || [] };
      }
      setMemOk(true);
    }
    setAcceso(map);
    setSel((prev) => {
      if (!prev) return null;
      return (data.items || []).find((s: Cliente) => s.id === prev.id) ?? null;
    });
  }, []);

  useEffect(() => {
    if (!sel) { setActividad(null); return; }
    let stop = false;
    fetch(`/api/socios/actividad?gym=${encodeURIComponent(gymId)}&id=${encodeURIComponent(sel.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!stop) setActividad(d.ok ? d : null); })
      .catch(() => { if (!stop) setActividad(null); });
    return () => { stop = true; };
  }, [sel?.id, gymId]);

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filtro");
    if (f === "todos" || f === "miembros" || f === "invitados" || f === "entrar" || f === "rostro" || f === "vencer" || f === "vencidos" || f === "nunca") setFiltro(f);
  }, []);

  useEffect(() => {
    if (openedFromLink.current || !items.length) return;
    const id = new URLSearchParams(window.location.search).get("socio");
    if (!id) return;
    const found = items.find((s) => s.id === id);
    if (!found) return;
    openedFromLink.current = true;
    setSel(found);
  }, [items]);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
    const t = setInterval(() => load(id), 8000);
    return () => clearInterval(t);
  }, [load]);

  const conLectura = useMemo(() => items.map((c) => ({ c, l: lectura(c, memOk ? acceso[c.id] || { membresia: null, ultimo: null } : undefined) })), [items, acceso, memOk]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return conLectura.filter(({ c, l }) => {
      if (s && ![c.nombre, c.docNumero, c.celular, c.email, c.id].some((v) => String(v || "").toLowerCase().includes(s))) return false;
      if (filtro === "miembros") return c.rol !== "invitado";
      if (filtro === "invitados") return c.rol === "invitado";
      if (filtro === "entrar") return l.puede;
      if (filtro === "rostro") return !l.rostro;
      if (filtro === "vencer") return l.porVencer;
      if (filtro === "vencidos") return l.vencida;
      if (filtro === "nunca") return memOk && !ultimoDe(c, acceso[c.id]);
      return true;
    });
  }, [conLectura, q, filtro, acceso, memOk]);

  const atencion = conLectura.filter(({ l }) => l.atencion);
  const registrados = items.length;
  const rostros = items.filter((c) => c.facial.hasBiometrics).length;
  const conAcceso = conLectura.filter(({ l }) => l.puede).length;

  async function resetFace() {
    if (!sel) return;
    if (!confirm("Se borra el rostro. El cliente no podrá entrar por reconocimiento hasta completar un enrolamiento nuevo. La ficha se queda.")) return;
    setBusy("face");
    setActionMsg("");
    try {
      const r = await fetch("/api/socios/face", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sel.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo borrar el rostro");
      setPhotoBust(Date.now());
      setActionMsg("Rostro borrado. Reenvía el enlace para enrolar otra vez.");
      await load(gymId);
    } catch (e: any) {
      setActionMsg(e?.message || "No se pudo borrar el rostro");
    } finally {
      setBusy(null);
    }
  }

  async function archiveCliente() {
    if (!sel) return;
    if (!confirm("Se desactiva este cliente en la sede. Deja de aparecer en la lista y su rostro ya no abre la puerta. La ficha queda archivada.")) return;
    setBusy("archive");
    setActionMsg("");
    try {
      const r = await fetch("/api/socios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sel.id }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo eliminar el cliente");
      setSel(null);
      await load(gymId);
    } catch (e: any) {
      setActionMsg(e?.message || "No se pudo eliminar el cliente");
    } finally {
      setBusy(null);
    }
  }

  async function reenviar() {
    if (!sel) return;
    if (!confirm(`Se avisará a ${sel.nombre} por WhatsApp para que abra la app y registre el rostro.`)) return;
    setResending(true);
    try {
      const r = await fetch("/api/socios/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sel.id, gym: gymId }),
      });
      const d = await r.json();
      if (d.link) setSel({ ...sel, enrollLink: d.link });
      await load(gymId);
    } finally {
      setResending(false);
    }
  }

  const selFila = sel ? (memOk ? acceso[sel.id] || { membresia: null, ultimo: null } : undefined) : undefined;
  const selL = sel ? lectura(sel, selFila) : null;
  const selM = selFila?.membresia ?? null;
  const selPase = selFila?.pase ?? null;
  const hechos = selL ? [true, selL.rostro, !!selL.puede].filter(Boolean).length : 0;
  const pct = Math.round((hechos / 3) * 100);
  const nInv = actividad?.invitaciones.length ?? 0;
  const nAct = (actividad?.accesos.length ?? 0) + (actividad?.membresias.length ?? 0);

  function salirFicha() {
    if (editing) {
      setEditAviso("Estás editando. Guardar cambios escribe la ficha. Cancelar descarta lo que no guardaste.");
      return;
    }
    setSel(null);
    setVentana(null);
    setActionMsg("");
    setEditAviso("");
  }

  function cancelarEdicion() {
    if (!sel) return;
    if (dirty && !window.confirm("Se pierden los cambios que no guardaste. La ficha queda como estaba.")) return;
    clearClienteDraft(sel.id);
    setEditing(false);
    setDirty(false);
    setEditAviso("");
  }

  return (
    <GymShell active="clientes">
      <div className="px-6 py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-xl text-sm text-gym-muted">Cada cliente tiene una ficha única. El registro facial se hace en el enrolamiento; no hace falta guardar una foto del documento.</p>
          <button onClick={() => { setCreating(true); setEditing(false); setSel(null); }} className="btn-gym shrink-0">+ Nuevo cliente</button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [String(registrados), "Clientes", "Registrados"],
            [String(rostros), "Enrolamiento", "Rostro registrado"],
            [memOk ? String(conAcceso) : "—", "Con acceso", "Pueden entrar"],
            [memOk ? String(atencion.length) : "—", "Pendientes", "Requieren acción"],
          ].map(([n, a, b]) => (
            <div key={a} className="glass px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">{a}</div>
              <div className="text-2xl font-extrabold text-white">{n}</div>
              <div className="text-[11px] text-gym-muted">{b}</div>
            </div>
          ))}
        </div>

        {creating && (
          <div className="glass mb-5 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Nuevo cliente</h3>
              <button onClick={() => setCreating(false)} className="text-xs text-gym-muted hover:text-gym-silver">Cerrar</button>
            </div>
            <SocioForm gymId={gymId} submitLabel="Registrar cliente y avisar en la app" onDone={() => { load(gymId); }} />
          </div>
        )}

        <div className="glass mb-4 p-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gym-muted">¿A quién estás buscando?</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, documento, celular o código..."
            className="mt-2 w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3.5 py-2.5 text-sm text-gym-silver outline-none focus:border-gym-primary" />
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              ["todos", `Todos ${registrados}`],
              ["miembros", `Miembros ${items.filter((c) => c.rol !== "invitado").length}`],
              ["invitados", `Invitados ${items.filter((c) => c.rol === "invitado").length}`],
              ["entrar", `Puede entrar ${memOk ? conAcceso : "—"}`],
              ["rostro", `Sin rostro ${items.filter((c) => !c.facial.hasBiometrics).length}`],
              ["vencer", `Por vencer ${memOk ? conLectura.filter(({ l }) => l.porVencer).length : "—"}`],
              ["vencidos", `Vencidos ${memOk ? conLectura.filter(({ l }) => l.vencida).length : "—"}`],
              ["nunca", "Sin acceso reciente"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFiltro(id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${filtro === id ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
            ))}
          </div>
        </div>

        <section className="glass overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8.5rem_9rem_3rem] gap-3 border-b border-gym-border/60 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gym-muted sm:grid">
            <span>Cliente</span>
            <span>Membresía</span>
            <span>Estado</span>
            <span>Último acceso</span>
            <span className="sr-only">Ficha</span>
          </div>
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-sm text-gym-muted">No hay clientes en este filtro.</p>
          ) : filtered.map(({ c, l }) => {
            const ultimo = ultimoDe(c, acceso[c.id]);
            const mem = estadoMembresia(c, acceso[c.id]);
            const tone = mem.tone === "ok" ? "bg-status-ok/15 text-status-ok" : mem.tone === "err" ? "bg-status-err/15 text-status-err" : mem.tone === "warn" ? "bg-status-warn/15 text-status-warn" : "bg-gym-navy/60 text-gym-muted";
            return (
              <div key={c.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-gym-border/40 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_8.5rem_9rem_3rem]">
                <div className="flex min-w-0 items-center gap-3">
                  <FaceThumb cliente={c} size="sm" bust={photoBust} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">{c.nombre}</div>
                    <div className="truncate text-[11px] text-gym-muted">{c.docTipo} {c.docNumero || "sin documento"} · {phone(c)}</div>
                  </div>
                </div>
                <div className="hidden min-w-0 sm:block">
                  <div className="truncate text-sm text-gym-silver">{mem.plan}</div>
                  <div className="truncate text-[11px] text-gym-muted">{l.rostro ? "Rostro registrado" : "Rostro pendiente"}{acceso[c.id]?.membresia?.kind === "tiquetera" ? ` · ${acceso[c.id]?.membresia?.creditsLeft ?? 0} de ${acceso[c.id]?.membresia?.creditsTotal ?? 0} ingresos` : acceso[c.id]?.pase ? ` · ${acceso[c.id].pase?.creditsLeft} invitaciones` : ""}</div>
                </div>
                <div className="hidden sm:block">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{mem.label}</span>
                </div>
                <div className="hidden text-xs text-gym-muted sm:block">{ultimo ? cuando(ultimo.at) : "Sin acceso"}</div>
                <button type="button" onClick={() => { setSel(c); setCreating(false); setEditing(false); setActionMsg(""); }} className="grid h-9 w-9 place-items-center justify-self-end rounded-full border border-gym-border text-gym-silver hover:border-gym-primary hover:text-gym-primary" aria-label={`Ver ficha de ${c.nombre}`}>
                  <EyeIcon />
                </button>
              </div>
            );
          })}
        </section>

        {sel && selL && (
          <div className="fixed inset-0 z-50 flex items-center bg-black/60 p-4 md:pl-[256px]" onClick={salirFicha}>
            <div className="flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-gym-border bg-gym-navy p-5 shadow-2xl" role="dialog" aria-modal="true" aria-label={`Ficha de ${sel.nombre}`} onClick={(e) => e.stopPropagation()}>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <FaceThumb cliente={sel} size="lg" bust={photoBust} />
                    <div className="min-w-0">
                      <h3 className="text-lg font-extrabold text-white">{sel.nombre}</h3>
                      <p className={`text-sm font-bold ${selL.listo ? "text-status-ok" : selL.puede ? "text-status-warn" : "text-status-err"}`}>
                        {selL.listo ? "Puede entrar" : selL.titulo}
                      </p>
                      <p className="text-[11px] text-gym-muted">{sel.docTipo} {sel.docNumero || "sin documento"}</p>
                      <p className="text-[11px] text-gym-muted">{phone(sel)}</p>
                    </div>
                  </div>
                  <button type="button" onClick={salirFicha} className="text-xs text-gym-muted" aria-label="Cerrar ficha">Cerrar</button>
                </div>

                <div className="mb-3 flex items-center gap-3">
                  {editing ? (
                    <button type="button" onClick={cancelarEdicion} className="text-xs font-semibold text-gym-muted">Cancelar</button>
                  ) : (
                    <button type="button" onClick={() => { setEditing(true); setDirty(false); setEditAviso(""); }} className="text-xs font-semibold text-gym-primary">Editar ficha</button>
                  )}
                  {editAviso && <p className="text-xs text-status-warn">{editAviso}</p>}
                </div>
                {editing ? (
                  <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto w-full max-w-3xl">
                  <SocioForm
                    key={sel.id}
                    gymId={gymId}
                    onDirty={setDirty}
                    edit={{
                      id: sel.id,
                      docTipo: sel.docTipo || "CC",
                      docNumero: sel.docNumero || "",
                      nombre: sel.nombre || "",
                      fechaNac: sel.fechaNac || "",
                      genero: sel.genero || "",
                      codigoPais: sel.codigoPais || "57",
                      celular: sel.celular || "",
                      email: sel.email || "",
                      enviarEmails: sel.enviarEmails !== false,
                      direccion: sel.direccion || "",
                      prospecto: !!sel.prospecto,
                      empresa: sel.empresa || "",
                      contactoRespaldoNombre: sel.contactoRespaldoNombre || "",
                      contactoRespaldoTel: sel.contactoRespaldoTel || "",
                      observaciones: sel.observaciones || "",
                    }}
                    submitLabel="Guardar cambios"
                    onDone={(d) => {
                      setEditing(false);
                      setDirty(false);
                      setEditAviso("");
                      setActionMsg(d?.door === false ? "Datos guardados. La puerta sigue con el nombre anterior." : "Datos guardados.");
                      load(gymId);
                    }}
                  />
                  </div>
                  </div>
                ) : (
                <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-4">
                  <section className="rounded-xl border border-gym-border/60 p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Identidad</h4>
                    <dl className="mt-2 space-y-1 text-sm text-gym-silver">
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Documento</dt><dd>{sel.docTipo} {sel.docNumero || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Nacimiento</dt><dd>{sel.fechaNac || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Género</dt><dd>{sel.genero || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Empresa</dt><dd className="truncate">{sel.empresa || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Desde</dt><dd>{cuando(sel.createdAt) || "—"}</dd></div>
                    </dl>
                  </section>
                  <section className="rounded-xl border border-gym-border/60 p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Contacto</h4>
                    <dl className="mt-2 space-y-1 text-sm text-gym-silver">
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Celular</dt><dd>{phone(sel)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Email</dt><dd className="truncate">{sel.email || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Dirección</dt><dd className="truncate text-right">{sel.direccion || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Respaldo</dt><dd className="truncate text-right">{sel.contactoRespaldoNombre || "—"}{sel.contactoRespaldoTel ? ` · ${sel.contactoRespaldoTel}` : ""}</dd></div>
                    </dl>
                  </section>
                  <section className="rounded-xl border border-gym-border/60 p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Membresía</h4>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">{estadoMembresia(sel, selFila).plan}</p>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${estadoMembresia(sel, selFila).tone === "ok" ? "bg-status-ok/15 text-status-ok" : estadoMembresia(sel, selFila).tone === "err" ? "bg-status-err/15 text-status-err" : estadoMembresia(sel, selFila).tone === "warn" ? "bg-status-warn/15 text-status-warn" : "bg-white/5 text-gym-muted"}`}>{estadoMembresia(sel, selFila).label}</span>
                    </div>
                    <dl className="mt-2 space-y-1 text-sm text-gym-silver">
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Inicio</dt><dd>{selM?.startsOn || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Vence</dt><dd>{selM?.endsOn || "—"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Plazo</dt><dd className="text-right">{selM?.kind === "tiquetera" && selM.live === "activa" ? `${selM.creditsLeft ?? 0} de ${selM.creditsTotal ?? 0}` : selM?.live === "activa" ? venceTexto(selM) : selL.why}</dd></div>
                    </dl>
                  </section>
                  <section className="rounded-xl border border-gym-border/60 p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Acceso</h4>
                    <dl className="mt-2 space-y-1 text-sm text-gym-silver">
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Rostro</dt><dd className={selL.rostro ? "text-status-ok" : "text-status-warn"}>{selL.rostro ? "Registrado" : "Pendiente"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Sede</dt><dd className={selM?.live === "activa" ? "text-status-ok" : ""}>{selM?.live === "activa" ? "Autorizada" : "Sin autorización"}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-gym-muted">Último ingreso</dt><dd className="text-right">{ultimoDe(sel, selFila) ? cuando(ultimoDe(sel, selFila)?.at) : "Sin acceso"}</dd></div>
                    </dl>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-gym-muted"><span>Ficha, rostro y membresía</span><span>{memOk ? `${pct}%` : "…"}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gym-border"><div className="h-full rounded-full bg-gym-primary" style={{ width: `${memOk ? pct : 0}%` }} /></div>
                    <p className={`mt-2 text-sm font-semibold ${selL.listo ? "text-status-ok" : "text-status-warn"}`}>{selL.why}</p>
                  </section>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-3">
                  <section className="rounded-xl border border-gym-border/60 p-3">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Siguiente paso</h4>
                    {sel.rol === "invitado" && <p className="mt-1 text-sm text-white">Visita de {sel.invitaNombre || "un titular"}. El ingreso ya se descontó del pase.</p>}
                    {sel.rol !== "invitado" && !selL.rostro && <p className="mt-1 text-sm text-white">Falta el registro facial.</p>}
                    {sel.rol !== "invitado" && selL.rostro && !selL.puede && <p className="mt-1 text-sm text-white">Asigna una membresía para que pueda entrar.</p>}
                    {selL.puede && !selL.listo && <p className="mt-1 text-sm text-white">Conviene renovar antes de que cierre el día.</p>}
                    {selL.listo && <p className="mt-1 text-sm text-status-ok">No falta nada para entrar en esta sede.</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!selL.rostro && (
                        <button type="button" disabled={resending} onClick={reenviar} className="btn-gym px-3 py-1.5 text-xs disabled:opacity-50">{resending ? "Enviando…" : "Enviar enlace"}</button>
                      )}
                      {selL.rostro && (selL.venceHoy || selL.porVencer || !selL.puede) && (
                        <a href="/membresias" className="btn-gym px-3 py-1.5 text-xs">Renovar</a>
                      )}
                      {selPase && (
                        <a href={`/invitar?doc=${encodeURIComponent(sel.docNumero)}`} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-primary">Generar invitación</a>
                      )}
                    </div>
                    {selPase && selM?.kind === "tiquetera" && <p className="mt-2 text-[11px] text-gym-muted">Cada invitado descuenta un ingreso de esta tiquetera.</p>}
                    {selPase && selM?.kind !== "tiquetera" && <p className="mt-2 text-[11px] text-gym-muted">{selPase.creditsLeft} de {selPase.creditsTotal} invitaciones · hasta {selPase.endsOn}</p>}
                    {!selL.rostro && (
                      <div className="mt-2 flex items-center gap-2">
                        <input readOnly value={sel.enrollLink} className="min-w-0 flex-1 truncate rounded-lg border border-gym-border bg-gym-navy/70 px-3 py-1.5 text-[11px] text-gym-muted" />
                        <button type="button" onClick={() => { navigator.clipboard?.writeText(sel.enrollLink); setCopied(true); }} className="rounded-lg border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">{copied ? "Copiado" : "Copiar"}</button>
                      </div>
                    )}
                  </section>
                  <button type="button" onClick={() => setVentana("invitaciones")} className="rounded-xl border border-gym-border/60 p-3 text-left transition hover:border-gym-primary/60">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Invitaciones</span>
                      <span className="text-sm font-extrabold text-white">{actividad ? nInv : "…"}</span>
                    </span>
                    <span className="mt-2 block text-sm text-gym-silver">Cada invitado, con estado y cupo</span>
                    <span className="mt-1 block text-[11px] font-semibold text-gym-primary">Abrir historial</span>
                  </button>
                  <button type="button" onClick={() => setVentana("actividad")} className="rounded-xl border border-gym-border/60 p-3 text-left transition hover:border-gym-primary/60">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gym-muted">Actividad</span>
                      <span className="text-sm font-extrabold text-white">{actividad ? nAct : "…"}</span>
                    </span>
                    <span className="mt-2 block text-sm text-gym-silver">Puerta y membresías, con fecha y motivo</span>
                    <span className="mt-1 block text-[11px] font-semibold text-gym-primary">Abrir historial</span>
                  </button>
                </div>
                {sel.observaciones && <p className="mt-2 truncate text-[11px] text-gym-muted">Notas · {sel.observaciones}</p>}

                {actionMsg && <p className="mt-3 text-xs text-gym-silver">{actionMsg}</p>}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gym-border/50 pt-3">
                  <span className="mr-auto text-[10px] font-bold uppercase tracking-wider text-gym-muted">Acciones</span>
                  {selL.rostro && (
                    <button type="button" disabled={resending} onClick={reenviar} className="rounded-lg border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver disabled:opacity-50">{resending ? "Enviando…" : "Reenviar enlace"}</button>
                  )}
                  {sel.facial.hasBiometrics && (
                    <button type="button" disabled={busy !== null} onClick={resetFace} className="rounded-lg border border-status-warn/50 px-3 py-1.5 text-xs font-semibold text-status-warn disabled:opacity-50">{busy === "face" ? "Borrando rostro…" : "Borrar rostro"}</button>
                  )}
                  <button type="button" disabled={busy !== null} onClick={archiveCliente} className="rounded-lg border border-status-err/50 px-3 py-1.5 text-xs font-semibold text-status-err disabled:opacity-50">{busy === "archive" ? "Desactivando…" : "Desactivar cliente"}</button>
                </div>
                </div>
                )}
            </div>
          </div>
        )}
        {ventana && sel && (
          <div className="fixed inset-0 z-[70] flex bg-black/70 p-4 md:pl-[256px]" onClick={() => setVentana(null)}>
            <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-gym-border bg-gym-navy shadow-2xl" role="dialog" aria-modal="true" aria-label={ventana === "invitaciones" ? "Historial de invitaciones" : "Historial de actividad"} onClick={(e) => e.stopPropagation()}>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <ClienteLibro id={sel.id} gymId={gymId} vista={ventana} onVista={setVentana} onClose={() => setVentana(null)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </GymShell>
  );
}
