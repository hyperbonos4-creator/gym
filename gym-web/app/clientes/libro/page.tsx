"use client";

import { useEffect, useState } from "react";
import GymShell from "../../../components/GymShell";
import ClienteLibro, { type VistaLibro } from "../../../components/ClienteLibro";
import { getActiveGymId } from "../../../lib/session";

export default function LibroPage() {
  const [vista, setVista] = useState<VistaLibro>("actividad");
  const [id, setId] = useState("");
  const [gymId, setGymId] = useState("fuerza-elite");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setId(params.get("id") || "");
    setVista(params.get("vista") === "invitaciones" ? "invitaciones" : "actividad");
    setGymId(getActiveGymId() || "fuerza-elite");
  }, []);

  function ir(next: VistaLibro) {
    const url = `/clientes/libro?id=${encodeURIComponent(id)}&vista=${next}`;
    window.history.replaceState(null, "", url);
    setVista(next);
  }

  return (
    <GymShell active="clientes">
      <div className="px-6 py-6">
        <ClienteLibro id={id} gymId={gymId} vista={vista} onVista={ir} />
      </div>
    </GymShell>
  );
}
