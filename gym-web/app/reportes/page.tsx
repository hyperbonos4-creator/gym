"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

type Rango = "hoy" | "7" | "30";
type Report = {
  from: string;
  to: string;
  tickets: number;
  voids: number;
  voidTotal: number;
  revenue: number;
  discount: number;
  costKnown: number;
  revenueWithCost: number;
  missingCost: number;
  margin: number;
  expenses: number;
  expensesByCategory: { name: string; total: number }[];
  medios: { efectivo: number; tarjeta: number; transferencia: number; wompi: number };
  products: { name: string; sku: string; qty: number; revenue: number; cost: number }[];
  cashiers: { name: string; tickets: number; revenue: number }[];
  low: { id: string; name: string; sku: string; floorQty: number; warehouseQty: number; minStock: number }[];
  closes: { id: string; closedAt: string | null; openingFloat: number; counted: number | null; esperado: number; difference: number | null }[];
};

function dia(offset: number) {
  return new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

export default function ReportesPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [rango, setRango] = useState<Rango>("hoy");
  const [report, setReport] = useState<Report | null>(null);

  const load = useCallback(async (id: string, span: Rango) => {
    const to = dia(0);
    const from = span === "hoy" ? to : dia(span === "7" ? -6 : -29);
    const res = await fetch(`/api/retail/reports?gym=${encodeURIComponent(id)}&from=${from}&to=${to}`, { cache: "no-store" });
    const data = await res.json();
    setReport(data.report || null);
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id, rango);
  }, [load, rango, gymId]);

  const r = report;

  return (
    <GymShell active="reportes">
      <div className="px-6 py-6">
        <h2 className="text-xl font-extrabold text-white">Reportes</h2>
        <p className="mt-1 text-sm text-gym-muted">Ventas cobradas, medios, gastos y stock bajo. El margen solo cuenta productos que tienen costo cargado.</p>
        <div className="mt-4 flex gap-2">
          {([["hoy", "Hoy"], ["7", "7 días"], ["30", "30 días"]] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setRango(k)} className={`rounded-xl border px-3 py-1.5 text-xs font-semibold ${rango === k ? "border-gym-primary bg-gym-primary/15 text-gym-primary" : "border-gym-border text-gym-silver"}`}>{label}</button>
          ))}
        </div>
        {!r && <p className="mt-6 text-sm text-gym-muted">Leyendo ventas…</p>}
        {r && (
          <>
            <p className="mt-3 text-xs text-gym-muted">Del {r.from} al {r.to}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ["Ventas cobradas", cop(r.revenue)],
                ["Tickets", String(r.tickets)],
                ["Anuladas", `${r.voids} · ${cop(r.voidTotal)}`],
                ["Gastos", cop(r.expenses)],
              ].map(([l, v]) => (
                <div key={l} className="glass-soft px-4 py-3">
                  <div className="text-[11px] text-gym-muted">{l}</div>
                  <div className="text-lg font-extrabold text-white">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="glass p-4">
                <h3 className="text-sm font-bold text-white">Medios de pago</h3>
                <ul className="mt-3 space-y-1 text-sm">
                  <li className="flex justify-between"><span className="text-gym-muted">Efectivo</span><span>{cop(r.medios.efectivo)}</span></li>
                  <li className="flex justify-between"><span className="text-gym-muted">Tarjeta</span><span>{cop(r.medios.tarjeta)}</span></li>
                  <li className="flex justify-between"><span className="text-gym-muted">Transferencia</span><span>{cop(r.medios.transferencia)}</span></li>
                  <li className="flex justify-between"><span className="text-gym-muted">Wompi</span><span>{cop(r.medios.wompi)}</span></li>
                </ul>
                <p className="mt-3 text-xs text-gym-muted">Wompi no entra al cajón. El descuento del rango es {cop(r.discount)}.</p>
              </section>
              <section className="glass p-4">
                <h3 className="text-sm font-bold text-white">Margen</h3>
                {r.costKnown > 0 ? (
                  <div className="mt-3 text-sm">
                    <div className="flex justify-between"><span className="text-gym-muted">Ventas con costo</span><span>{cop(r.revenueWithCost)}</span></div>
                    <div className="flex justify-between"><span className="text-gym-muted">Costo</span><span>{cop(r.costKnown)}</span></div>
                    <div className="mt-2 flex justify-between text-base font-extrabold text-white"><span>Margen</span><span>{cop(r.margin)}</span></div>
                    {r.missingCost > 0 && <p className="mt-2 text-xs text-gym-muted">{r.missingCost} renglones sin costo cargado quedan fuera del margen.</p>}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gym-muted">Sin costo cargado. No hay margen que mostrar.</p>
                )}
                {r.expensesByCategory.length > 0 && (
                  <ul className="mt-4 space-y-1 text-sm">
                    {r.expensesByCategory.map((c) => (
                      <li key={c.name} className="flex justify-between"><span className="text-gym-muted">{c.name}</span><span>{cop(c.total)}</span></li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            <section className="glass mt-4 p-4">
              <h3 className="text-sm font-bold text-white">Productos</h3>
              {r.products.length === 0 && <p className="mt-3 text-sm text-gym-muted">Sin ventas en el rango.</p>}
              <ul className="mt-2 divide-y divide-gym-border/40 text-sm">
                {r.products.map((p) => (
                  <li key={p.sku + p.name} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-white">{p.qty} × {p.name}</span>
                    <span>{cop(p.revenue)}{p.cost > 0 ? <span className="ml-2 text-xs text-gym-muted">costo {cop(p.cost)}</span> : <span className="ml-2 text-xs text-gym-muted">sin costo</span>}</span>
                  </li>
                ))}
              </ul>
            </section>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="glass p-4">
                <h3 className="text-sm font-bold text-white">Stock bajo en el gimnasio</h3>
                {r.low.length === 0 && <p className="mt-3 text-sm text-gym-muted">Nada por debajo del mínimo.</p>}
                <ul className="mt-2 text-sm">
                  {r.low.map((p) => (
                    <li key={p.id} className="flex justify-between py-1"><span>{p.name}</span><span className="text-gym-muted">{p.floorQty} / mín {p.minStock} · bodega {p.warehouseQty}</span></li>
                  ))}
                </ul>
              </section>
              <section className="glass p-4">
                <h3 className="text-sm font-bold text-white">Cierres de caja</h3>
                {r.closes.length === 0 && <p className="mt-3 text-sm text-gym-muted">No hay turnos cerrados en el rango.</p>}
                <ul className="mt-2 text-sm">
                  {r.closes.map((c) => (
                    <li key={c.id} className="py-1">
                      Contado {c.counted == null ? "—" : cop(c.counted)} · esperado {cop(c.esperado)}
                      {c.difference != null && <span className="text-gym-muted"> · diferencia {cop(c.difference)}</span>}
                    </li>
                  ))}
                </ul>
                {r.cashiers.length > 0 && (
                  <ul className="mt-3 text-sm">
                    {r.cashiers.map((c) => <li key={c.name} className="flex justify-between"><span className="text-gym-muted">{c.name}</span><span>{c.tickets} · {cop(c.revenue)}</span></li>)}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </GymShell>
  );
}
