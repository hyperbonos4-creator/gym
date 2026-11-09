"use client";

import { useEffect, useState } from "react";
import GymShell from "../../../components/GymShell";
import { RoutineBuilder } from "../../../components/routines/RoutineBuilder";
import { getActiveGymId } from "../../../lib/session";

export default function CrearRutinaPage() {
  const [gymId, setGymId] = useState("");
  useEffect(() => setGymId(getActiveGymId() || "fuerza-elite"), []);
  return (
    <GymShell active="rutinas">
      {gymId ? <RoutineBuilder gymId={gymId} initial={null} /> : <p className="px-6 py-10 text-sm text-gym-muted">Abriendo el constructor…</p>}
    </GymShell>
  );
}
