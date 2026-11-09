"use client";

import { useEffect, useMemo, useState } from "react";

type Row = { id: string; nombre: string; celular: string; codigoPais: string };

export default function SendToClients({
  open,
  exerciseId,
  exerciseName,
  gymId,
  onClose,
}: {
  open: boolean;
  exerciseId: string;
  exerciseName: string;
  gymId: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setPicked({});
    setResult(null);
    fetch(`/api/socios?gym=${encodeURIComponent(gymId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d?.items) ? d.items : [];
        setRows(items.map((s: any) => ({
          id: s.id,
          nombre: s.nombre,
          celular: s.celular,
          codigoPais: s.codigoPais || "57",
        })));
      })
      .catch(() => setRows([]));
  }, [open, gymId]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) => `${r.nombre} ${r.celular}`.toLowerCase().includes(s));
  }, [rows, q]);

  const selectedIds = Object.keys(picked).filter((id) => picked[id]);

  function toggle(id: string) {
    setPicked((p) => ({ ...p, [id]: !p[id] }));
  }

  function toggleFiltered() {
    const allOn = filtered.every((r) => picked[r.id]);
    setPicked((p) => {
      const next = { ...p };
      for (const r of filtered) next[r.id] = !allOn;
      return next;
    });
  }

  async function send() {
    if (selectedIds.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/ejercicios/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym: gymId, exerciseId, socioIds: selectedIds }),
      });
      const data = await res.json();
      if (data.assigned > 0 && data.sent > 0 && data.failed === 0) {
        setResult(`Quedó en Entreno de ${data.assigned} cliente${data.assigned === 1 ? "" : "s"} y se avisó por WhatsApp.`);
      } else if (data.assigned > 0 && data.sent > 0) {
        setResult(`Quedó en Entreno de ${data.assigned}. WhatsApp llegó a ${data.sent} y falló en ${data.failed}.`);
      } else if (data.assigned > 0) {
        setResult(`Quedó en Entreno de ${data.assigned} cliente${data.assigned === 1 ? "" : "s"}. WhatsApp no avisó.`);
      } else {
        setResult("No se pudo guardar el ejercicio para esos clientes.");
      }
    } catch (e: any) {
      setResult(`No se pudo enviar: ${e?.message || e}`);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gym-border bg-gym-panel shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gym-border/70 px-5 py-4">
          <div className="text-sm font-extrabold text-white">Enviar a Entreno</div>
          <div className="mt-0.5 text-xs text-gym-muted">{exerciseName}. Queda en Tu entreno de la app. WhatsApp solo avisa, sin página.</div>
        </div>

        <div className="px-5 pt-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Escribe el nombre del cliente…"
            className="w-full rounded-xl border border-gym-border bg-gym-navy/70 px-3 py-2 text-sm text-gym-silver outline-none focus:border-gym-primary"
            autoFocus
          />
          <button
            type="button"
            onClick={toggleFiltered}
            className="mt-2 text-[11px] font-semibold text-gym-primary hover:underline"
          >
            {filtered.length > 0 && filtered.every((r) => picked[r.id])
              ? "Quitar selección"
              : `Seleccionar ${filtered.length} de la lista`}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          {filtered.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-gym-muted">
              No hay clientes con ese nombre.
            </div>
          ) : (
            filtered.map((r) => (
              <label
                key={r.id}
                className={`mb-1 flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  picked[r.id] ? "border-gym-primary/50 bg-gym-primary/10" : "border-transparent hover:bg-gym-border/30"
                }`}
              >
                <input type="checkbox" checked={!!picked[r.id]} onChange={() => toggle(r.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{r.nombre}</span>
                  <span className="text-[11px] text-gym-muted">+{r.codigoPais} {r.celular}</span>
                </span>
              </label>
            ))
          )}
        </div>

        {result && (
          <div className="mx-5 mb-2 rounded-xl border border-status-ok/30 bg-status-ok/10 px-3 py-2 text-xs text-status-ok">
            {result}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gym-border/70 px-5 py-3">
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver">
              Cerrar
            </button>
            <button
              type="button"
              disabled={sending || selectedIds.length === 0}
              onClick={send}
              className="btn-gym !px-3 !py-2 !text-xs disabled:opacity-40"
            >
              {sending
                ? "Enviando…"
                : `Enviar a Entreno${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
