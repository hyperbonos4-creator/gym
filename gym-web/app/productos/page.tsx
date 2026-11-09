"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EtiquetaCodigo } from "../../components/EtiquetaCodigo";
import GymShell from "../../components/GymShell";
import { cop, enteros, miles } from "../../lib/money";
import { familyPrefix, nextSku } from "../../lib/retailCodes";
import { getActiveGymId } from "../../lib/session";

type Tax = "GRAVADO" | "EXENTO" | "EXCLUIDO" | "NO_APLICA";

type Product = {
  id: string;
  sku: string;
  barcode: string;
  barcodeOrigin: "factory" | "generated";
  name: string;
  description: string;
  category: string;
  supplier: string;
  supplierId?: string;
  unit: string;
  price: number;
  cost: number;
  floorQty: number;
  warehouseQty: number;
  stock: number;
  minStock: number;
  maxStock: number | null;
  itemKind: "PRODUCT" | "SERVICE";
  tracksInventory: boolean;
  taxTreatment: Tax;
  vatRate: number;
  incomeAccount: string;
  inventoryAccount: string;
  costAccount: string;
  active: boolean;
};

type Restock = {
  productId: string;
  name: string;
  sku: string;
  floorQty: number;
  warehouseQty: number;
  qty: number;
  target: number;
};

type Draft = {
  name: string;
  description: string;
  cost: string;
  price: string;
  category: string;
  supplier: string;
  supplierId: string;
  unit: string;
  itemKind: "PRODUCT" | "SERVICE";
  tracksInventory: boolean;
  taxTreatment: Tax;
  vatRate: string;
  incomeAccount: string;
  inventoryAccount: string;
  costAccount: string;
  barcodeMode: "factory" | "generate";
  barcode: string;
  floorQty: string;
  warehouseQty: string;
  minStock: string;
  maxStock: string;
};

const CATS = ["Suplementos", "Bebidas", "Snacks", "Accesorios", "Ropa", "Otros"];
const TAXES: [Tax, string][] = [
  ["GRAVADO", "Gravado"],
  ["EXENTO", "Exento"],
  ["EXCLUIDO", "Excluido"],
  ["NO_APLICA", "No aplica"],
];

type SupMini = { name: string; taxId: string; phone: string; contactName: string };
const EMPTY_SUP: SupMini = { name: "", taxId: "", phone: "", contactName: "" };

function productDraftKey(gymId: string) {
  return `gym-product-draft:${gymId}`;
}

function readProductDraft(gymId: string): { form: Draft; supQ: string; newSup: boolean; supDraft: SupMini } | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(productDraftKey(gymId));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.form || typeof d.form !== "object") return null;
    return {
      form: { ...EMPTY, ...d.form },
      supQ: String(d.supQ || d.form.supplier || ""),
      newSup: !!d.newSup,
      supDraft: { ...EMPTY_SUP, ...(d.supDraft || {}) },
    };
  } catch {
    return null;
  }
}

function draftHasWork(form: Draft, supQ: string, supDraft: SupMini) {
  return Boolean(
    form.name.trim() || form.description.trim() || form.cost || form.price || form.supplierId || form.barcode
    || supQ.trim() || supDraft.name.trim() || supDraft.taxId.trim() || supDraft.phone.trim(),
  );
}

const EMPTY: Draft = {
  name: "",
  description: "",
  cost: "",
  price: "",
  category: "Suplementos",
  supplier: "",
  supplierId: "",
  unit: "unidad",
  itemKind: "PRODUCT",
  tracksInventory: true,
  taxTreatment: "GRAVADO",
  vatRate: "19",
  incomeAccount: "4135",
  inventoryAccount: "1435",
  costAccount: "6135",
  barcodeMode: "factory",
  barcode: "",
  floorQty: "0",
  warehouseQty: "0",
  minStock: "5",
  maxStock: "",
};

const fieldCls = "w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2.5 text-sm text-gym-silver outline-none focus:border-gym-primary";
const labelCls = "mb-1.5 block text-sm font-medium text-white";

function qtyOf(p: Product, key: "floorQty" | "warehouseQty") {
  const n = p[key];
  return Number.isFinite(n) ? n : p.stock || 0;
}

function stockView(p: Product) {
  const sala = qtyOf(p, "floorQty");
  const bodega = qtyOf(p, "warehouseQty");
  const min = p.minStock || 0;
  if (sala <= 0 && bodega <= 0) return { kind: "out" as const, sala, bodega };
  if (sala <= 0 && bodega > 0) return { kind: "upstairs" as const, sala, bodega };
  if (min > 0 && sala < min) return { kind: "low" as const, sala, bodega };
  return { kind: "ok" as const, sala, bodega };
}

export default function ProductosPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [items, setItems] = useState<Product[]>([]);
  const [restock, setRestock] = useState<Restock[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Todo");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<Draft>(EMPTY);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gymName, setGymName] = useState("Fuerza Élite");
  const [gymShort, setGymShort] = useState("FE");
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; taxId: string; phone: string; active: boolean }[]>([]);
  const [supQ, setSupQ] = useState("");
  const [supOpen, setSupOpen] = useState(false);
  const [newSup, setNewSup] = useState(false);
  const [supDraft, setSupDraft] = useState<SupMini>(EMPTY_SUP);
  const [resumed, setResumed] = useState(false);
  const skipDraftWrite = useRef(true);

  const load = useCallback(async (id: string) => {
    const res = await fetch(`/api/retail/products?gym=${encodeURIComponent(id)}`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items || []);
    setRestock(data.restock || []);
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
    fetch(`/api/retail/suppliers?gym=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setSuppliers(d.items || []))
      .catch(() => undefined);
    fetch("/api/gyms", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const g = (d.items || []).find((x: { id: string }) => x.id === id);
        if (g?.name) setGymName(g.name);
        if (g?.short) setGymShort(g.short);
      })
      .catch(() => undefined);
    const saved = readProductDraft(id);
    if (saved && draftHasWork(saved.form, saved.supQ, saved.supDraft)) {
      setEditing(null);
      setForm(saved.form);
      setSupQ(saved.supQ);
      setNewSup(saved.newSup);
      setSupDraft(saved.supDraft);
      setResumed(true);
      setOpen(true);
    }
    skipDraftWrite.current = true;
  }, [load]);

  useEffect(() => {
    if (skipDraftWrite.current) {
      skipDraftWrite.current = false;
      return;
    }
    if (editing) return;
    if (!draftHasWork(form, supQ, supDraft)) {
      sessionStorage.removeItem(productDraftKey(gymId));
      return;
    }
    sessionStorage.setItem(productDraftKey(gymId), JSON.stringify({ form, supQ, newSup, supDraft }));
  }, [gymId, editing, form, supQ, newSup, supDraft]);

  const cats = useMemo(() => ["Todo", ...CATS.filter((c) => items.some((p) => p.category === c))], [items]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter((p) => {
      if (cat !== "Todo" && p.category !== cat) return false;
      if (!s) return true;
      return [p.name, p.sku, p.barcode, p.category, p.supplier, p.description].some((v) => String(v || "").toLowerCase().includes(s));
    });
  }, [items, q, cat]);

  const previewCode = useMemo(() => {
    if (editing) return editing.sku;
    return nextSku(items.map((p) => p.sku), form.category);
  }, [editing, items, form.category]);

  function openNew() {
    const saved = readProductDraft(gymId);
    setEditing(null);
    setErr("");
    setConfirmDelete(false);
    if (saved && draftHasWork(saved.form, saved.supQ, saved.supDraft)) {
      setForm(saved.form);
      setSupQ(saved.supQ);
      setNewSup(saved.newSup);
      setSupDraft(saved.supDraft);
      setResumed(true);
    } else {
      setForm(EMPTY);
      setSupQ("");
      setNewSup(false);
      setSupDraft(EMPTY_SUP);
      setResumed(false);
    }
    setOpen(true);
  }

  function discardDraft() {
    sessionStorage.removeItem(productDraftKey(gymId));
    setForm(EMPTY);
    setSupQ("");
    setNewSup(false);
    setSupDraft(EMPTY_SUP);
    setResumed(false);
    setErr("");
    setEditing(null);
  }

  function openProduct(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      cost: p.cost ? miles(p.cost) : "",
      price: miles(p.price || ""),
      category: CATS.includes(p.category) ? p.category : "Otros",
      supplier: p.supplier || "",
      supplierId: p.supplierId || "",
      unit: p.unit || "unidad",
      itemKind: p.itemKind || "PRODUCT",
      tracksInventory: p.tracksInventory !== false,
      taxTreatment: p.taxTreatment || "GRAVADO",
      vatRate: String(p.vatRate ?? 19),
      incomeAccount: p.incomeAccount || "4135",
      inventoryAccount: p.inventoryAccount || "1435",
      costAccount: p.costAccount || "6135",
      barcodeMode: "factory",
      barcode: p.barcode || "",
      floorQty: String(qtyOf(p, "floorQty")),
      warehouseQty: String(qtyOf(p, "warehouseQty")),
      minStock: String(p.minStock ?? 0),
      maxStock: p.maxStock ? String(p.maxStock) : "",
    });
    setErr("");
    setConfirmDelete(false);
    setSupQ(p.supplier || "");
    setNewSup(false);
    setOpen(true);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = q.trim().toLowerCase();
    if (!code) return;
    const exact = items.find((p) => p.barcode.toLowerCase() === code || p.sku.toLowerCase() === code);
    if (exact) openProduct(exact);
  }

  function faltantes() {
    const faltan: string[] = [];
    if (!form.name.trim()) faltan.push("el nombre");
    if (enteros(form.price) <= 0) faltan.push("el precio de venta");
    if (!form.supplierId) faltan.push("el proveedor");
    if (!editing && form.barcodeMode === "factory" && !form.barcode.trim()) faltan.push("el código de barras");
    return faltan;
  }

  function textoFalta(faltan: string[]) {
    const lista = faltan.length === 1 ? faltan[0] : `${faltan.slice(0, -1).join(", ")} y ${faltan[faltan.length - 1]}`;
    return faltan.length === 1 ? `Falta ${lista}.` : `Faltan ${lista}.`;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const faltan = faltantes();
    if (faltan.length) {
      setErr(`No se guardó. ${textoFalta(faltan)}`);
      return;
    }
    setBusy(true);
    setErr("");
    const body = {
      gym: gymId,
      id: editing?.id,
      name: form.name,
      description: form.description,
      category: form.category,
      supplier: form.supplier,
      supplierId: form.supplierId,
      unit: form.unit,
      price: enteros(form.price),
      cost: enteros(form.cost),
      itemKind: form.itemKind,
      tracksInventory: form.itemKind === "PRODUCT" && form.tracksInventory,
      taxTreatment: form.taxTreatment,
      vatRate: Number(form.vatRate || 0),
      incomeAccount: form.incomeAccount,
      inventoryAccount: form.inventoryAccount,
      costAccount: form.costAccount,
      barcodeMode: editing ? (form.barcodeMode === "generate" ? "generate" : "factory") : form.barcodeMode,
      barcode: form.barcodeMode === "generate" && !editing ? "" : form.barcode,
      floorQty: editing && !String(form.floorQty).trim() ? null : Number(form.floorQty || 0),
      warehouseQty: editing && !String(form.warehouseQty).trim() ? null : Number(form.warehouseQty || 0),
      minStock: Number(form.minStock || 0),
      maxStock: form.maxStock.trim() ? Number(form.maxStock) : null,
    };
    try {
      const res = await fetch("/api/retail/products", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) {
        setErr(`No se guardó. ${data.error || "Revise los datos."}`);
        return;
      }
      const product = data.product as Product;
      if (!editing) {
        sessionStorage.removeItem(productDraftKey(gymId));
        setResumed(false);
      }
      setOpen(false);
      setMsg(`Se guardó ${product.name}.`);
      load(gymId);
    } catch {
      setErr("No se guardó. No hubo respuesta del sistema.");
    } finally {
      setBusy(false);
    }
  }

  async function seed() {
    setBusy(true);
    const res = await fetch("/api/retail/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, action: "seed" }),
    });
    const data = await res.json();
    setBusy(false);
    setItems(data.items || []);
    setRestock(data.restock || []);
    setMsg(data.added ? `Se cargaron ${data.added} productos solo en esta sede.` : "Esta sede ya tiene el catálogo de mostrador.");
  }

  async function bajar(productId?: string) {
    setBusy(true);
    const res = await fetch("/api/retail/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, action: "bajar", productId }),
    });
    const data = await res.json();
    setBusy(false);
    setItems(data.items || []);
    setRestock(data.restock || []);
    setMsg(data.brought ? `Se bajaron ${data.brought} producto${data.brought === 1 ? "" : "s"} de la bodega al gimnasio.` : "No había nada por bajar.");
    if (!data.restock?.length) setShowRestock(false);
  }

  async function remove(p: Product) {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    setErr("");
    const res = await fetch("/api/retail/products", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, id: p.id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setErr(data.error || "No se pudo eliminar");
      return;
    }
    setOpen(false);
    setConfirmDelete(false);
    setItems(data.items || []);
    setRestock(data.restock || []);
    setMsg(`${data.removed.name} (${data.removed.sku}) se eliminó de esta sede.`);
  }

  async function toggle(p: Product) {
    await fetch("/api/retail/products", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, id: p.id, active: !p.active }),
    });
    setOpen(false);
    load(gymId);
  }

  const priceN = enteros(form.price);
  const costN = enteros(form.cost);
  const margin = priceN > 0 && costN > 0 ? Math.round(((priceN - costN) / priceN) * 100) : null;

  return (
    <GymShell active="productos">
      <div className="px-6 py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white">Catálogo</h2>
            <p className="max-w-2xl text-sm text-gym-muted">
              Toque una tarjeta para ver lo que hay en el gimnasio y en la bodega. Un producto nuevo pide el conteo y el mínimo para avisar. La pistola encuentra por el código.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={seed} disabled={busy} className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-muted hover:text-white disabled:opacity-50">
              Cargar mostrador
            </button>
            <button type="button" onClick={openNew} className="btn-gym">Nuevo producto</button>
          </div>
        </div>

        {restock.length > 0 && (
          <button type="button" onClick={() => setShowRestock((v) => !v)} className="mb-4 w-full rounded-xl border border-status-warn/50 bg-status-warn/10 px-4 py-3 text-left">
            <div className="text-sm font-bold text-status-warn">Hay {restock.length} pedido{restock.length === 1 ? "" : "s"} por bajar de la bodega al gimnasio</div>
            <div className="text-xs text-status-warn/90">Es su trabajo. Siguen aquí hasta que los recoja. No se arma otro igual.</div>
          </button>
        )}
        {showRestock && restock.length > 0 && (
          <div className="glass mb-4 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Surtido</h3>
              <button type="button" disabled={busy} onClick={() => bajar()} className="text-sm font-semibold text-gym-primary">Bajar todo</button>
            </div>
            <div className="flex flex-col gap-2">
              {restock.map((r) => (
                <div key={r.productId} className="flex items-center gap-3 rounded-xl border border-gym-border/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{r.name}</div>
                    <div className="text-[11px] text-gym-muted">{r.sku} · gimnasio {r.floorQty} · bodega {r.warehouseQty} · bajar {r.qty} hasta {r.target}</div>
                  </div>
                  <button type="button" disabled={busy} onClick={() => bajar(r.productId)} className="text-xs font-semibold text-gym-primary">Bajar {r.qty}</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg && <div className="mb-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</div>}

        <div className="glass p-4">
          <input
            className={fieldCls}
            placeholder="Buscar nombre o disparar el código"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onSearchKey}
            autoComplete="off"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-full px-3 py-1 text-xs font-semibold ${cat === c ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{c}</button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gym-muted">{filtered.length} producto{filtered.length === 1 ? "" : "s"}</div>
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gym-muted">Esta sede no tiene productos con ese filtro.</div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const st = stockView(p);
                return (
                  <button key={p.id} type="button" onClick={() => openProduct(p)} className={`rounded-xl border bg-gym-navy/40 p-4 text-left hover:border-gym-primary/60 ${p.active ? "border-gym-border/70" : "border-gym-border/40 opacity-50"}`}>
                    <div className="line-clamp-2 text-base font-semibold text-white">{p.name}</div>
                    <div className="mt-1 font-mono text-[11px] text-gym-muted">{p.sku} · {p.category}</div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div className="text-lg font-extrabold text-gym-primary">{cop(p.price)}</div>
                      <StockBadge kind={st.kind} sala={st.sala} bodega={st.bodega} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <form onSubmit={save} className="glass my-4 w-full max-w-2xl p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-white">{editing ? editing.name : "Nuevo producto"}</h3>
                <p className="text-sm text-gym-muted">El código lo asigna el sistema. Si deja un conteo en blanco, se guarda cero: escriba las unidades reales.</p>
                {!editing && (
                  <p className="mt-1 text-xs text-gym-primary">
                    {resumed ? "Se recuperó lo que ya había escrito. " : ""}
                    Si sale o toca afuera, esto no se borra.
                    <button type="button" onClick={discardDraft} className="ml-2 underline">Empezar de cero</button>
                  </p>
                )}
              </div>
              <button type="button" onClick={() => { setErr(""); setOpen(false); }} className="text-sm text-gym-muted" aria-label="Cerrar">✕</button>
            </div>
            {err && <div className="mb-4 rounded-xl border border-status-warn/50 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">{err}</div>}
            {(() => {
              const venta = enteros(form.price);
              const costo = enteros(form.cost);
              const sala = Number(form.floorQty || 0);
              const bodega = Number(form.warehouseQty || 0);
              const min = Number(form.minStock || 0);
              const margen = venta > 0 ? Math.round(((venta - costo) / venta) * 1000) / 10 : 0;
              const bajo = min > 0 && sala < min && bodega > 0;
              if (!form.name && !venta) return null;
              return (
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-gym-border/60 bg-gym-navy/40 p-3 sm:grid-cols-4">
                  <div><div className="text-[10px] uppercase text-gym-muted">Venta</div><div className="text-sm font-bold text-white">{venta ? cop(venta) : "—"}</div></div>
                  <div><div className="text-[10px] uppercase text-gym-muted">Margen</div><div className="text-sm font-bold text-white">{venta ? `${margen}%` : "—"}</div></div>
                  <div><div className="text-[10px] uppercase text-gym-muted">Stock</div><div className="text-sm font-bold text-white">{sala + bodega}</div><div className="text-[10px] text-gym-muted">{sala} gimnasio · {bodega} bodega</div></div>
                  <div><div className="text-[10px] uppercase text-gym-muted">Abastecimiento</div><div className={`text-sm font-bold ${bajo ? "text-status-warn" : "text-status-ok"}`}>{bajo ? "Bajar de bodega" : "Al día"}</div></div>
                </div>
              );
            })()}

            <Section title="Ficha">
              <label className={labelCls}>Nombre<span className="text-gym-primary">*</span></label>
              <input className={fieldCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Whey protein 2 lb" autoComplete="off" />
              <label className={`${labelCls} mt-3`}>Descripción (opcional)</label>
              <input className={fieldCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Marca, tamaño, lo que ayude en el mostrador" autoComplete="off" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Precio de compra</label>
                  <input className={fieldCls} inputMode="numeric" value={form.cost} onChange={(e) => setForm({ ...form, cost: miles(e.target.value) })} placeholder="Toque para escribir" />
                </div>
                <div>
                  <label className={labelCls}>Precio de venta<span className="text-gym-primary">*</span></label>
                  <input className={fieldCls} inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: miles(e.target.value) })} placeholder="Toque para escribir" />
                </div>
              </div>
              {margin != null && <p className="mt-2 text-xs text-gym-muted">Margen {margin}% · utilidad {cop(priceN - costN)} por unidad. La caja no muestra el costo.</p>}
            </Section>

            <Section title="Góndola">
              <p className="mb-2 text-sm font-medium text-white">Categoría</p>
              <div className="flex flex-wrap gap-2">
                {CATS.map((c) => (
                  <button key={c} type="button" onClick={() => setForm({ ...form, category: c })} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${form.category === c ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{c}</button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gym-muted">
                Elija la góndola. El código ({previewCode}) se arma con la familia {familyPrefix(form.category)} y no cambia si lo mueve.
              </p>
              <label className={`${labelCls} mt-3`}>Proveedor<span className="text-gym-primary">*</span></label>
              <input
                className={fieldCls}
                value={supQ}
                onChange={(e) => {
                  setSupQ(e.target.value);
                  setSupOpen(true);
                  setForm({ ...form, supplier: "", supplierId: "" });
                }}
                onFocus={() => setSupOpen(true)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); } }}
                placeholder="Nombre, NIT o teléfono…"
                autoComplete="off"
              />
              {supOpen && (
                <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-gym-border">
                  {suppliers.filter((s) => s.active !== false && (!supQ.trim() || [s.name, s.taxId, s.phone].join(" ").toLowerCase().includes(supQ.trim().toLowerCase()))).slice(0, 8).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, supplier: s.name, supplierId: s.id });
                        setSupQ(s.name);
                        setSupOpen(false);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-white hover:bg-gym-primary/10"
                    >
                      {s.name}
                      <span className="ml-2 text-xs text-gym-muted">{s.taxId || s.phone}</span>
                    </button>
                  ))}
                  {suppliers.length === 0 && <p className="px-3 py-2 text-xs text-gym-muted">No hay proveedores. Cree uno antes de dar de alta el producto.</p>}
                </div>
              )}
              <button type="button" onClick={() => setNewSup((v) => !v)} className="mt-2 text-sm font-semibold text-gym-primary">Nuevo proveedor</button>
              {newSup && (
                <div className="mt-2 grid gap-2 rounded-xl border border-gym-border/70 p-3" onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}>
                  <input className={fieldCls} value={supDraft.name} onChange={(e) => setSupDraft({ ...supDraft, name: e.target.value })} placeholder="Razón social" />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={fieldCls} value={supDraft.taxId} onChange={(e) => setSupDraft({ ...supDraft, taxId: e.target.value })} placeholder="NIT" />
                    <input className={fieldCls} inputMode="numeric" value={supDraft.phone} onChange={(e) => setSupDraft({ ...supDraft, phone: e.target.value.replace(/\D/g, "") })} placeholder="WhatsApp" />
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setErr("");
                      const res = await fetch("/api/retail/suppliers", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ gym: gymId, ...supDraft }),
                      });
                      const data = await res.json();
                      setBusy(false);
                      if (!data.ok) {
                        setErr(data.error || "No se pudo crear el proveedor");
                        return;
                      }
                      setSuppliers(data.items || []);
                      setForm({ ...form, supplier: data.supplier.name, supplierId: data.supplier.id });
                      setSupQ(data.supplier.name);
                      setSupDraft({ name: "", taxId: "", phone: "", contactName: "" });
                      setNewSup(false);
                      setSupOpen(false);
                    }}
                    className="rounded-xl border border-gym-primary/40 px-3 py-2 text-sm font-semibold text-gym-primary"
                  >
                    Crear proveedor
                  </button>
                </div>
              )}
              <label className={`${labelCls} mt-3`}>Unidad</label>
              <input className={fieldCls} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unidad" />
            </Section>

            <Section title="Clasificación">
              <p className="text-xs text-gym-muted">Cada venta guarda una copia. Cambiar esta ficha no reescribe lo ya vendido.</p>
              <p className="mb-1.5 mt-3 text-sm font-medium text-white">Tipo</p>
              <Chips>
                <Chip on={form.itemKind === "PRODUCT"} onClick={() => setForm({ ...form, itemKind: "PRODUCT", tracksInventory: true })}>Producto</Chip>
                <Chip on={form.itemKind === "SERVICE"} onClick={() => setForm({ ...form, itemKind: "SERVICE", tracksInventory: false })}>Servicio</Chip>
              </Chips>
              {form.itemKind === "PRODUCT" && (
                <>
                  <p className="mb-1.5 mt-3 text-sm font-medium text-white">Inventario</p>
                  <Chips>
                    <Chip on={form.tracksInventory} onClick={() => setForm({ ...form, tracksInventory: true })}>Controla existencias</Chip>
                    <Chip on={!form.tracksInventory} onClick={() => setForm({ ...form, tracksInventory: false })}>No controla</Chip>
                  </Chips>
                </>
              )}
              <p className="mb-1.5 mt-3 text-sm font-medium text-white">Tratamiento fiscal</p>
              <Chips>
                {TAXES.map(([id, label]) => (
                  <Chip key={id} on={form.taxTreatment === id} onClick={() => setForm({ ...form, taxTreatment: id })}>{label}</Chip>
                ))}
              </Chips>
              {form.taxTreatment === "GRAVADO" && (
                <div className="mt-3 max-w-xs">
                  <label className={labelCls}>Tarifa %</label>
                  <input className={fieldCls} inputMode="decimal" value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: e.target.value.replace(/[^\d.]/g, "") })} placeholder="19" />
                </div>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={labelCls}>Cuenta de ingreso</label>
                  <input className={fieldCls} inputMode="numeric" value={form.incomeAccount} onChange={(e) => setForm({ ...form, incomeAccount: e.target.value.replace(/\D/g, "") })} />
                </div>
                {form.itemKind === "PRODUCT" && form.tracksInventory && (
                  <>
                    <div>
                      <label className={labelCls}>Cuenta de inventario</label>
                      <input className={fieldCls} inputMode="numeric" value={form.inventoryAccount} onChange={(e) => setForm({ ...form, inventoryAccount: e.target.value.replace(/\D/g, "") })} />
                    </div>
                    <div>
                      <label className={labelCls}>Cuenta de costo</label>
                      <input className={fieldCls} inputMode="numeric" value={form.costAccount} onChange={(e) => setForm({ ...form, costAccount: e.target.value.replace(/\D/g, "") })} />
                    </div>
                  </>
                )}
              </div>
            </Section>

            <Section title="Código y etiqueta">
              <p className="mb-2 text-sm font-medium text-white">Código de barras</p>
              {editing && form.barcode && (
                <p className="mb-2 font-mono text-xs text-gym-muted">{editing.barcodeOrigin === "generated" ? "Generado" : "De fábrica"} · {editing.barcode}</p>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setForm({ ...form, barcodeMode: "factory" })} className={`rounded-xl border p-3 text-left ${form.barcodeMode === "factory" ? "border-gym-primary bg-gym-primary/10" : "border-gym-border"}`}>
                  <div className="text-sm font-semibold text-white">Asociar el que trae</div>
                  <div className="mt-1 text-xs text-gym-muted">Dispare la pistola sobre el código de fábrica.</div>
                </button>
                <button type="button" onClick={() => setForm({ ...form, barcodeMode: "generate", barcode: editing ? form.barcode : "" })} className={`rounded-xl border p-3 text-left ${form.barcodeMode === "generate" ? "border-gym-primary bg-gym-primary/10" : "border-gym-border"}`}>
                  <div className="text-sm font-semibold text-white">Generar uno nuevo</div>
                  <div className="mt-1 text-xs text-gym-muted">EAN-13 interno para etiquetar en bodega.</div>
                </button>
              </div>
              {form.barcodeMode === "factory" && (
                <input
                  className={`${fieldCls} mt-3`}
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value.replace(/\s/g, "") })}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); } }}
                  placeholder="Dispare la pistola aquí"
                  autoComplete="off"
                  maxLength={48}
                />
              )}
              {form.barcodeMode === "generate" && !editing && (
                <p className="mt-2 text-sm text-gym-muted">Al crear el producto se genera el código. La etiqueta sale con el logo de esta sede.</p>
              )}
              {form.barcode && (
                <EtiquetaCodigo
                  gymId={gymId}
                  gymName={gymName}
                  gymShort={gymShort}
                  code={form.barcode}
                  nombre={form.name}
                  sku={editing?.sku || previewCode}
                  precio={enteros(form.price)}
                  descripcion={form.description}
                  enStock={Number(form.floorQty || 0) + Number(form.warehouseQty || 0)}
                />
              )}
            </Section>

            {form.itemKind === "PRODUCT" && form.tracksInventory && (
              <Section title="Estante y alertas">
                <p className="text-sm font-medium text-white">Conteo de lo que ya está</p>
                <p className="mt-1 text-xs text-gym-muted">Sin factura. Anote lo contado en cada lugar. Vacío queda en cero. Lo que anote reemplaza lo que hay.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Contado en bodega</label>
                    <input className={fieldCls} inputMode="numeric" value={form.warehouseQty} onChange={(e) => setForm({ ...form, warehouseQty: e.target.value.replace(/[^\d]/g, "") })} />
                  </div>
                  <div>
                    <label className={labelCls}>Contado en el gimnasio</label>
                    <input className={fieldCls} inputMode="numeric" value={form.floorQty} onChange={(e) => setForm({ ...form, floorQty: e.target.value.replace(/[^\d]/g, "") })} />
                  </div>
                  <div>
                    <label className={labelCls}>Mínimo para avisar</label>
                    <input className={fieldCls} inputMode="numeric" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value.replace(/[^\d]/g, "") })} />
                    <p className="mt-1 text-[11px] text-gym-muted">Si en el gimnasio queda menos que esto y hay en bodega, se pide bajar. 0 = no avisa.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Abastecer hasta</label>
                    <input className={fieldCls} inputMode="numeric" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value.replace(/[^\d]/g, "") })} placeholder="el doble del límite" />
                    <p className="mt-1 text-[11px] text-gym-muted">A cuántas queda el gimnasio cuando bajan de la bodega. Vacío = el doble del límite (o una semana de venta si se vende más, tope el triple).</p>
                  </div>
                </div>
              </Section>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-gym" disabled={busy}>{busy ? "Guardando…" : editing ? "Guardar" : "Crear producto"}</button>
              <button type="button" onClick={() => { setErr(""); setOpen(false); }} className="rounded-xl border border-gym-border px-4 py-2 text-sm text-gym-muted">Cerrar</button>
              {editing && (
                <>
                  <button type="button" onClick={() => toggle(editing)} className="text-sm text-gym-muted">{editing.active ? "Ocultar del mostrador" : "Volver a mostrar"}</button>
                  <button type="button" disabled={busy} onClick={() => remove(editing)} className={`ml-auto rounded-xl px-4 py-2 text-sm font-semibold ${confirmDelete ? "bg-red-500 text-white" : "border border-red-400/50 text-red-300"}`}>
                    {confirmDelete ? "Sí, eliminar" : "Eliminar"}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </GymShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-xl border border-gym-border/70 bg-gym-navy/30 p-4">
      <h4 className="mb-3 text-sm font-semibold text-white">{title}</h4>
      {children}
    </section>
  );
}

function Chips({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-gym-primary text-gym-navy" : "border border-gym-border text-gym-muted"}`}>{children}</button>
  );
}

function StockBadge({ kind, sala, bodega }: { kind: "out" | "upstairs" | "low" | "ok"; sala: number; bodega: number }) {
  if (kind === "out") return <span className="text-right text-xs font-bold text-red-300">Agotado</span>;
  if (kind === "upstairs") {
    return (
      <span className="text-right text-xs font-semibold text-status-warn">
        En el gimnasio no
        <span className="mt-0.5 block font-medium">bodega {bodega}</span>
      </span>
    );
  }
  if (kind === "low") {
    return (
      <span className="text-right text-xs font-semibold text-status-warn">
        Por agotarse
        <span className="mt-0.5 block font-medium">gimnasio {sala}{bodega ? ` · bodega ${bodega}` : ""}</span>
      </span>
    );
  }
  return (
    <span className="text-right text-xs text-gym-muted">
      <span className="block">gimnasio {sala}</span>
      {bodega > 0 ? <span className="block">bodega {bodega}</span> : null}
    </span>
  );
}
