"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GymShell from "../../components/GymShell";
import { getActiveGymId } from "../../lib/session";

type WaState = "open" | "connecting" | "qr" | "close" | "unknown";
type Status = { state: WaState; qr: string | null; numero: string | null };

const STATE_UI: Record<WaState, { label: string; dot: string; text: string; ring: string }> = {
  open: { label: "Conectado", dot: "bg-status-ok", text: "text-status-ok", ring: "border-status-ok/40 bg-status-ok/10" },
  connecting: { label: "Conectando…", dot: "bg-status-warn", text: "text-status-warn", ring: "border-status-warn/40 bg-status-warn/10" },
  qr: { label: "Escanea el QR", dot: "bg-status-warn", text: "text-status-warn", ring: "border-status-warn/40 bg-status-warn/10" },
  close: { label: "Desconectado", dot: "bg-status-err", text: "text-status-err", ring: "border-status-err/40 bg-status-err/10" },
  unknown: { label: "Comprobando…", dot: "bg-gym-muted", text: "text-gym-muted", ring: "border-gym-border/60 bg-gym-panel/40" },
};

function formatNumero(n: string | null): string {
  if (!n) return "";
  const d = n.replace(/[^\d]/g, "");
  // +57 300 123 4567
  if (d.length >= 12 && d.startsWith("57")) {
    const r = d.slice(2);
    return `+57 ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`.trim();
  }
  return `+${d}`;
}

export default function WhatsappPage() {
  const [gymId, setGymId] = useState<string | null>(null);
  const [gymName, setGymName] = useState("este gimnasio");
  const [aviso, setAviso] = useState("");
  const [status, setStatus] = useState<Status>({ state: "unknown", qr: null, numero: null });
  const [qr, setQr] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async (id: string | null) => {
    try {
      const res = await fetch(`/api/whatsapp/status?gym=${encodeURIComponent(id ?? "")}`, { cache: "no-store" });
      const data: Status = await res.json();
      setStatus(data);
      if (data.state === "open") {
        setQr(null);
        setConnecting(false);
      } else if (data.qr) {
        setQr((prev) => (prev === data.qr ? prev : data.qr));
      }
    } catch {
      setStatus({ state: "close", qr: null, numero: null });
    }
  }, []);

  useEffect(() => {
    const id = getActiveGymId();
    setGymId(id);
    fetch("/api/gyms", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const g = (d.items || []).find((x: { id: string }) => x.id === id);
        if (g?.name) setGymName(g.name);
      })
      .catch(() => {});
    fetchStatus(id);
    timer.current = setInterval(() => fetchStatus(id), 4000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [fetchStatus]);

  // Si Evolution quedó en "connecting" sin QR en pantalla, pídelo una sola vez.
  useEffect(() => {
    if (status.state === "connecting" && !qr && !connecting && gymId) {
      onConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state]);

  async function onConnect() {
    setConnecting(true);
    setQr(null);
    try {
      const res = await fetch(`/api/whatsapp/connect?gym=${encodeURIComponent(gymId ?? "")}`, { method: "POST" });
      const data: Status = await res.json();
      if (data.state === "open") {
        setConnecting(false);
        setStatus(data);
      } else if (data.qr) {
        setQr(data.qr);
      }
    } catch {
      setConnecting(false);
    }
  }

  async function onDisconnect() {
    if (!confirm("Esto suelta el cupo en WhatsApp. ¿Reiniciar el vínculo de este gimnasio?")) return;
    setBusy(true);
    try {
      await fetch(`/api/whatsapp/disconnect?gym=${encodeURIComponent(gymId ?? "")}`, { method: "POST" });
      setQr(null);
      setConnecting(false);
      await fetchStatus(gymId);
    } finally {
      setBusy(false);
    }
  }

  const isOpen = status.state === "open";
  const ui = STATE_UI[status.state] ?? STATE_UI.unknown;
  const showQr = !isOpen && (connecting || !!qr || status.state === "connecting");

  return (
    <GymShell active="whatsapp">
      <div className="px-6 py-6">
        {/* Encabezado */}
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#128C7E] to-[#25D366] shadow-glow">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" /></svg>
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-white">WhatsApp del gimnasio</h2>
            <p className="text-sm text-gym-muted">
              Vincula el número de <span className="font-semibold text-gym-silver">{gymName}</span> para enviar links de enrolamiento, recordatorios y avisos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
          {/* Panel de estado / acción */}
          <div className="lg:col-span-3">
            <div className="glass p-6">
              {/* Barra de estado */}
              <div className={`mb-6 flex items-center justify-between rounded-xl border px-4 py-3 ${ui.ring}`}>
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className={`absolute inline-flex h-full w-full animate-pulseGlow rounded-full ${ui.dot} opacity-75`} />
                    <span className={`relative inline-flex h-3 w-3 rounded-full ${ui.dot}`} />
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className={`text-sm font-bold ${ui.text}`}>{ui.label}</span>
                    <span className="text-[11px] text-gym-muted">Estado de la conexión</span>
                  </div>
                </div>
                {isOpen && status.numero && (
                  <div className="text-right">
                    <div className="text-sm font-bold text-gym-silver">{formatNumero(status.numero)}</div>
                    <div className="text-[11px] text-gym-muted">Número vinculado</div>
                  </div>
                )}
              </div>

              {/* Cuerpo según estado */}
              {isOpen ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="mb-4 grid h-20 w-20 place-items-center rounded-full bg-status-ok/15 ring-1 ring-status-ok/40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-status-ok"><path d="M20 6 9 17l-5-5" /></svg>
                  </div>
                  <h3 className="text-lg font-extrabold text-white">Número conectado y listo</h3>
                  <p className="mt-1 max-w-sm text-sm text-gym-muted">
                    Ya puedes enviar mensajes desde la plataforma. Para cambiar el número, desconéctalo y vincula otro.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setAviso("");
                      try {
                        const r = await fetch("/api/memberships/avisos", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ gym: gymId }),
                        });
                        const d = await r.json();
                        setAviso(d.due ? `Avisos enviados: ${d.sent} de ${d.due}.` : "Nadie vence en los próximos 3 días.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="mt-5 rounded-xl border border-gym-primary/50 px-5 py-2.5 text-sm font-semibold text-gym-primary disabled:opacity-50"
                  >
                    Avisar vencimientos (3 días)
                  </button>
                  {aviso && <p className="mt-2 text-xs text-gym-silver">{aviso}</p>}
                  <button
                    onClick={onDisconnect}
                    disabled={busy}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-status-err/50 bg-status-err/10 px-5 py-2.5 text-sm font-semibold text-status-err transition-colors hover:bg-status-err/20 disabled:opacity-50"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" /></svg>
                    {busy ? "Desconectando…" : "Desconectar número"}
                  </button>
                </div>
              ) : showQr ? (
                <div className="flex flex-col items-center py-2 text-center">
                  <div className="grid h-64 w-64 place-items-center rounded-2xl border border-gym-border/70 bg-white p-3">
                    {qr ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr} alt="Código QR de WhatsApp" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-gym-navy">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 animate-spin"><path d="M21 12a9 9 0 1 1-6.22-8.56" /></svg>
                        <span className="text-xs font-semibold">Generando QR…</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-sm font-semibold text-gym-silver">Escanea este código con WhatsApp</p>
                  <p className="mt-0.5 max-w-sm text-[12px] text-gym-muted">
                    En el celular: WhatsApp → <b>Dispositivos vinculados</b> → <b>Vincular un dispositivo</b>. El código se renueva solo: escanea el que está en pantalla.
                  </p>
                  <p className="mt-2 max-w-sm rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-[11px] text-status-warn">
                    Si dice “no se pueden vincular más dispositivos”, entra a Dispositivos vinculados, borra los que no reconozcas (WhatsApp Web / Chrome / equipo viejo) y espera 5–10 minutos. Luego pulsa “Volver a generar QR” y escanea <b>una sola vez</b>.
                  </p>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <button onClick={onConnect} className="text-xs font-semibold text-gym-primary hover:underline">
                      Volver a generar QR
                    </button>
                    <button
                      onClick={onDisconnect}
                      disabled={busy}
                      className="text-xs font-semibold text-gym-muted hover:text-status-err disabled:opacity-50"
                    >
                      {busy ? "Reiniciando…" : "Cancelar y reiniciar vínculo"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="mb-4 grid h-20 w-20 place-items-center rounded-full bg-gym-border/30 ring-1 ring-gym-border/60">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-gym-muted"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" /></svg>
                  </div>
                  <h3 className="text-lg font-extrabold text-white">Sin número vinculado</h3>
                  <p className="mt-1 max-w-sm text-sm text-gym-muted">
                    Conecta el WhatsApp del gimnasio para empezar a enviar mensajes a los clientes.
                  </p>
                  <button onClick={onConnect} className="btn-gym mt-5 px-6">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M4 4h16v12H5.2L4 17.2V4Z" /><path d="M8 9h8M8 12h5" /></svg>
                    Conectar WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info lateral */}
          <div className="lg:col-span-2">
            <div className="glass p-5">
              <h4 className="text-sm font-bold text-white">¿Cómo funciona?</h4>
              <ol className="mt-3 flex flex-col gap-3">
                {[
                  ["Conecta", "Pulsa “Conectar WhatsApp” y escanea el QR. Una sola vez: WhatsApp bloquea si se regenera muchas veces."],
                  ["Si no deja vincular", "No hace falta cerrar WhatsApp. En Dispositivos vinculados borra sesiones viejas y espera unos minutos."],
                  ["Verifica", "El estado cambia a “Conectado” y se muestra el número vinculado."],
                  ["Cambia cuando quieras", "Desconecta desde aquí (no desde el celular a ciegas) y vincula otro número."],
                ].map(([t, d], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gym-primaryDeep to-gym-violet text-[11px] font-bold text-white">{i + 1}</span>
                    <span className="flex flex-col">
                      <span className="text-[13px] font-semibold text-gym-silver">{t}</span>
                      <span className="text-[11px] text-gym-muted">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <div className="mt-4 rounded-lg border border-gym-border/60 bg-gym-navy/50 px-3 py-2 text-[11px] text-gym-muted">
                Cada gimnasio tiene su propio número. Al cambiar de gimnasio arriba, verás su conexión por separado.
              </div>
            </div>
          </div>
        </div>
      </div>
    </GymShell>
  );
}
