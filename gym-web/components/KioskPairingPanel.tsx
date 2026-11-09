"use client";

import { useCallback, useEffect, useState } from "react";

type Device = {
  id: string;
  name: string;
  gymId: string;
  accessPointId: string;
  createdAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

type Pairing = {
  code: string;
  expiresAt: string;
  qrDataUrl: string;
  accessPointId: string;
  deviceName: string;
  pairUrl?: string;
  publicBase?: string;
};

function fmt(iso: string | null) {
  if (!iso) return "nunca";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function KioskPairingPanel({
  gymId,
  points,
}: {
  gymId: string;
  points: { id: string; name: string }[];
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pointId, setPointId] = useState("");
  const [name, setName] = useState("Kiosko recepción");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState(false);
  const [left, setLeft] = useState(0);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/kiosk?gym=${encodeURIComponent(gymId)}`, { cache: "no-store" });
      const d = await r.json();
      setDevices(Array.isArray(d.devices) ? d.devices : []);
    } catch {
      /* ignore */
    }
  }, [gymId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!pointId && points[0]?.id) setPointId(points[0].id);
  }, [points, pointId]);

  useEffect(() => {
    if (!pairing) {
      setLeft(0);
      return;
    }
    const tick = () => {
      const ms = Date.parse(pairing.expiresAt) - Date.now();
      setLeft(Math.max(0, Math.ceil(ms / 1000)));
      if (ms <= 0) setPairing(null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [pairing]);

  async function vincular() {
    setBusy("pair");
    setMsg("");
    setErr(false);
    try {
      const r = await fetch("/api/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gym: gymId,
          accessPointId: pointId || undefined,
          deviceName: name.trim() || "Kiosko",
        }),
      });
      const d = await r.json();
      if (!d.ok || !d.code) {
        setErr(true);
        setMsg(
          d.error === "sin_puerta"
            ? "Crea primero una puerta en esta sede."
            : "No se pudo generar el código. Revisa que el control de acceso esté en línea.",
        );
      } else {
        setPairing({
          code: d.code,
          expiresAt: d.expiresAt,
          qrDataUrl: d.qrDataUrl,
          accessPointId: d.accessPointId,
          deviceName: d.deviceName,
          pairUrl: d.pairUrl,
          publicBase: d.publicBase,
        });
        setMsg("Código listo. Escanea el QR con la tablet (o escribe los 6 dígitos).");
      }
    } catch {
      setErr(true);
      setMsg("No se pudo generar el código.");
    }
    setBusy("");
  }

  async function revocar(id: string) {
    if (!confirm("¿Revocar esta tablet? Dejará de reconocer socios hasta vincularla de nuevo.")) return;
    setBusy(`rev-${id}`);
    try {
      const r = await fetch("/api/kiosk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gym: gymId, action: "revoke", deviceId: id }),
      });
      const d = await r.json();
      if (!d.ok) {
        setErr(true);
        setMsg("No se pudo revocar.");
      } else {
        setMsg("Tablet revocada.");
        setErr(false);
        await load();
      }
    } catch {
      setErr(true);
      setMsg("No se pudo revocar.");
    }
    setBusy("");
  }

  const active = devices.filter((d) => !d.revokedAt);
  const revoked = devices.filter((d) => d.revokedAt);

  return (
    <section className="glass mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-white">Tablets / kiosko</h3>
          <p className="mt-1 text-xs text-gym-muted">
            Escanea el QR con la cámara de la tablet (se abre el kiosko y se vincula sola). Código de 6 dígitos, 10 minutos, un solo uso. Sin contraseña de administrador.
          </p>
        </div>
        <a
          href="/kiosk/index.html?source=webcam"
          target="_blank"
          rel="noopener"
          className="text-xs font-semibold text-gym-primary"
        >
          Abrir pantalla del kiosko
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-gym-muted">
          Puerta de esta sede
          <select
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={pointId}
            onChange={(e) => setPointId(e.target.value)}
          >
            {points.length === 0 && <option value="">Se creará una puerta al vincular</option>}
            {points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gym-muted">
          Nombre de la tablet
          <input
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recepción"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy === "pair"}
          onClick={vincular}
          className="rounded-xl bg-gym-primary px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy === "pair" ? "Generando…" : "Vincular kiosko"}
        </button>
        {msg && <span className={`text-xs ${err ? "text-status-warn" : "text-gym-silver"}`}>{msg}</span>}
      </div>

      {pairing && (
        <div className="mt-4 flex flex-wrap items-center gap-5 rounded-2xl border border-gym-primary/40 bg-black/30 p-4">
          <img src={pairing.qrDataUrl} alt="QR de vinculación" className="h-36 w-36 rounded-xl bg-white p-2" />
          <div>
            <div className="text-xs uppercase tracking-wider text-gym-muted">Código</div>
            <div className="mt-1 font-mono text-3xl font-extrabold tracking-[0.35em] text-white">{pairing.code}</div>
            <div className="mt-2 text-xs text-gym-silver">
              Caduca en {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} · un solo uso · puerta {pairing.accessPointId.slice(0, 8)}…
            </div>
            <p className="mt-2 max-w-sm text-xs text-gym-muted">
              Escanea este QR con la tablet: abre el kiosko y la vincula sola. También puedes escribir el código a mano.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-gym-muted">Vinculadas ({active.length})</div>
        {active.length === 0 && <p className="text-sm text-gym-muted">Todavía no hay tablets vinculadas a esta sede.</p>}
        {active.map((d) => (
          <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2">
            <div>
              <div className="text-sm font-semibold text-white">{d.name}</div>
              <div className="text-[11px] text-gym-muted">
                Vinculada {fmt(d.createdAt)} · último uso {fmt(d.lastSeenAt)}
              </div>
            </div>
            <button
              type="button"
              disabled={busy === `rev-${d.id}`}
              onClick={() => revocar(d.id)}
              className="text-xs font-semibold text-status-warn"
            >
              Revocar
            </button>
          </div>
        ))}
        {revoked.length > 0 && (
          <details className="pt-2 text-xs text-gym-muted">
            <summary className="cursor-pointer font-semibold">Revocadas ({revoked.length})</summary>
            <ul className="mt-2 space-y-1">
              {revoked.map((d) => (
                <li key={d.id}>
                  {d.name} · revocada {fmt(d.revokedAt)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
