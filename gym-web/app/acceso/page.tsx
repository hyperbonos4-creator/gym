"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import SocioForm from "../../components/SocioForm";
import { getActiveGymId } from "../../lib/session";

type Overview = {
  backend: boolean;
  vision: boolean;
  whatsapp: boolean;
};

export default function AccesoPage() {
  const [gymId, setGymId] = useState<string | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);

  const loadOverview = useCallback(async (id: string | null) => {
    try {
      const res = await fetch(`/api/access/overview?gym=${encodeURIComponent(id ?? "")}`, { cache: "no-store" });
      setOv(await res.json());
    } catch {
      setOv({ backend: false, vision: false, whatsapp: false });
    }
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    loadOverview(id);
    const t = setInterval(() => loadOverview(id), 6000);
    return () => clearInterval(t);
  }, [loadOverview]);

  const listo = !!ov && ov.backend && ov.vision && ov.whatsapp;

  return (
    <GymShell active="acceso">
      <div className="px-6 py-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">Alta de clientes</h2>
            <p className="text-sm text-gym-muted">Registra al cliente y prepara su acceso.</p>
          </div>
          <a href="/clientes" className="shrink-0 text-xs font-semibold text-gym-primary">Ver clientes</a>
        </div>

        <div className="glass mb-5 p-4">
          <div className={`text-sm font-bold ${ov == null ? "text-gym-muted" : listo ? "text-status-ok" : "text-status-warn"}`}>
            {ov == null ? "Revisando el registro…" : listo ? "● Sistema listo" : "⚠ El registro no está completo"}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-gym-silver">
            <li className={ov?.backend ? "text-status-ok" : ""}>{ov?.backend ? "✓" : "○"} Registro disponible</li>
            <li className={ov?.whatsapp ? "text-status-ok" : ""}>{ov?.whatsapp ? "✓" : "○"} Enrolamiento por WhatsApp disponible</li>
            <li className={ov?.vision ? "text-status-ok" : ""}>{ov?.vision ? "✓" : "○"} Reconocimiento facial disponible</li>
          </ul>
          {ov && !ov.whatsapp && (
            <p className="mt-2 text-xs text-status-warn">
              La ficha y el enlace se guardan, pero el mensaje no sale hasta <a href="/whatsapp" className="underline">vincular WhatsApp</a>.
            </p>
          )}
        </div>

        <div className="glass p-6">
          <SocioForm gymId={gymId} variant="alta" submitLabel="Crear cliente y enviar enlace" />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 px-1 text-xs text-gym-muted">
          <span>Terminal de acceso · {ov?.backend && ov?.vision ? "● Disponible" : ov ? "○ No disponible" : "Revisando"}</span>
          <a href="/kiosk/index.html?source=webcam" target="_blank" rel="noopener" className="font-semibold text-gym-silver hover:text-white">Abrir kiosco</a>
        </div>
      </div>
    </GymShell>
  );
}
