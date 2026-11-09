"use client";

import { useEffect, useMemo, useState } from "react";
import GymShell from "../../components/GymShell";
import { getActiveGymId } from "../../lib/session";

type Product = {
  id: string;
  sku: string;
  name: string;
  floorQty: number;
  warehouseQty: number;
  minStock: number;
  active: boolean;
  itemKind?: string;
  tracksInventory?: boolean;
};

export default function InventarioPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [items, setItems] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Record<string, { floor: string; warehouse: string }>>({});
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    fetch(`/api/retail/products?gym=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.items || []).filter((p: Product) => p.active && p.itemKind !== "SERVICE" && p.tracksInventory !== false);
        setItems(rows);
        const next: Record<string, { floor: string; warehouse: string }> = {};
        for (const p of rows) next[p.id] = { floor: String(p.floorQty), warehouse: String(p.warehouseQty) };
        setDraft(next);
      })
      .catch(() => setItems([]));
  }, []);

  const visible = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return items;
    return items.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(n));
  }, [items, q]);

  async function guardar(p: Product) {
    const row = draft[p.id];
    if (!row) return;
    setSaving(p.id);
    setMsg("");
    const res = await fetch("/api/retail/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gym: gymId,
        id: p.id,
        floorQty: Number(row.floor) || 0,
        warehouseQty: Number(row.warehouse) || 0,
      }),
    });
    const data = await res.json();
    setSaving("");
    if (!data.ok) {
      setMsg(data.error || "No se pudo guardar el conteo.");
      return;
    }
    setItems((cur) => cur.map((x) => (x.id === p.id ? { ...x, floorQty: data.product.floorQty, warehouseQty: data.product.warehouseQty } : x)));
    setMsg(`${p.name}: gimnasio ${data.product.floorQty}, bodega ${data.product.warehouseQty}.`);
  }

  return (
    <GymShell active="inventario">
      <div className="px-6 py-6">
        <h2 className="text-xl font-extrabold text-white">Inventario</h2>
        <p className="mt-1 text-sm text-gym-muted">Conteo de lo que está en el gimnasio y en bodega. Guardar un renglón reemplaza esas cantidades.</p>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="mt-4 w-full max-w-sm rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-gym-silver outline-none focus:border-gym-primary" />
        {msg && <p className="mt-3 text-sm text-gym-primary">{msg}</p>}
        <div className="glass mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-gym-muted">
              <tr>
                <th className="px-4 py-3">Producto</th>
                <th className="px-3 py-3">Gimnasio</th>
                <th className="px-3 py-3">Bodega</th>
                <th className="px-3 py-3">Mínimo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => {
                const low = p.minStock > 0 && p.floorQty < p.minStock;
                return (
                  <tr key={p.id} className="border-t border-gym-border/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-[11px] text-gym-muted">{p.sku}{low ? " · bajo mínimo" : ""}</div>
                    </td>
                    <td className="px-3 py-3">
                      <input value={draft[p.id]?.floor ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: { floor: e.target.value, warehouse: d[p.id]?.warehouse ?? "0" } }))} className="w-20 rounded-lg border border-gym-border bg-gym-navy/80 px-2 py-1 text-white" />
                    </td>
                    <td className="px-3 py-3">
                      <input value={draft[p.id]?.warehouse ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [p.id]: { floor: d[p.id]?.floor ?? "0", warehouse: e.target.value } }))} className="w-20 rounded-lg border border-gym-border bg-gym-navy/80 px-2 py-1 text-white" />
                    </td>
                    <td className="px-3 py-3 text-gym-silver">{p.minStock || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" disabled={saving === p.id} onClick={() => guardar(p)} className="rounded-lg border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver disabled:opacity-40">{saving === p.id ? "Guardando…" : "Guardar"}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <p className="px-4 py-8 text-center text-sm text-gym-muted">No hay productos con inventario.</p>}
        </div>
      </div>
    </GymShell>
  );
}
