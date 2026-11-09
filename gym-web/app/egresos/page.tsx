"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop, enteros, miles } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

type Expense = { id: string; category: string; amount: number; note: string; by: string; createdAt: string };
const CATS = ["Compra de mercancía", "Servicios", "Nómina", "Aseo", "Mantenimiento", "Otros"];
const inputCls = "rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-gym-silver outline-none focus:border-gym-primary";

export default function EgresosPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [items, setItems] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState(CATS[0]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [rango, setRango] = useState<"hoy" | "7" | "30">("hoy");

  const load = useCallback(async (id: string, span: "hoy" | "7" | "30") => {
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const from = span === "hoy" ? hoy : new Date(Date.now() - (span === "7" ? 6 : 29) * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const res = await fetch(`/api/retail/expenses?gym=${encodeURIComponent(id)}&historial=1&from=${from}&to=${hoy}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items || []);
    setTotal(data.total || 0);
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id, rango);
  }, [load, rango]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/retail/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, category, amount: enteros(amount), note }),
    });
    const data = await res.json();
    if (!data.ok) {
      setMsg(data.error === "caja_cerrada" ? "Abre la caja. Un gasto sale del turno abierto." : "Escribe un monto mayor a cero.");
      return;
    }
    setAmount("");
    setNote("");
    setMsg("Gasto registrado solo en esta sede. Resta del efectivo esperado de la caja.");
    load(gymId, rango);
  }

  return (
    <GymShell active="egresos">
      <div className="px-6 py-6">
        <div className="mb-5">
          <h2 className="text-xl font-extrabold text-white">Gastos</h2>
          <p className="text-sm text-gym-muted">Salidas de caja de esta sede. En el rango van {cop(total)}.</p>
        </div>
        <div className="mb-4 flex gap-2">
          {([["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setRango(k)} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${rango === k ? "border-gym-primary bg-gym-primary/15 text-gym-primary" : "border-gym-border text-gym-silver"}`}>{label}</button>
          ))}
        </div>
        {msg && <div className="mb-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</div>}
        <form onSubmit={save} className="glass mb-5 grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className={inputCls} inputMode="numeric" placeholder="Monto" value={amount} onChange={(e) => setAmount(miles(e.target.value))} required />
          <input className={`${inputCls} sm:col-span-2`} placeholder="Nota (proveedor, factura…)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-gym sm:col-span-2">Registrar egreso</button>
        </form>
        <div className="glass divide-y divide-gym-border/50">
          {items.length === 0 && <p className="px-4 py-8 text-center text-sm text-gym-muted">Sin gastos en este rango.</p>}
          {items.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-white">{e.category}</div>
                <div className="text-[11px] text-gym-muted">{e.note || "Sin nota"} · {e.by} · {new Date(e.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div className="text-sm font-bold text-status-err">{cop(e.amount)}</div>
            </div>
          ))}
        </div>
      </div>
    </GymShell>
  );
}
