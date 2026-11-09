"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GymShell from "../../components/GymShell";
import { getActiveGymId } from "../../lib/session";

type Quien = "cliente" | "invitado" | "desconocido" | "prueba" | "reconocido";

type Row = {
  id: string;
  at: string;
  dia: string;
  hora: string;
  subjectId: string | null;
  nombre: string;
  documento: string;
  quien: Quien;
  invitadoDe: string | null;
  plan: string | null;
  planTipo: string | null;
  planDe: "propio" | "anfitrion" | null;
  decision: "GRANTED" | "DENIED" | "DEMO";
  reason: string;
  title: string;
  why: string;
  match: number | null;
  liveness: number | null;
  livenessMode: string;
  puerta: string;
  door: boolean;
  origen: "panel" | "panel_sin_confirmacion" | "rostro" | "ninguno" | "demostracion";
  emergencia: "sin_senal";
};

const QUIEN: Record<Quien, string> = {
  cliente: "Cliente",
  invitado: "Invitado",
  desconocido: "No reconocido",
  prueba: "Prueba del panel",
  reconocido: "Sin ficha",
};

const PAGE = 40;

function fecha(dia: string) {
  const [y, m, d] = dia.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export default function AccesosPage() {
  const [gymId, setGymId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [tope, setTope] = useState(2000);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  const [dia, setDia] = useState<"hoy" | "7" | "30" | "todo">("todo");
  const [resultado, setResultado] = useState<"todos" | "concedido" | "denegado">("todos");
  const [quien, setQuien] = useState<"todos" | Quien>("todos");
  const [puerta, setPuerta] = useState("todas");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(async (id: string) => {
    setError("");
    const r = await fetch(`/api/accesos?gym=${encodeURIComponent(id)}`, { cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) {
      setError("No se pudo leer el historial de accesos.");
      setListo(true);
      return;
    }
    setRows(d.rows || []);
    setTope(d.tope || 2000);
    setListo(true);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = q.get("dia");
    const r = q.get("resultado");
    if (d === "hoy" || d === "7" || d === "30") setDia(d);
    if (r === "concedido" || r === "denegado") setResultado(r);
    setGymId(getActiveGymId() || "fuerza-elite");
  }, []);

  useEffect(() => {
    if (!gymId) return;
    load(gymId);
  }, [gymId, load]);

  const hoy = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  }, [rows]);

  const puertas = useMemo(() => Array.from(new Set(rows.map((r) => r.puerta))).sort(), [rows]);

  const filtradas = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const desde = dia === "7" || dia === "30"
      ? new Date(Date.now() - (dia === "7" ? 7 : 30) * 86400000).getTime()
      : 0;
    return rows.filter((r) => {
      if (dia === "hoy" && r.dia !== hoy) return false;
      if ((dia === "7" || dia === "30") && Date.parse(r.at) < desde) return false;
      if (resultado === "concedido" && r.decision !== "GRANTED") return false;
      if (resultado === "denegado" && r.decision !== "DENIED") return false;
      if (quien !== "todos" && r.quien !== quien) return false;
      if (puerta !== "todas" && r.puerta !== puerta) return false;
      if (!needle) return true;
      return [r.nombre, r.documento, r.plan, r.why, r.reason, r.puerta, r.invitadoDe || ""].join(" ").toLowerCase().includes(needle);
    });
  }, [rows, q, dia, hoy, resultado, quien, puerta]);

  useEffect(() => { setPage(0); }, [q, dia, resultado, quien, puerta]);

  const pages = Math.max(1, Math.ceil(filtradas.length / PAGE));
  const slice = filtradas.slice(page * PAGE, page * PAGE + PAGE);
  const concedidos = filtradas.filter((r) => r.decision === "GRANTED").length;
  const denegados = filtradas.filter((r) => r.decision === "DENIED").length;
  const demostraciones = filtradas.filter((r) => r.decision === "DEMO").length;

  const atencion = useMemo(() => {
    const grupos = new Map<string, Row[]>();
    for (const r of rows) {
      if (r.dia !== hoy || r.decision !== "DENIED") continue;
      if (r.quien === "desconocido" || r.quien === "prueba") continue;
      const key = r.subjectId || r.nombre;
      const list = grupos.get(key) || [];
      list.push(r);
      grupos.set(key, list);
    }
    return [...grupos.entries()].flatMap(([key, items]) => {
      const orden = [...items].sort((a, b) => (a.at < b.at ? 1 : -1));
      const ultimo = orden[0];
      const entroDespues = rows.some((r) => (r.subjectId || r.nombre) === key && r.decision === "GRANTED" && r.at > ultimo.at);
      if (entroDespues) return [];
      return [{ key, veces: orden.length, ultimo }];
    });
  }, [rows, hoy]);

  return (
    <GymShell active="accesos">
      <div className="px-6 py-6">
        <p className="max-w-3xl text-sm text-gym-muted">
          Cada intento en la puerta: quién llegó, si era cliente o invitado, el plan que cubría ese día, el resultado y si el sistema ordenó abrir.
          El botón físico de emergencia del torniquete no avisa a este sistema, así que esa columna queda en «Sin señal» hasta que el controlador la envíe.
        </p>

        {atencion.length > 0 && (
          <section className="mt-5">
            <h3 className="text-sm font-bold text-white">Requieren atención</h3>
            <p className="mt-1 text-xs text-gym-muted">Personas conocidas que hoy no pudieron entrar. Una cara desconocida queda solo en el registro de abajo.</p>
            <div className="mt-3 space-y-2">
              {atencion.map((g) => (
                <div key={g.key} className="rounded-2xl border border-status-warn/40 bg-status-warn/10 px-4 py-3">
                  <div className="text-sm font-bold text-status-warn">Socio rechazado</div>
                  <div className="mt-1 text-sm text-white">{g.ultimo.nombre}{g.veces > 1 ? ` · ${g.veces} veces` : ""}</div>
                  <div className="text-xs text-gym-silver">{g.ultimo.why}</div>
                  {g.ultimo.reason === "MEMBERSHIP_EXPIRED" ? (
                    <a href="/membresias" className="mt-2 inline-block text-xs font-semibold text-gym-primary">Renovar membresía</a>
                  ) : g.ultimo.subjectId ? (
                    <a href={`/clientes?socio=${encodeURIComponent(g.ultimo.subjectId)}`} className="mt-2 inline-block text-xs font-semibold text-gym-primary">Ver ficha</a>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [String(filtradas.length), "en esta vista"],
            [String(concedidos), concedidos === 1 ? "concedido" : "concedidos"],
            [String(denegados), denegados === 1 ? "denegado" : "denegados"],
            [String(demostraciones), demostraciones === 1 ? "demostración" : "demostraciones"],
          ].map(([n, l]) => (
            <div key={l} className="glass px-4 py-3">
              <div className="text-lg font-extrabold text-white">{n}</div>
              <div className="text-[11px] uppercase tracking-wider text-gym-muted">{l}</div>
            </div>
          ))}
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {([
            ["hoy", "Hoy"],
            ["7", "7 días"],
            ["30", "30 días"],
            ["todo", "Todo lo guardado"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setDia(id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${dia === id ? "bg-white text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
          ))}
          {([
            ["todos", "Todos"],
            ["concedido", "Concedidos"],
            ["denegado", "Denegados"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setResultado(id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${resultado === id ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
          ))}
          {([
            ["todos", "Cualquier persona"],
            ["cliente", "Clientes"],
            ["invitado", "Invitados"],
            ["desconocido", "No reconocidos"],
            ["prueba", "Prueba del panel"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setQuien(id)} className={`rounded-full px-3 py-1 text-[11px] font-semibold ${quien === id ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{label}</button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre, documento o motivo" className="w-full max-w-sm rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white" />
          {puertas.length > 1 && (
            <select value={puerta} onChange={(e) => setPuerta(e.target.value)} className="rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white">
              <option value="todas">Todas las puertas</option>
              {puertas.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        {!listo && <p className="text-sm text-gym-muted">Leyendo el registro…</p>}
        {error && <p className="text-sm text-status-err">{error}</p>}
        {listo && !error && filtradas.length === 0 && <p className="text-sm text-gym-muted">No hay accesos con estos filtros.</p>}

        {slice.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-gym-border/60">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-gym-navy/70 text-[11px] uppercase tracking-wider text-gym-muted">
                <tr>
                  {["Fecha y hora", "Persona", "Quién", "Plan ese día", "Resultado", "Rostro", "Vida", "Puerta", "Apertura", "Emergencia"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((r) => (
                  <tr key={r.id} className="border-t border-gym-border/40">
                    <td className="whitespace-nowrap px-3 py-2 text-gym-silver">{fecha(r.dia)}<div className="text-xs text-gym-muted">{r.hora}</div></td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-white">{r.nombre}</div>
                      {r.documento && <div className="text-xs text-gym-muted">{r.documento}</div>}
                      {r.subjectId && r.quien !== "prueba" && (
                        <a href={`/clientes?socio=${encodeURIComponent(r.subjectId)}`} className="text-[11px] font-semibold text-gym-primary">Ver ficha</a>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gym-silver">
                      {QUIEN[r.quien]}
                      {r.invitadoDe && <div className="text-xs text-gym-muted">De {r.invitadoDe}</div>}
                    </td>
                    <td className="px-3 py-2 text-gym-silver">
                      {r.plan ? <>{r.plan}<div className="text-xs text-gym-muted">{r.planTipo}{r.planDe === "anfitrion" ? " · del anfitrión" : ""}</div></> : <span className="text-gym-muted">Sin plan ese día</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className={`font-semibold ${r.decision === "DEMO" ? "text-gym-primary" : r.decision === "GRANTED" ? "text-status-ok" : "text-status-err"}`}>{r.title}</div>
                      <div className="text-xs text-gym-muted">{r.why}</div>
                    </td>
                    <td className="px-3 py-2 text-gym-silver">{r.match == null ? "—" : `${r.match}%`}</td>
                    <td className="px-3 py-2 text-gym-silver">{r.livenessMode === "UNAVAILABLE" ? "No medida" : r.liveness == null ? "—" : `${r.liveness}%`}</td>
                    <td className="px-3 py-2 text-gym-silver">{r.puerta}</td>
                    <td className="px-3 py-2 text-gym-silver">
                      {r.origen === "rostro" && "Ordenada por rostro"}
                      {r.origen === "panel" && "Orden del panel"}
                      {r.origen === "panel_sin_confirmacion" && "Orden sin confirmación"}
                      {r.origen === "ninguno" && "No se abrió"}
                      {r.origen === "demostracion" && "Demostración"}
                    </td>
                    <td className="px-3 py-2 text-gym-muted">Sin señal</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtradas.length > PAGE && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver disabled:opacity-40">Anterior</button>
            <span className="text-xs text-gym-muted">Página {page + 1} de {pages}</span>
            <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver disabled:opacity-40">Siguiente</button>
          </div>
        )}

        <p className="mt-4 text-xs text-gym-muted">
          Se muestran los últimos {tope.toLocaleString("es-CO")} intentos guardados ({rows.length.toLocaleString("es-CO")} en esta sede).
          El plan es el que cubría esa fecha en la ficha. La puerta no guarda una foto del plan en el momento del paso.
        </p>
      </div>
    </GymShell>
  );
}
