"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GymShell from "../../components/GymShell";
import { getActiveGymId } from "../../lib/session";

type Supplier = {
  id: string;
  name: string;
  taxId: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  leadTimeDays: number;
  notes: string;
  active: boolean;
};

const EMPTY = { name: "", taxId: "", contactName: "", phone: "", email: "", address: "", leadTimeDays: "7", notes: "" };

function supplierDraftKey(gymId: string) {
  return `gym-supplier-draft:${gymId}`;
}

function supplierHasWork(form: typeof EMPTY) {
  return Boolean(form.name.trim() || form.taxId.trim() || form.phone.trim() || form.contactName.trim() || form.email.trim() || form.address.trim() || form.notes.trim());
}

function readSupplierDraft(gymId: string) {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(supplierDraftKey(gymId));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.form) return null;
    return { ...EMPTY, ...d.form };
  } catch {
    return null;
  }
}
const fieldCls = "w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2.5 text-sm text-gym-silver outline-none focus:border-gym-primary";
const labelCls = "mb-1.5 block text-sm font-medium text-white";

export default function ProveedoresPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [items, setItems] = useState<Supplier[]>([]);
  const [pedir, setPedir] = useState<{ name: string; qty: number; sku: string }[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resumed, setResumed] = useState(false);
  const skipDraftWrite = useRef(true);

  const load = useCallback(async (id: string) => {
    const [res, prod] = await Promise.all([
      fetch(`/api/retail/suppliers?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/retail/products?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setItems(res.items || []);
    setPedir((prod.restock || []).map((r: { name: string; qty: number; sku: string }) => ({ name: r.name, qty: r.qty, sku: r.sku })));
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
    const saved = readSupplierDraft(id);
    if (saved && supplierHasWork(saved)) {
      setEditing(null);
      setForm(saved);
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
    if (!supplierHasWork(form)) {
      sessionStorage.removeItem(supplierDraftKey(gymId));
      return;
    }
    sessionStorage.setItem(supplierDraftKey(gymId), JSON.stringify({ form }));
  }, [gymId, editing, form]);

  function openNew() {
    const saved = readSupplierDraft(gymId);
    setEditing(null);
    setErr("");
    setConfirmDelete(false);
    if (saved && supplierHasWork(saved)) {
      setForm(saved);
      setResumed(true);
    } else {
      setForm(EMPTY);
      setResumed(false);
    }
    setOpen(true);
  }

  function discardDraft() {
    sessionStorage.removeItem(supplierDraftKey(gymId));
    setForm(EMPTY);
    setResumed(false);
    setErr("");
    setEditing(null);
  }

  function openOne(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      taxId: s.taxId || "",
      contactName: s.contactName || "",
      phone: s.phone || "",
      email: s.email || "",
      address: s.address || "",
      leadTimeDays: String(s.leadTimeDays ?? 7),
      notes: s.notes || "",
    });
    setErr("");
    setConfirmDelete(false);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/retail/suppliers", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, id: editing?.id, ...form, leadTimeDays: Number(form.leadTimeDays || 7) }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setErr(data.error || "No se pudo guardar");
      return;
    }
    setItems(data.items || []);
    if (!editing) sessionStorage.removeItem(supplierDraftKey(gymId));
    setResumed(false);
    setOpen(false);
    setMsg(editing ? `${data.supplier.name} quedó actualizado.` : `${data.supplier.name} ya se puede usar en el catálogo.`);
  }

  async function remove(s: Supplier) {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    const res = await fetch("/api/retail/suppliers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, id: s.id }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setErr(data.error || "No se pudo eliminar");
      setConfirmDelete(false);
      return;
    }
    setItems(data.items || []);
    setOpen(false);
    setMsg(`${data.removed.name} se eliminó de esta sede.`);
  }

  const shown = items.filter((s) => {
    const n = q.trim().toLowerCase();
    if (!n) return true;
    return [s.name, s.taxId, s.phone, s.contactName].some((v) => String(v || "").toLowerCase().includes(n));
  });

  return (
    <GymShell active="proveedores">
      <div className="px-6 py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-white">Proveedores</h2>
            <p className="max-w-2xl text-sm text-gym-muted">La razón social va con el NIT. Sin proveedor no se da de alta un producto. Cada sede tiene los suyos.</p>
          </div>
          <button type="button" onClick={openNew} className="btn-gym">Nuevo proveedor</button>
        </div>
        {pedir.length > 0 && (
          <div className="mb-4 rounded-xl border border-status-warn/40 bg-status-warn/10 px-4 py-3">
            <div className="text-sm font-bold text-status-warn">Hay que bajar de la bodega al gimnasio</div>
            <div className="mt-1 text-xs text-gym-silver">{pedir.map((p) => `${p.name} · bajar ${p.qty}`).join(" · ")}</div>
            <a href="/productos" className="mt-1 inline-block text-[11px] font-semibold text-gym-primary">Ir al catálogo y bajar</a>
          </div>
        )}
        {msg && <div className="mb-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</div>}
        <div className="glass p-4">
          <input className={fieldCls} placeholder="Buscar nombre, NIT o teléfono" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-2 text-xs text-gym-muted">{shown.length} proveedor{shown.length === 1 ? "" : "es"}</div>
          {shown.length === 0 ? (
            <p className="py-12 text-center text-sm text-gym-muted">Esta sede no tiene proveedores. Cree el primero para poder cargar productos.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((s) => (
                <button key={s.id} type="button" onClick={() => openOne(s)} className={`rounded-xl border bg-gym-navy/40 p-4 text-left hover:border-gym-primary/60 ${s.active ? "border-gym-border/70" : "border-gym-border/40 opacity-50"}`}>
                  <div className="text-base font-semibold text-white">{s.name}</div>
                  <div className="mt-1 text-xs text-gym-muted">{s.taxId ? `NIT ${s.taxId}` : "Sin NIT"}{s.phone ? ` · ${s.phone}` : ""}</div>
                  {s.contactName && <div className="mt-1 text-xs text-gym-muted">{s.contactName}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8">
          <form onSubmit={save} className="glass my-4 w-full max-w-lg p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-white">{editing ? "Editar proveedor" : "Nuevo proveedor"}</h3>
                <p className="text-sm text-gym-muted">La razón social va con el NIT. El WhatsApp es el canal para pedirle y reclamarle.</p>
                {!editing && (
                  <p className="mt-1 text-xs text-gym-primary">
                    {resumed ? "Se recuperó lo que ya había escrito. " : ""}
                    Si sale o toca afuera, esto no se borra.
                    <button type="button" onClick={discardDraft} className="ml-2 underline">Empezar de cero</button>
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-gym-muted" aria-label="Cerrar">✕</button>
            </div>
            {err && <div className="mb-4 rounded-xl border border-status-warn/50 bg-status-warn/10 px-3 py-2 text-sm text-status-warn">{err}</div>}
            <label className={labelCls}>Razón social<span className="text-gym-primary">*</span></label>
            <input className={fieldCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Distribuciones del Valle SAS" required autoComplete="off" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>NIT</label>
                <input className={fieldCls} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} placeholder="900.123.456-1" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp</label>
                <input className={fieldCls} inputMode="numeric" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })} placeholder="3001234567" />
              </div>
            </div>
            <label className={`${labelCls} mt-3`}>Contacto</label>
            <input className={fieldCls} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Quién recibe el pedido" />
            <label className={`${labelCls} mt-3`}>Correo</label>
            <input className={fieldCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="pedidos@proveedor.com" />
            <label className={`${labelCls} mt-3`}>Dirección</label>
            <input className={fieldCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <label className={`${labelCls} mt-3`}>Días para entregar</label>
            <input className={fieldCls} inputMode="numeric" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value.replace(/\D/g, "") })} />
            <label className={`${labelCls} mt-3`}>Notas</label>
            <input className={fieldCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="mt-5 flex flex-wrap gap-2">
              <button className="btn-gym" disabled={busy}>{editing ? "Guardar" : "Crear proveedor"}</button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-gym-border px-4 py-2 text-sm text-gym-muted">Cerrar</button>
              {editing && (
                <button type="button" disabled={busy} onClick={() => remove(editing)} className={`ml-auto rounded-xl px-4 py-2 text-sm font-semibold ${confirmDelete ? "bg-red-500 text-white" : "border border-red-400/50 text-red-300"}`}>
                  {confirmDelete ? "Sí, eliminar" : "Eliminar"}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </GymShell>
  );
}
