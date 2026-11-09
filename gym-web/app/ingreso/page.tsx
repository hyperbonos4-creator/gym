"use client";

import { useState } from "react";
import { publicBrand } from "../../lib/brand";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "ok"];

type Receipt = { guestName: string; guestDoc: string; ownerName: string; left: number; total: number };

export default function IngresoPage() {
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);

  async function redeem(code: string) {
    if (busy) return;
    setBusy(true);
    setReceipt(null);
    setMsg("");
    try {
      const r = await fetch("/api/invitaciones/usar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json();
      if (!r.ok) {
        setMsg(d.error || "No se aceptó el ingreso.");
        setPin("");
        return;
      }
      setReceipt({
        guestName: d.guestName,
        guestDoc: d.guestDoc,
        ownerName: d.ownerName || "",
        left: d.left ?? 0,
        total: d.total ?? 0,
      });
      setPin("");
    } catch {
      setMsg("No hubo respuesta. Si el torniquete no se movió, el PIN sigue vigente.");
    } finally {
      setBusy(false);
    }
  }

  function press(key: string) {
    if (busy || receipt) return;
    if (key === "borrar") {
      setPin((p) => p.slice(0, -1));
      setMsg("");
      return;
    }
    if (key === "ok") {
      if (pin.length === 4) redeem(pin);
      return;
    }
    const next = (pin + key).slice(0, 4);
    setPin(next);
    setMsg("");
    if (next.length === 4) redeem(next);
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#070b14] px-5 py-8 text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-gym-primary">{publicBrand().name}</p>
        <h1 className="mt-2 text-3xl font-extrabold">Ingreso de invitado</h1>
        <p className="mt-2 text-sm leading-relaxed text-gym-silver">La cámara reconoce el rostro. Si no hay rostro, este PIN abre una sola vez y la invitación expira en ese momento.</p>

        {receipt ? (
          <section className="mt-8 rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-300">Ingreso registrado</div>
            <div className="mt-2 text-2xl font-extrabold">{receipt.guestName}</div>
            <div className="text-sm text-gym-silver">{receipt.guestDoc}</div>
            <div className="mt-4 text-sm text-white">De parte de {receipt.ownerName}</div>
            <div className="mt-1 text-sm text-gym-silver">Quedan {receipt.left} de {receipt.total} entradas en ese pase</div>
            <p className="mt-4 text-xs text-emerald-200">Esta invitación ya expiró. No vuelve a abrir.</p>
            <button type="button" className="mt-5 text-xs font-semibold text-gym-silver" onClick={() => setReceipt(null)}>Otro ingreso</button>
          </section>
        ) : (
          <>
            <div className="mt-10 flex justify-center gap-3" aria-label="PIN">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex h-16 w-14 items-center justify-center rounded-2xl border text-2xl font-black ${pin.length > i ? "border-gym-primary bg-gym-primary/15 text-white" : "border-white/10 bg-white/5 text-transparent"}`}
                >
                  {pin[i] || "0"}
                </div>
              ))}
            </div>
            {msg && <p className="mt-4 text-center text-sm text-status-warn">{msg}</p>}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() => press(key)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] py-5 text-xl font-semibold transition active:scale-[0.98] active:bg-white/10 disabled:opacity-40"
                >
                  {key === "borrar" ? "⌫" : key === "ok" ? "Entrar" : key}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
