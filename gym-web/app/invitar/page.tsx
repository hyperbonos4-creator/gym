"use client";

import { useEffect, useState } from "react";

type Invite = {
  id: string;
  guestName: string;
  guestDoc: string;
  status: string;
  pin: string | null;
  usedAt?: string | null;
  entryVia?: string | null;
  ownerName?: string;
  creditsLeftAfter?: number | null;
};

type Issued = { guestName: string; guestDoc: string; pin: string; enrollUrl: string; id: string; ownerName: string; left: number; total: number };

const field = "mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white outline-none focus:border-gym-primary";

function hora(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function InvitarPage() {
  const [doc, setDoc] = useState("");
  const [phone, setPhone] = useState("");
  const [ready, setReady] = useState(false);
  const [owner, setOwner] = useState("");
  const [left, setLeft] = useState(0);
  const [total, setTotal] = useState(0);
  const [until, setUntil] = useState("");
  const [rows, setRows] = useState<Invite[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestDoc, setGuestDoc] = useState("");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("doc");
    if (q) setDoc(q);
  }, []);

  async function load(nextDoc = doc, nextPhone = phone) {
    setErr("");
    setBusy(true);
    try {
      const r = await fetch(`/api/invitaciones?doc=${encodeURIComponent(nextDoc)}&phone=${encodeURIComponent(nextPhone)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) {
        setReady(false);
        setErr(d.error || "No se pudo abrir el pase.");
        return;
      }
      setReady(true);
      setOwner(d.ownerName || "");
      setLeft(d.left || 0);
      setTotal(d.total || 0);
      setUntil(d.until || "");
      setRows(d.invitations || []);
    } catch {
      setErr("No hubo respuesta del sistema.");
    } finally {
      setBusy(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (guestName.trim().length < 3 || guestDoc.trim().length < 5) {
      setErr("La invitación necesita el nombre y el documento de esa persona.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/invitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc, phone, guestName, guestDoc }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "No se creó la invitación.");
        return;
      }
      setIssued({
        id: d.id,
        guestName: d.guestName,
        guestDoc: d.guestDoc,
        pin: d.pin,
        enrollUrl: d.enrollUrl || "",
        ownerName: d.ownerName || owner,
        left: d.left || 0,
        total: d.total || 0,
      });
      setLeft(d.left || 0);
      setTotal(d.total || 0);
      setGuestName("");
      setGuestDoc("");
      await load();
    } catch {
      setErr("No hubo respuesta del sistema.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/invitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", id, doc, phone }),
      });
      const d = await r.json();
      if (!r.ok) {
        setErr(d.error || "No se anuló.");
        return;
      }
      if (issued?.id === id) setIssued(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gym-navy px-5 py-8 text-white">
      <div className="mx-auto max-w-md">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-gym-primary">Fuerza Élite</p>
        <h1 className="mt-2 text-3xl font-extrabold">Pase de invitados</h1>
        <p className="mt-2 text-sm text-gym-silver">El invitado entra por el rostro. Si no puede registrarlo, usa un PIN de un solo uso. Al entrar, la invitación expira.</p>

        {!ready && (
          <form className="mt-6 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); load(); }}>
            <label className="text-xs text-gym-muted">Tu documento
              <input className={field} value={doc} onChange={(e) => setDoc(e.target.value)} inputMode="numeric" autoComplete="off" />
            </label>
            <label className="text-xs text-gym-muted">Tu WhatsApp
              <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="300 123 4567" />
            </label>
            {err && <p className="text-sm text-status-warn">{err}</p>}
            <button className="btn-gym mt-2 py-3 text-sm" disabled={busy}>{busy ? "Revisando…" : "Abrir mi pase"}</button>
          </form>
        )}

        {ready && (
          <>
            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-gym-silver">{owner}</div>
              <div className="mt-1 text-4xl font-extrabold">{left}<span className="text-lg font-semibold text-gym-muted"> / {total}</span></div>
              <div className="text-sm text-gym-silver">invitaciones disponibles{until ? ` · hasta ${until}` : ""}</div>
            </div>

            {issued && (
              <section className="mt-4 rounded-3xl border border-gym-primary/40 bg-gym-primary/10 p-5">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-primary">Invitación de un solo uso</div>
                <div className="mt-1 text-lg font-bold">{issued.guestName}</div>
                <div className="text-sm text-gym-silver">{issued.guestDoc} · de parte de {issued.ownerName}</div>
                <div className="mt-1 text-sm text-gym-silver">Quedan {issued.left} de {issued.total}</div>
                {issued.enrollUrl ? (
                  <a href={issued.enrollUrl} className="btn-gym mt-4 block py-3 text-center text-sm">Registrar rostro</a>
                ) : (
                  <p className="mt-4 text-sm text-status-warn">No se pudo preparar el rostro. El PIN de abajo abre una sola vez.</p>
                )}
                <div className="mt-5 text-[11px] font-bold uppercase tracking-wider text-gym-muted">PIN de respaldo</div>
                <div className="mt-2 flex gap-2">
                  {issued.pin.split("").map((n, i) => (
                    <div key={i} className="flex h-14 flex-1 items-center justify-center rounded-2xl border border-white/15 bg-black/30 text-2xl font-black">{n}</div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gym-muted">Solo si no registra el rostro. Expira en el momento en que se usa.</p>
              </section>
            )}

            <form onSubmit={create} className="mt-5 flex flex-col gap-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Nueva invitación</div>
              <label className="text-xs text-gym-muted">Nombre del invitado
                <input className={field} value={guestName} onChange={(e) => setGuestName(e.target.value)} />
              </label>
              <label className="text-xs text-gym-muted">Documento del invitado
                <input className={field} value={guestDoc} onChange={(e) => setGuestDoc(e.target.value)} />
              </label>
              {err && <p className="text-sm text-status-warn">{err}</p>}
              <button className="btn-gym py-3 text-sm" disabled={busy || left < 1}>{busy ? "Generando…" : "Generar invitación"}</button>
            </form>

            <ul className="mt-6 flex flex-col gap-2">
              {rows.map((row) => (
                <li key={row.id} className="rounded-2xl border border-white/10 px-4 py-3">
                  <div className="font-semibold">{row.guestName}</div>
                  <div className="text-xs text-gym-muted">{row.guestDoc}</div>
                  {row.status === "pending" && <div className="mt-1 text-sm text-gym-primary">Rostro o PIN {row.pin} · sin usar</div>}
                  {row.status === "used" && (
                    <div className="mt-1 text-sm text-status-ok">
                      Ingresó{row.entryVia === "rostro" ? " por rostro" : row.entryVia === "pin" ? " por PIN" : ""}
                      {row.usedAt ? ` · ${hora(row.usedAt)}` : ""}
                      {row.ownerName ? ` · de parte de ${row.ownerName}` : ""}
                      {row.creditsLeftAfter != null ? ` · quedan ${row.creditsLeftAfter}` : ""}
                    </div>
                  )}
                  {row.status === "cancelled" && <div className="mt-1 text-sm text-gym-muted">Anulada · el cupo volvió</div>}
                  {row.status === "expired" && <div className="mt-1 text-sm text-gym-muted">Venció sin usarse</div>}
                  {row.status === "pending" && (
                    <button type="button" className="mt-2 text-xs font-semibold text-gym-silver" onClick={() => cancel(row.id)} disabled={busy}>Anular</button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
