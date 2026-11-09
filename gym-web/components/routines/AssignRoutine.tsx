"use client";

import { useCallback, useEffect, useState } from "react";

type SocioOption = { id: string; nombre: string; rol?: string };
type AssignmentRow = {
  id: string;
  socioId: string;
  socioNombre: string;
  versionNumber: number;
  startDate: string;
  status: "vigente" | "cerrada";
  note: string;
  canUpdate: boolean;
  latestNumber: number | null;
  versionAlive: boolean;
};

export function AssignRoutine({
  gymId,
  templateId,
  templateName,
  published,
}: {
  gymId: string;
  templateId: string;
  templateName: string;
  published: boolean;
}) {
  const [socios, setSocios] = useState<SocioOption[]>([]);
  const [rows, setRows] = useState<AssignmentRow[] | null>(null);
  const [socioId, setSocioId] = useState("");
  const [startDate, setStartDate] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [people, assigned] = await Promise.all([
      fetch(`/api/socios?gym=${encodeURIComponent(gymId)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/routine-assignments?gym=${encodeURIComponent(gymId)}&template=${encodeURIComponent(templateId)}`, { cache: "no-store" }).then((res) => res.json()),
    ]);
    const list = ((people.items || []) as SocioOption[]).filter((item) => item.rol !== "invitado");
    setSocios(list);
    setSocioId((current) => current || list[0]?.id || "");
    setRows(assigned.items || []);
  }, [gymId, templateId]);

  useEffect(() => {
    load().catch(() => setMsg("No se pudieron leer los socios."));
  }, [load]);

  async function send(action: "asignar" | "cerrar" | "actualizar", id = "") {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/routine-assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gym: gymId,
        action,
        id,
        socioId,
        templateId,
        startDate,
        note,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setMsg(data.error || "No se pudo actualizar.");
      return;
    }
    setNote("");
    setMsg(action === "asignar" ? "Asignación guardada. Si editas la plantilla, esta copia no cambia." : "Asignación actualizada.");
    await load();
  }

  const vigentes = (rows || []).filter((row) => row.status === "vigente");
  const closed = (rows || []).filter((row) => row.status === "cerrada").slice(0, 4);

  return (
    <section id="asignar" className="glass p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-white">Asignar esta versión</h3>
          <p className="mt-1 text-xs text-gym-muted">
            {templateName}. Publicar y asignar son dos pasos. El socio queda atado a la versión publicada de hoy.
          </p>
        </div>
      </div>

      {!published && <p className="mt-3 text-sm text-gym-silver">Publica la rutina para poder asignarla. El borrador no se entrega.</p>}

      {published && (
        <div className="mt-4 grid gap-2 md:grid-cols-[1.4fr_0.8fr_1fr_auto]">
          <label className="text-[11px] text-gym-muted">
            Socio
            <select value={socioId} onChange={(e) => setSocioId(e.target.value)} className="mt-1 block w-full rounded-lg border border-gym-border bg-gym-navy px-2 py-2 text-sm text-white">
              {socios.length === 0 && <option value="">Sin socios activos</option>}
              {socios.map((socio) => <option key={socio.id} value={socio.id}>{socio.nombre}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-gym-muted">
            Empieza
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-gym-border bg-transparent px-2 py-2 text-sm text-white" />
          </label>
          <label className="text-[11px] text-gym-muted">
            Nota
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" className="mt-1 block w-full rounded-lg border border-gym-border bg-transparent px-2 py-2 text-sm text-white outline-none" />
          </label>
          <button type="button" disabled={busy || !socioId} onClick={() => send("asignar")} className="btn-gym self-end disabled:opacity-40">Asignar</button>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-gym-primary">{msg}</p>}

      <div className="mt-4">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gym-muted">Vigentes</div>
        {rows === null && <p className="mt-2 text-sm text-gym-muted">Leyendo asignaciones…</p>}
        {rows && vigentes.length === 0 && <p className="mt-2 text-sm text-gym-silver">Todavía nadie tiene esta rutina asignada.</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {vigentes.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gym-border/70 px-3 py-2">
              <div>
                <div className="text-sm font-semibold text-white">{row.socioNombre}</div>
                <div className="text-[11px] text-gym-muted">
                  Versión {row.versionNumber} · desde {row.startDate}
                  {row.note ? ` · ${row.note}` : ""}
                  {!row.versionAlive ? " · la versión ya no está en la plantilla" : ""}
                </div>
              </div>
              <div className="flex gap-3">
                {row.canUpdate && (
                  <button type="button" disabled={busy} onClick={() => send("actualizar", row.id)} className="text-xs font-semibold text-gym-primary disabled:opacity-40">
                    Pasar a la versión {row.latestNumber}
                  </button>
                )}
                <button type="button" disabled={busy} onClick={() => send("cerrar", row.id)} className="text-xs font-semibold text-gym-muted disabled:opacity-40">Cerrar</button>
              </div>
            </li>
          ))}
        </ul>
        {closed.length > 0 && (
          <p className="mt-3 text-[11px] text-gym-muted">
            Cerradas recientes: {closed.map((row) => `${row.socioNombre} (v${row.versionNumber})`).join(", ")}.
          </p>
        )}
      </div>
    </section>
  );
}
