"use client";

import { useEffect, useState } from "react";
import GymShell from "../../../../components/GymShell";
import { RoutineBuilder } from "../../../../components/routines/RoutineBuilder";
import type { RoutineTemplate } from "../../../../lib/routineTypes";
import { getActiveGymId } from "../../../../lib/session";

export default function EditarRutinaPage({ params }: { params: { id: string } }) {
  const [gymId, setGymId] = useState("");
  const [template, setTemplate] = useState<RoutineTemplate | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    (async () => {
      const opened = await fetch(`/api/routines/${params.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym: id, action: "borrador" }),
      });
      const data = await opened.json();
      if (!data.ok) {
        setError(data.error || "No se pudo abrir el borrador.");
        return;
      }
      setTemplate(data.template);
    })();
  }, [params.id]);

  return (
    <GymShell active="rutinas">
      {error && <p className="px-6 py-10 text-sm text-status-err">{error}</p>}
      {!error && !template && <p className="px-6 py-10 text-sm text-gym-muted">Abriendo el borrador…</p>}
      {template && gymId && <RoutineBuilder gymId={gymId} initial={template} />}
    </GymShell>
  );
}
