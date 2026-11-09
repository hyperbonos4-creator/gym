"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

type Product = {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  floorQty?: number;
  warehouseQty?: number;
  active: boolean;
  itemKind?: string;
  tracksInventory?: boolean;
};
type Line = { product: Product; qty: number; price: number };
type Modo = "efectivo" | "transferencia" | "tarjeta" | "mixto";
type Via = "Nequi" | "Bold" | "Crédito" | "Débito";
type Sale = {
  id: string;
  number: number;
  total: number;
  subtotal: number;
  discount: number;
  items: { name: string; sku?: string; qty: number; price: number; lineTotal: number }[];
  payments: { method: string; amount: number }[];
  change: number;
  note: string;
  createdAt: string;
};
type Summary = {
  tickets: number;
  total: number;
  byMethod: { efectivo: number; tarjeta: number; transferencia: number };
  expectedCash: number;
  efectivoTurno: number;
  gastosEfectivoTurno: number;
  session: { id: string; openingFloat: number; openedAt: string; openedBy: string } | null;
};
type Espera = { id: string; label: string; lines: { productId: string; qty: number; price: number }[] };

const BILLETES = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
const DENOM = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];
const CLAVE_ESPERA = "gym.caja.espera";

function pesos(n: number) {
  return cop(Math.max(0, Math.round(n)));
}

export default function CajaPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [listo, setListo] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todos");
  const [cart, setCart] = useState<Line[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [fase, setFase] = useState<"vender" | "cerrar" | "informe">("vender");
  const [fondo, setFondo] = useState("100000");
  const [tecladoFondo, setTecladoFondo] = useState(false);
  const [conteo, setConteo] = useState<Record<number, string>>({});
  const [denomAbierta, setDenomAbierta] = useState<number | null>(null);
  const [informe, setInforme] = useState<{ contado: number; esperado: number } | null>(null);
  const [modo, setModo] = useState<Modo | null>(null);
  const [via, setVia] = useState<Via | null>(null);
  const [recibido, setRecibido] = useState("");
  const [parteEfectivo, setParteEfectivo] = useState("");
  const [cobro, setCobro] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cobrada, setCobrada] = useState<Sale | null>(null);
  const [pregunta, setPregunta] = useState(false);
  const [espera, setEspera] = useState<Espera[]>([]);
  const [notaEspera, setNotaEspera] = useState("");
  const busca = useRef<HTMLInputElement>(null);

  const load = useCallback(async (id: string) => {
    const [p, s] = await Promise.all([
      fetch(`/api/retail/products?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/retail/sales?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setProducts((p.items || []).filter((x: Product) => x.active));
    setSummary(s.summary || null);
    setListo(true);
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
    try {
      const raw = sessionStorage.getItem(CLAVE_ESPERA);
      if (raw) setEspera(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [load]);

  const cats = useMemo(() => ["Todos", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return products.filter((p) => (cat === "Todos" || p.category === cat) && (!s || [p.name, p.sku, p.barcode].some((v) => v.toLowerCase().includes(s))));
  }, [products, q, cat]);

  const total = cart.reduce((a, l) => a + l.price * l.qty, 0);

  function salaDe(p: Product) {
    if (p.itemKind === "SERVICE" || p.tracksInventory === false) return Number.POSITIVE_INFINITY;
    return p.floorQty ?? p.stock;
  }

  function agregar(p: Product, qty = 1) {
    const sala = salaDe(p);
    const bodega = p.warehouseQty || 0;
    if (sala <= 0) {
      setError(bodega > 0 ? `En el gimnasio no hay ${p.name}. En bodega hay ${bodega}. Bájelo al gimnasio desde el catálogo.` : `${p.name} está agotado.`);
      return;
    }
    setError("");
    setCobrada(null);
    setPregunta(false);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product.id === p.id);
      const nextQty = (i >= 0 ? prev[i].qty : 0) + qty;
      if (nextQty > sala) {
        setError(`En el gimnasio solo hay ${sala} de ${p.name}.`);
        return prev;
      }
      if (i >= 0) return prev.map((l, idx) => (idx === i ? { ...l, qty: nextQty } : l));
      return [...prev, { product: p, qty, price: p.price }];
    });
  }

  const agregarRef = useRef(agregar);
  agregarRef.current = agregar;
  const productsRef = useRef(products);
  productsRef.current = products;
  const esperaRef = useRef<() => void>(() => {});
  esperaRef.current = dejarEspera;
  const cartRef = useRef(cart);
  cartRef.current = cart;

  function commitScan(raw: string) {
    const code = raw.trim().toLowerCase();
    if (!code) return false;
    const exact = productsRef.current.find((p) => p.barcode.toLowerCase() === code || p.sku.toLowerCase() === code);
    if (!exact) {
      setError(`No hay un producto con el código ${raw.trim()}.`);
      return false;
    }
    agregarRef.current(exact, 1);
    setQ("");
    return true;
  }

  useEffect(() => {
    let buf = "";
    let timer = 0;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "F9") {
        e.preventDefault();
        if (cartRef.current.length) setCobro(true);
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        esperaRef.current();
        return;
      }
      if (e.key === "Enter") {
        if (buf) commitScan(buf);
        buf = "";
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buf += e.key;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { buf = ""; }, 90);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function guardarEspera(next: Espera[]) {
    setEspera(next);
    sessionStorage.setItem(CLAVE_ESPERA, JSON.stringify(next));
  }

  function dejarEspera() {
    if (!cart.length) return;
    guardarEspera([...espera, {
      id: String(Date.now()),
      label: notaEspera.trim() || `${cart.reduce((n, l) => n + l.qty, 0)} productos`,
      lines: cart.map((l) => ({ productId: l.product.id, qty: l.qty, price: l.price })),
    }]);
    setCart([]);
    setNotaEspera("");
    setError("");
  }

  function retomar(c: Espera) {
    const lines: Line[] = [];
    for (const l of c.lines) {
      const p = products.find((x) => x.id === l.productId);
      if (p) lines.push({ product: p, qty: l.qty, price: l.price });
    }
    setCart(lines);
    guardarEspera(espera.filter((x) => x.id !== c.id));
  }

  const efectivoACobrar = modo === "mixto" ? Math.max(0, Math.round(Number(parteEfectivo) || 0)) : total;
  const resto = modo === "mixto" ? total - efectivoACobrar : 0;
  const recibidoN = Math.round(Number(recibido) || 0);
  const falta = (modo === "efectivo" || modo === "mixto") && recibido !== "" && recibidoN < efectivoACobrar;
  const cambio = Math.max(0, recibidoN - efectivoACobrar);
  const faltaVia = (modo === "transferencia" || modo === "mixto") && via !== "Nequi" && via !== "Bold";
  const faltaTarjeta = modo === "tarjeta" && via !== "Crédito" && via !== "Débito";
  const mixtoMal = modo === "mixto" && (efectivoACobrar <= 0 || resto <= 0);

  function elegirModo(m: Modo) {
    setModo(m);
    setVia(null);
    setError("");
    if (m === "efectivo") setRecibido("");
  }

  function sumarBillete(v: number) {
    setRecibido(String((Math.round(Number(recibido) || 0) + v)));
  }

  async function cobrar() {
    if (!cart.length || !modo) return;
    if (faltaVia || faltaTarjeta || mixtoMal) {
      setError(faltaVia ? "Toque Nequi o Bold." : faltaTarjeta ? "Toque si es crédito o débito." : "En mixto el efectivo es una parte. El resto va por transferencia.");
      return;
    }
    const rec = modo === "efectivo" || modo === "mixto" ? (recibido.trim() === "" ? efectivoACobrar : recibidoN) : efectivoACobrar;
    if ((modo === "efectivo" || modo === "mixto") && rec < efectivoACobrar) {
      setError("El efectivo recibido no cubre.");
      return;
    }
    const payments = modo === "efectivo"
      ? [{ method: "efectivo", amount: rec }]
      : modo === "tarjeta"
        ? [{ method: "tarjeta", amount: total }]
        : modo === "transferencia"
          ? [{ method: "transferencia", amount: total }]
          : [
              { method: "efectivo", amount: rec },
              { method: "transferencia", amount: resto },
            ];
    const nota = via ? via : "";
    setBusy(true);
    setError("");
    const res = await fetch("/api/retail/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gym: gymId,
        items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })),
        payments,
        note: nota,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      const err = String(data.error || "");
      setError(err === "caja_cerrada" ? "Abre la caja antes de cobrar." : err || "No se pudo cobrar.");
      return;
    }
    setCobrada(data.sale);
    setPregunta(true);
    setCart([]);
    setCobro(false);
    setModo(null);
    setVia(null);
    setRecibido("");
    setParteEfectivo("");
    setSummary(data.summary);
    load(gymId);
  }

  function imprimir(s: Sale) {
    const filas = s.items.map((i) => `
      <div class="lin">
        <p class="nom">${esc(i.name)}</p>
        <p class="det"><span>${i.qty} × ${esc(cop(i.price))}</span><span>${esc(cop(i.lineTotal))}</span></p>
      </div>`).join("");
    const pagos = s.payments.map((p) => `<p class="det"><span>${esc(p.method === "tarjeta" && s.note ? s.note : p.method === "transferencia" && s.note ? s.note : p.method)}</span><span>${esc(cop(p.amount))}</span></p>`).join("");
    const w = window.open("", "_blank", "noopener,width=320,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Venta ${s.number}</title>
      <style>
        @page { size: 80mm auto; margin: 4mm; }
        body { width: 72mm; margin: 0 auto; color: #111; font-family: Arial, sans-serif; }
        h1 { margin: 8px 0 0; text-align: center; font-size: 16px; }
        .sub { margin: 2px 0 8px; text-align: center; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; }
        .num { text-align: center; font-family: ui-monospace, monospace; font-size: 12px; letter-spacing: .12em; }
        .fecha { text-align: center; font-size: 11px; color: #444; margin-bottom: 8px; }
        .lin { border-top: 1px solid #ddd; padding: 6px 0; }
        .nom { margin: 0; font-size: 13px; font-weight: 700; }
        .det { margin: 2px 0 0; display: flex; justify-content: space-between; font-size: 12px; }
        .total { margin-top: 8px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #111; padding-top: 8px; }
        .total strong { font-size: 22px; }
        .cambio { margin-top: 6px; font-size: 13px; font-weight: 700; }
      </style></head><body>
      <h1>Fuerza Élite</h1>
      <p class="sub">El poder de la transformación</p>
      <p class="num">VENTA ${s.number}</p>
      <p class="fecha">${esc(new Date(s.createdAt).toLocaleString("es-CO", { timeZone: "America/Bogota" }))}</p>
      ${filas}
      <div class="total"><span>Total a pagar</span><strong>${esc(cop(s.total))}</strong></div>
      <div style="margin-top:8px">${pagos}</div>
      ${s.change > 0 ? `<p class="cambio">Cambio ${esc(cop(s.change))}</p>` : `<p class="cambio">No hay cambio que devolver.</p>`}
      <script>onload=()=>{print();}</script>
      </body></html>`);
    w.document.close();
  }

  async function abrirTurno() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/retail/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, float: Math.round(Number(fondo) || 0) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) setError(data.error === "caja_ya_abierta" ? "La caja ya está abierta." : data.error || "No se pudo abrir.");
    else setSummary(data.summary);
  }

  const contado = DENOM.reduce((n, v) => n + v * (Math.max(0, Math.round(Number(conteo[v]) || 0))), 0);
  const esperado = summary?.expectedCash || 0;
  const diff = contado - esperado;
  const cuadra = diff === 0;
  const suelto = diff !== 0 && Math.abs(diff) < 50;
  const sePuede = cuadra || suelto;

  async function cerrarTurno() {
    if (!sePuede) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/retail/cash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, action: "close", counted: contado }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError("No hay una caja abierta.");
      return;
    }
    setInforme({ contado, esperado });
    setConteo({});
    setFase("informe");
    setSummary(data.summary);
  }

  const sesion = summary?.session;

  return (
    <GymShell active="caja">
      {!listo && <p className="px-6 py-10 text-sm text-gym-muted">Abriendo caja…</p>}

      {listo && !sesion && fase !== "informe" && (
        <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-5 px-6">
          <div>
            <h2 className="text-2xl font-extrabold text-white">Abrir caja</h2>
            <p className="mt-1 text-sm text-gym-muted">Se abre el turno con el efectivo que hay en el cajón. Sin turno no se cobra.</p>
          </div>
          {error && <p className="rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-2 text-sm text-status-err">{error}</p>}
          <button type="button" onClick={() => setTecladoFondo(true)} className="rounded-2xl border border-gym-border bg-gym-navy/60 px-4 py-5 text-left">
            <div className="text-xs text-gym-muted">Fondo inicial</div>
            <div className="text-3xl font-extrabold text-white">{pesos(Number(fondo) || 0)}</div>
          </button>
          <button type="button" disabled={busy} onClick={abrirTurno} className="btn-gym py-4 text-base disabled:opacity-50">Abrir turno</button>
          {tecladoFondo && (
            <Teclado
              titulo="Fondo inicial"
              valor={fondo}
              onValor={setFondo}
              onCerrar={() => setTecladoFondo(false)}
            />
          )}
        </div>
      )}

      {listo && fase === "informe" && informe && (
        <div className="mx-auto max-w-lg px-6 py-8">
          <h2 className="text-2xl font-extrabold text-white">Caja cerrada</h2>
          <p className="mt-1 text-sm text-gym-muted">El efectivo esperado es el fondo, más el efectivo del turno, menos los gastos de ese turno. Tarjeta, transferencia y Wompi no entran al cajón.</p>
          <dl className="glass mt-4 divide-y divide-gym-border/50 text-sm">
            <div className="flex justify-between px-4 py-3"><dt>Contado</dt><dd className="font-bold">{pesos(informe.contado)}</dd></div>
            <div className="flex justify-between px-4 py-3"><dt>Se esperaba</dt><dd className="font-bold">{pesos(informe.esperado)}</dd></div>
            <div className="flex justify-between px-4 py-3"><dt>Diferencia</dt><dd className="font-bold">{pesos(informe.contado - informe.esperado)}</dd></div>
          </dl>
          <button type="button" className="btn-gym mt-6 w-full" onClick={() => { setFase("vender"); setInforme(null); }}>Listo</button>
        </div>
      )}

      {listo && sesion && fase === "cerrar" && (
        <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Cerrar caja</h2>
              <p className="mt-1 text-sm text-gym-muted">Cuente el dinero. La caja solo se cierra si el conteo cuadra con lo que debía haber.</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 rounded-xl border border-gym-border px-4 py-3 text-sm">
            <dt className="text-gym-muted">Fondo</dt>
            <dd className="text-right font-semibold">{pesos(sesion.openingFloat)}</dd>
            <dt className="text-gym-muted">Efectivo del turno</dt>
            <dd className="text-right font-semibold">{pesos(summary?.efectivoTurno || 0)}</dd>
            <dt className="text-gym-muted">Gastos del turno</dt>
            <dd className="text-right font-semibold">{pesos(summary?.gastosEfectivoTurno || 0)}</dd>
          </dl>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DENOM.map((v) => {
              const n = conteo[v] || "";
              return (
                <button key={v} type="button" onClick={() => setDenomAbierta(v)} className={`min-h-16 rounded-xl border px-3 py-2 text-left ${n && n !== "0" ? "border-gym-primary" : "border-gym-border"}`}>
                  <div className="text-xs text-gym-muted">{pesos(v)}</div>
                  <div className="text-2xl font-extrabold text-white">{n || "0"}</div>
                </button>
              );
            })}
          </div>
          <section className="rounded-xl border border-gym-border">
            <h3 className="border-b border-gym-border px-4 py-3 text-sm font-semibold text-white">Antes de cerrar</h3>
            <dl className="divide-y divide-gym-border/50 text-sm">
              <div className="flex justify-between px-4 py-2"><dt>Efectivo contado</dt><dd className="font-bold">{pesos(contado)}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt>Se espera en la caja</dt><dd className="font-bold">{pesos(esperado)}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt>Transferencias de hoy (no van en el cajón)</dt><dd>{pesos(summary?.byMethod.transferencia || 0)}</dd></div>
              <div className="flex justify-between px-4 py-2"><dt>Tarjeta de hoy (no va en el cajón)</dt><dd>{pesos(summary?.byMethod.tarjeta || 0)}</dd></div>
            </dl>
          </section>
          {suelto && <p className="rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-3 py-2 text-sm text-gym-primary">Hay {pesos(Math.abs(diff))} que no se pueden contar. La caja se cierra con {pesos(contado)}.</p>}
          {diff < 0 && !suelto && <p className="rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-2 text-sm text-status-err">Falta plata: {pesos(-diff)}. No se puede cerrar hasta que el conteo cuadre.</p>}
          {diff > 0 && !suelto && <p className="rounded-xl border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">Sobra plata: {pesos(diff)}. No se puede cerrar hasta que el conteo cuadre.</p>}
          {cuadra && <p className="rounded-xl border border-status-ok/40 bg-status-ok/10 px-3 py-2 text-sm text-status-ok">Cuadra. Hay {pesos(contado)} y es el efectivo que debía haber.</p>}
          {error && <p className="text-sm text-status-err">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setFase("vender")} className="flex-1 rounded-xl border border-gym-border py-3 text-sm font-semibold">Seguir vendiendo</button>
            <button type="button" disabled={!sePuede || busy} onClick={cerrarTurno} className="flex-1 rounded-xl bg-status-err py-3 text-sm font-bold text-white disabled:opacity-40">{sePuede ? "Cerrar caja" : "No se puede cerrar"}</button>
          </div>
          {denomAbierta != null && (
            <Teclado
              titulo={`Cantidad · ${pesos(denomAbierta)}`}
              valor={conteo[denomAbierta] || ""}
              onValor={(v) => setConteo((c) => ({ ...c, [denomAbierta]: v.replace(/^0+(?=\d)/, "") }))}
              onCerrar={() => setDenomAbierta(null)}
            />
          )}
        </div>
      )}

      {listo && sesion && fase === "vender" && (
        <div className="flex h-[calc(100vh-0px)] min-h-0 flex-col lg:h-screen lg:flex-row">
          <section className="flex min-h-0 min-w-0 flex-1 flex-col px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm text-gym-muted">
                Fondo <span className="font-semibold text-white">{pesos(sesion.openingFloat)}</span>
                {" · "}en el cajón <span className="font-semibold text-white">{pesos(summary?.expectedCash || 0)}</span>
              </p>
              <button type="button" onClick={() => { setError(""); setFase("cerrar"); }} className="rounded-xl border border-gym-border px-3 py-2 text-sm font-semibold text-gym-silver">Cerrar caja</button>
            </div>
            <div className="flex gap-2">
              <input
                ref={busca}
                autoFocus
                value={q}
                onChange={(e) => {
                  const value = e.target.value;
                  if (commitScan(value)) return;
                  setQ(value);
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  if (!commitScan(q)) setQ("");
                }}
                placeholder="Nombre, código o pistola…"
                className="h-14 w-full rounded-xl border border-gym-border bg-gym-navy/80 px-4 text-lg text-white outline-none focus:border-gym-primary"
                autoComplete="off"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cats.map((c) => (
                <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${cat === c ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{c}</button>
              ))}
            </div>
            <ul className="mt-3 grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto sm:grid-cols-3">
              {visible.map((p) => {
                const sala = salaDe(p);
                const bodega = p.warehouseQty || 0;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => agregar(p)} className="h-full w-full rounded-xl border border-gym-border/70 bg-gym-navy/40 p-3 text-left hover:border-gym-primary/60">
                      <div className="line-clamp-2 text-base font-semibold text-white">{p.name}</div>
                      <div className="mt-1 text-lg font-extrabold text-gym-primary">{pesos(p.price)}</div>
                      <div className="text-[11px] text-gym-muted">{p.sku}</div>
                      <div className={`mt-1 text-[11px] ${sala <= 0 ? "text-status-warn" : "text-gym-muted"}`}>
                        {sala === Number.POSITIVE_INFINITY ? "Servicio" : sala <= 0 && bodega > 0 ? `En el gimnasio no · bodega ${bodega}` : sala <= 0 ? "Agotado" : `gimnasio ${sala}${bodega ? ` · bodega ${bodega}` : ""}`}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <aside className="flex max-h-[50vh] w-full shrink-0 flex-col overflow-hidden border-t border-gym-border bg-gym-navy/40 lg:max-h-none lg:w-[26rem] lg:border-l lg:border-t-0">
            <div className="shrink-0 border-b border-gym-border px-4 py-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-white">{cobrada && cart.length === 0 ? "Nueva venta" : "Cuenta"}</h2>
                {cart.length > 0 && <span className="text-2xl font-extrabold text-white">{pesos(total)}</span>}
              </div>
              {cart.length > 0 && (
                <>
                  <button type="button" onClick={() => { setModo(null); setError(""); setCobro(true); }} className="btn-gym mt-3 w-full py-4 text-lg">Cobrar {pesos(total)}</button>
                  <button type="button" onClick={dejarEspera} className="mt-2 w-full rounded-xl border border-gym-border py-2 text-sm font-semibold text-gym-silver">Dejar en espera (F8)</button>
                  <input value={notaEspera} onChange={(e) => setNotaEspera(e.target.value)} placeholder="Nota para retomar" maxLength={80} className="mt-2 w-full rounded-xl border border-gym-border bg-transparent px-3 py-2 text-sm text-gym-silver outline-none" />
                </>
              )}
              {error && !cobro && <p className="mt-3 rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-2 text-sm text-status-err">{error}</p>}
              {espera.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {espera.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => retomar(c)} className="w-full rounded-xl border border-gym-border px-3 py-2 text-left text-sm">
                        <span className="font-semibold text-white">{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="min-h-40 flex-1 overflow-auto">
              {cart.length === 0 && cobrada && (
                <li className="px-4 py-6">
                  <div className="rounded-xl border border-status-ok/40 bg-status-ok/10 px-4 py-4">
                    <p className="text-base font-semibold text-status-ok">Venta cobrada</p>
                    <p className="mt-1 text-sm">Venta {cobrada.number} · {pesos(cobrada.total)}</p>
                    {cobrada.change > 0 ? (
                      <div className="mt-4">
                        <p className="text-sm">Cambio a devolver</p>
                        <p className="text-4xl font-extrabold text-white">{pesos(cobrada.change)}</p>
                      </div>
                    ) : <p className="mt-3 text-sm">No hay cambio que devolver.</p>}
                  </div>
                  {pregunta && (
                    <div className="mt-4">
                      <p className="text-base font-semibold text-white">¿El cliente desea factura?</p>
                      <button type="button" onClick={() => { imprimir(cobrada); setPregunta(false); }} className="btn-gym mt-2 w-full py-4">Sí, imprimir</button>
                      <button type="button" onClick={() => setPregunta(false)} className="mt-2 w-full rounded-xl border border-gym-border py-3 text-sm font-semibold">No, sin factura</button>
                    </div>
                  )}
                  <button type="button" onClick={() => { setCobrada(null); busca.current?.focus(); }} className="btn-gym mt-4 w-full py-4">Nueva venta</button>
                  {!pregunta && (
                    <button type="button" onClick={() => imprimir(cobrada)} className="mt-2 w-full rounded-xl border border-gym-border py-2 text-sm font-semibold text-gym-silver">Imprimir factura</button>
                  )}
                </li>
              )}
              {cart.length === 0 && !cobrada && <li className="px-4 py-8 text-center text-sm text-gym-muted">Toque una tarjeta o pase la pistola.</li>}
              {cart.map((l) => (
                <li key={l.product.id} className="flex items-center gap-2 border-b border-gym-border/50 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-white">{l.product.name}</p>
                    <p className="flex justify-between text-sm text-gym-muted">
                      <span>{l.qty} × {pesos(l.price)}</span>
                      <span className="font-semibold text-white">{pesos(l.price * l.qty)}</span>
                    </p>
                  </div>
                  <button type="button" className="grid size-11 place-items-center rounded-lg border border-gym-border" onClick={() => setCart((c) => c.flatMap((x) => x.product.id === l.product.id ? (x.qty > 1 ? [{ ...x, qty: x.qty - 1 }] : []) : [x]))} aria-label="Quitar una">−</button>
                  <span className="w-6 text-center text-xl font-semibold">{l.qty}</span>
                  <button type="button" className="grid size-11 place-items-center rounded-lg border border-gym-border" onClick={() => agregar(l.product, 1)} aria-label="Agregar una">+</button>
                  <button type="button" className="grid size-11 place-items-center rounded-lg text-status-err" onClick={() => setCart((c) => c.filter((x) => x.product.id !== l.product.id))} aria-label="Quitar de la cuenta">×</button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}

      {cobro && cart.length > 0 && (
        <div className="fixed inset-0 z-50 flex bg-black/70">
          <div className="flex h-full w-full flex-col bg-gym-navy" role="dialog" aria-label="Cobrar">
            <div className="flex items-center justify-between border-b border-gym-border px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gym-muted">Cobrar</p>
                <p className="text-3xl font-extrabold text-gym-primary">{pesos(total)}</p>
                <p className="text-sm text-gym-muted">{cart.length} producto{cart.length === 1 ? "" : "s"}{modo ? ` · ${modo}` : ""}</p>
              </div>
              <button type="button" onClick={() => setCobro(false)} className="grid size-14 place-items-center rounded-xl border border-gym-border text-2xl" aria-label="Cerrar el cobro">×</button>
            </div>
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
              <div className="min-h-0 overflow-y-auto border-b border-gym-border lg:border-b-0 lg:border-r">
                <ul>
                  {cart.map((l) => (
                    <li key={l.product.id} className="border-b border-gym-border/40 px-5 py-3">
                      <p className="truncate text-lg font-semibold text-white">{l.product.name}</p>
                      <p className="mt-0.5 flex justify-between text-base text-gym-muted"><span>{l.qty} × {pesos(l.price)}</span><span className="font-semibold text-white">{pesos(l.price * l.qty)}</span></p>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline justify-between px-5 py-4">
                  <span className="font-semibold">Total</span>
                  <span className="text-3xl font-extrabold text-gym-primary">{pesos(total)}</span>
                </div>
              </div>
              <div className="flex min-h-0 flex-col">
                <div className="grid grid-cols-4 gap-3 px-5 pt-4" role="radiogroup" aria-label="Forma de pago">
                  {(["efectivo", "transferencia", "tarjeta", "mixto"] as Modo[]).map((m) => (
                    <button key={m} type="button" role="radio" aria-checked={modo === m} onClick={() => elegirModo(m)} className={`flex min-h-24 flex-col items-center justify-center rounded-xl border-2 text-base font-semibold capitalize ${modo === m ? "border-gym-primary bg-gym-primary text-gym-navy" : "border-gym-border"}`}>{m}</button>
                  ))}
                </div>
                {modo === "mixto" && (
                  <div className="px-5 pt-4">
                    <label className="text-sm text-gym-muted">En efectivo
                      <input inputMode="numeric" value={parteEfectivo} onChange={(e) => setParteEfectivo(e.target.value.replace(/\D/g, ""))} className="mt-1 block h-12 w-full rounded-xl border border-gym-border bg-transparent px-3 text-lg text-white" />
                    </label>
                    <p className="mt-2 text-sm text-gym-muted">Resto en transferencia <span className="font-semibold text-white">{pesos(Math.abs(resto))}</span>{resto < 0 ? " de más" : ""}</p>
                  </div>
                )}
                {(modo === "transferencia" || modo === "mixto") && (
                  <div className="px-5 pt-4">
                    <p className="mb-2 text-base font-semibold">¿Por dónde pagó?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["Nequi", "Bold"] as Via[]).map((v) => (
                        <button key={v} type="button" onClick={() => setVia(v)} className={`min-h-20 rounded-xl border-2 text-lg font-semibold ${via === v ? "border-gym-primary bg-gym-primary/15" : "border-gym-border"}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                )}
                {modo === "tarjeta" && (
                  <div className="px-5 pt-4">
                    <p className="mb-2 text-base font-semibold">¿Crédito o débito?</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(["Crédito", "Débito"] as Via[]).map((v) => (
                        <button key={v} type="button" onClick={() => setVia(v)} className={`min-h-28 rounded-xl border-2 text-xl font-semibold ${via === v ? "border-gym-primary bg-gym-primary/15" : "border-gym-border"}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                )}
                {(modo === "efectivo" || (modo === "mixto" && !mixtoMal)) && (
                  <div className="flex min-h-0 flex-1 flex-col px-5 pt-3">
                    <p className="text-sm text-gym-muted">A cobrar <span className="font-semibold text-white">{pesos(efectivoACobrar)}</span>{recibido !== "" && <span> · recibido {pesos(recibidoN)}{falta ? " · falta" : ` · cambio ${pesos(cambio)}`}</span>}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {BILLETES.map((b) => (
                        <button key={b} type="button" onClick={() => sumarBillete(b)} className="rounded-lg border border-gym-border px-3 py-2 text-sm font-semibold">{pesos(b)}</button>
                      ))}
                      <button type="button" onClick={() => setRecibido(String(efectivoACobrar))} className="rounded-lg border border-gym-primary px-3 py-2 text-sm font-semibold text-gym-primary">Exacto</button>
                      <button type="button" onClick={() => setRecibido("")} className="rounded-lg border border-gym-border px-3 py-2 text-sm">Borrar</button>
                    </div>
                    <div className="mt-3 grid max-w-xs grid-cols-3 gap-2">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
                        <button key={d} type="button" onClick={() => setRecibido((recibido + d).replace(/^0+(?=\d)/, "").slice(0, 9))} className="h-14 rounded-xl border border-gym-border text-xl font-bold">{d}</button>
                      ))}
                    </div>
                  </div>
                )}
                {error && cobro && <p className="mx-5 mt-3 text-sm text-status-err">{error}</p>}
                {modo && (
                  <div className="mt-auto border-t border-gym-border p-5">
                    <button
                      type="button"
                      disabled={busy || falta || faltaVia || faltaTarjeta || mixtoMal || ((modo === "efectivo" || modo === "mixto") && recibido !== "" && recibidoN < efectivoACobrar)}
                      onClick={cobrar}
                      className="btn-gym w-full py-4 text-lg disabled:opacity-40"
                    >
                      {busy ? "Cobrando…" : `Cobrar ${pesos(total)}`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </GymShell>
  );
}

function Teclado({ titulo, valor, onValor, onCerrar }: { titulo: string; valor: string; onValor: (v: string) => void; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-xs rounded-2xl border border-gym-border bg-gym-navy p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">{titulo}</p>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">×</button>
        </div>
        <p className="mb-3 text-3xl font-extrabold">{valor || "0"}</p>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
            <button key={d} type="button" onClick={() => onValor((valor + d).replace(/^0+(?=\d)/, "").slice(0, 9))} className="h-14 rounded-xl border border-gym-border text-xl font-bold">{d}</button>
          ))}
          <button type="button" onClick={() => onValor(valor.slice(0, -1))} className="h-14 rounded-xl border border-gym-border text-sm">Borrar</button>
        </div>
        <button type="button" onClick={onCerrar} className="btn-gym mt-3 w-full">Listo</button>
      </div>
    </div>
  );
}

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}
