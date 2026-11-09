"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

type Product = { id: string; name: string; sku: string; cost: number; active: boolean; itemKind?: string };
type Supplier = { id: string; name: string; active: boolean };
type Line = { productId: string; name: string; sku: string; qty: number; cost: number };
type Order = {
  id: string;
  number: number;
  supplierName: string;
  status: "pedido" | "recibido" | "anulado";
  createdAt: string;
  note: string;
  lines: Line[];
  by: string;
};

const inputCls = "rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-gym-silver outline-none focus:border-gym-primary";

export default function PedidosPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (id: string) => {
    const [p, s, o] = await Promise.all([
      fetch(`/api/retail/products?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/retail/suppliers?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/retail/orders?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    const goods = (p.items || []).filter((x: Product) => x.active && x.itemKind !== "SERVICE");
    setProducts(goods);
    setSuppliers((s.items || []).filter((x: Supplier) => x.active));
    setOrders(o.items || []);
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
  }, [load]);

  function addLine() {
    const p = products.find((x) => x.id === productId);
    const n = Math.max(0, Number(qty) || 0);
    if (!p || n <= 0) return;
    setLines((cur) => [...cur, { productId: p.id, name: p.name, sku: p.sku, qty: n, cost: cost === "" ? p.cost : Number(cost) || 0 }]);
    setQty("1");
    setCost("");
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!lines.length || !supplierId) {
      setMsg("Elige proveedor y al menos un producto.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/retail/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, supplierId, note, lines }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setMsg(data.error === "pedido_vacio" ? "El pedido no tiene cantidades." : data.error === "proveedor_no_encontrado" ? "Ese proveedor no está activo." : data.error || "No se pudo crear el pedido.");
      return;
    }
    setLines([]);
    setNote("");
    setOrders(data.items || []);
    setMsg(`Pedido #${data.order.number} creado. Recibirlo suma las unidades a bodega.`);
  }

  async function accion(id: string, action: "recibir" | "anular") {
    setBusy(true);
    const res = await fetch("/api/retail/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, id, action }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setMsg(data.error === "ya_recibido" ? "Ese pedido ya entró a bodega." : "No se pudo actualizar el pedido.");
      return;
    }
    setOrders(data.items || []);
    setMsg(action === "recibir" ? "Entrada a bodega registrada." : "Pedido anulado.");
  }

  return (
    <GymShell active="pedidos">
      <div className="px-6 py-6">
        <h2 className="text-xl font-extrabold text-white">Pedidos</h2>
        <p className="mt-1 text-sm text-gym-muted">Compra al proveedor. Al recibirlo, las unidades entran a bodega. De ahí se bajan al gimnasio desde el catálogo.</p>
        {msg && <p className="mt-3 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</p>}
        <form onSubmit={crear} className="glass mt-4 grid gap-3 p-5">
          <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value)} required>
            <option value="">Proveedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <div className="grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]">
            <select className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Producto</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className={inputCls} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Cant." />
            <input className={inputCls} inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Costo" />
            <button type="button" onClick={addLine} className="rounded-xl border border-gym-border px-3 py-2 text-sm font-semibold text-gym-silver">Agregar</button>
          </div>
          {lines.length > 0 && (
            <ul className="divide-y divide-gym-border/40 text-sm">
              {lines.map((l, i) => (
                <li key={`${l.productId}-${i}`} className="flex items-center justify-between py-2">
                  <span className="text-white">{l.qty} × {l.name}</span>
                  <span className="text-gym-muted">{l.cost > 0 ? cop(l.cost) : "sin costo"}</span>
                </li>
              ))}
            </ul>
          )}
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota" />
          <button className="btn-gym" disabled={busy}>Crear pedido</button>
        </form>
        <div className="mt-5 flex flex-col gap-3">
          {orders.length === 0 && <p className="text-sm text-gym-muted">Todavía no hay pedidos en esta sede.</p>}
          {orders.map((o) => (
            <article key={o.id} className="glass p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-extrabold text-white">Pedido #{o.number} · {o.supplierName}</div>
                  <div className="text-[11px] text-gym-muted">{new Date(o.createdAt).toLocaleString("es-CO", { timeZone: "America/Bogota" })} · {o.by} · {o.status}</div>
                </div>
                {o.status === "pedido" && (
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => accion(o.id, "recibir")} className="btn-gym px-3 py-1.5 text-xs">Recibir en bodega</button>
                    <button type="button" disabled={busy} onClick={() => accion(o.id, "anular")} className="rounded-lg border border-gym-border px-3 py-1.5 text-xs font-semibold text-status-err">Anular</button>
                  </div>
                )}
              </div>
              <ul className="mt-2 text-sm text-gym-silver">
                {o.lines.map((l, i) => <li key={i}>{l.qty} × {l.name}{l.cost > 0 ? ` · costo ${cop(l.cost)}` : ""}</li>)}
              </ul>
              {o.note && <p className="mt-1 text-xs text-gym-muted">{o.note}</p>}
            </article>
          ))}
        </div>
      </div>
    </GymShell>
  );
}
