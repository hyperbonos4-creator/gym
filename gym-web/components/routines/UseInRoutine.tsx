"use client";

import { useEffect, useState } from "react";
import { draftOf, type RoutineTemplate } from "../../lib/routineTypes";

export function UseInRoutine({
  gymId,
  exerciseId,
  exerciseName,
}: {
  gymId: string;
  exerciseId: string;
  exerciseName: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RoutineTemplate[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!open) return;
    let live = true;
    fetch(`/api/routines?gym=${encodeURIComponent(gymId)}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (live) setItems(data.items || []);
      })
      .catch(() => {
        if (live) setMsg("No se pudieron leer las rutinas.");
      });
    return () => {
      live = false;
    };
  }, [open, gymId]);

  const drafts = (items || []).filter((item) => draftOf(item));

  async function add(id: string) {
    setBusy(id);
    setMsg("");
    const res = await fetch(`/api/routines/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, action: "anadir", exerciseId }),
    });
    const data = await res.json();
    if (!data.ok) {
      setBusy("");
      setMsg(data.error || "No se pudo añadir.");
      return;
    }
    window.location.href = `/rutinas/${id}/editar`;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-xl border border-gym-border px-3 py-2 text-[11px] font-bold text-gym-silver"
      >
        {open ? "Cerrar" : "Usar en una rutina"}
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-gym-border/70 bg-gym-black/30 p-3">
          <p className="text-xs text-gym-muted">
            {exerciseName} entra al primer día de entrenamiento del borrador, con 3 series de 8-12 y 90 s. La prescripción se ajusta en el constructor.
          </p>
          {items === null && <p className="mt-2 text-sm text-gym-muted">Leyendo borradores…</p>}
          {items && drafts.length === 0 && <p className="mt-2 text-sm text-gym-silver">No hay borradores abiertos.</p>}
          <ul className="mt-2 flex flex-col gap-2">
            {drafts.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => add(item.id)}
                  className="w-full rounded-lg border border-gym-border px-3 py-2 text-left text-sm text-white disabled:opacity-40"
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="mt-0.5 block text-[11px] text-gym-muted">{item.goal} · {item.level} · borrador</span>
                </button>
              </li>
            ))}
          </ul>
          <a href={`/rutinas/crear?ejercicio=${encodeURIComponent(exerciseId)}`} className="mt-3 inline-flex text-xs font-semibold text-gym-primary">
            Crear una rutina con este ejercicio
          </a>
          {msg && <p className="mt-2 text-xs text-status-err">{msg}</p>}
        </div>
      )}
    </div>
  );
}
