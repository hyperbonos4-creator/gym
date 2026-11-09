import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { readJsonFile, writeJsonFile, updateJsonFileSync } from "./jsonStore";
import { randomInt, randomUUID } from "crypto";
import { STARTER_PRODUCTS } from "./retailCatalog";
import { SKU_PATTERN, familyPrefix, nextSku, restockTarget } from "./retailCodes";

const DATA_DIR = dataDir();
const FILE = path.join(DATA_DIR, "retail.json");

export type PayMethod = "efectivo" | "tarjeta" | "transferencia";
export type TaxTreatment = "GRAVADO" | "EXENTO" | "EXCLUIDO" | "NO_APLICA";
export type BarcodeOrigin = "factory" | "generated";

export type Product = {
  id: string;
  gymId: string;
  sku: string;
  barcode: string;
  barcodeOrigin: BarcodeOrigin;
  name: string;
  description: string;
  category: string;
  supplier: string;
  supplierId: string;
  unit: string;
  price: number;
  cost: number;
  /** Existencia en el gimnasio. Es lo único que se vende. */
  floorQty: number;
  /** Existencia en bodega. No se vende hasta bajarla. */
  warehouseQty: number;
  /** Copia de floorQty para lecturas viejas. */
  stock: number;
  minStock: number;
  maxStock: number | null;
  itemKind: "PRODUCT" | "SERVICE";
  tracksInventory: boolean;
  taxTreatment: TaxTreatment;
  vatRate: number;
  incomeAccount: string;
  inventoryAccount: string;
  costAccount: string;
  active: boolean;
  createdAt: string;
};

export type SaleItem = {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  price: number;
  lineTotal: number;
};

export type SalePayment = { method: PayMethod; amount: number };

export type Sale = {
  id: string;
  gymId: string;
  number: number;
  createdAt: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  payments: SalePayment[];
  change: number;
  note: string;
  status: "pagada" | "anulada";
  cashier: string;
  voidedAt?: string | null;
  voidedBy?: string | null;
  voidReason?: string | null;
  /** Turno que recibió el efectivo. Un pago de Wompi puede no tenerlo. */
  sessionId?: string | null;
  dian?: { cufe: string; consecutivo: string; sentAt: string } | null;
};

export type SaleMedio = "efectivo" | "tarjeta" | "transferencia" | "mixto" | "wompi";

export type CashSession = {
  id: string;
  gymId: string;
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  closingCount: number | null;
  openedBy: string;
};

export type Expense = {
  id: string;
  gymId: string;
  createdAt: string;
  category: string;
  amount: number;
  note: string;
  by: string;
  sessionId?: string | null;
};

export type Supplier = {
  id: string;
  gymId: string;
  name: string;
  taxId: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  leadTimeDays: number;
  notes: string;
  active: boolean;
  createdAt: string;
};

export type PurchaseLine = {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  cost: number;
};

export type PurchaseOrder = {
  id: string;
  gymId: string;
  number: number;
  supplierId: string;
  supplierName: string;
  status: "pedido" | "recibido" | "anulado";
  createdAt: string;
  receivedAt: string | null;
  note: string;
  lines: PurchaseLine[];
  by: string;
};

export type RestockLine = {
  productId: string;
  name: string;
  sku: string;
  floorQty: number;
  warehouseQty: number;
  qty: number;
  target: number;
};

type Db = {
  products: Product[];
  sales: Sale[];
  cash: CashSession[];
  expenses: Expense[];
  suppliers: Supplier[];
  orders: PurchaseOrder[];
};

const EMPTY: Db = { products: [], sales: [], cash: [], expenses: [], suppliers: [], orders: [] };

function readDb(): Db {
  let db: Db = { ...EMPTY, products: [], sales: [], cash: [], expenses: [], suppliers: [], orders: [] };
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const d = JSON.parse(raw);
    db = {
      products: Array.isArray(d.products) ? d.products : [],
      sales: Array.isArray(d.sales) ? d.sales : [],
      cash: Array.isArray(d.cash) ? d.cash : [],
      expenses: Array.isArray(d.expenses) ? d.expenses : [],
      suppliers: Array.isArray(d.suppliers) ? d.suppliers : [],
      orders: Array.isArray(d.orders) ? d.orders : [],
    };
  } catch {
    /* archivo nuevo */
  }
  if (normalizeDb(db)) writeDb(db);
  return db;
}

function writeDb(db: Db) {
  writeJsonFile(FILE, db);
}

export function money(n: number) {
  return Math.max(0, Math.round(Number(n) || 0));
}

export function bogotaDay(iso?: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(iso ? new Date(iso) : new Date());
}

function gs1CheckDigit(payload: string): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    const fromRight = payload.length - 1 - i;
    const weight = fromRight % 2 === 0 ? 3 : 1;
    sum += Number(payload[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function normalizeBarcode(raw: string) {
  return String(raw || "").replace(/[\s-]/g, "").trim();
}

function validBarcode(code: string) {
  return code.length >= 4 && code.length <= 48 && /^[\x21-\x7E]+$/.test(code);
}

function generateBarcode(taken: Set<string>): string {
  for (let attempt = 0; attempt < 24; attempt++) {
    let digits = "";
    for (let i = 0; i < 10; i++) digits += randomInt(0, 10);
    const payload = `20${digits}`;
    const code = payload + String(gs1CheckDigit(payload));
    if (!taken.has(code)) return code;
  }
  throw new Error("No se pudo generar un código de barras.");
}

function fillProduct(raw: Partial<Product> & { stock?: number }): Product {
  const floor = raw.floorQty != null ? money(raw.floorQty) : money(raw.stock || 0);
  const warehouse = raw.warehouseQty != null ? money(raw.warehouseQty) : 0;
  const barcode = normalizeBarcode(raw.barcode || "");
  return {
    id: raw.id || randomUUID(),
    gymId: String(raw.gymId || ""),
    sku: String(raw.sku || ""),
    barcode,
    barcodeOrigin: raw.barcodeOrigin === "generated" || barcode.startsWith("20") ? raw.barcodeOrigin || (barcode.startsWith("20") && barcode.length === 13 ? "generated" : "factory") : "factory",
    name: String(raw.name || ""),
    description: String(raw.description || ""),
    category: String(raw.category || "Otros"),
    supplier: String(raw.supplier || ""),
    supplierId: String(raw.supplierId || ""),
    unit: String(raw.unit || "unidad"),
    price: money(raw.price || 0),
    cost: money(raw.cost || 0),
    floorQty: floor,
    warehouseQty: warehouse,
    stock: floor,
    minStock: money(raw.minStock || 0),
    maxStock: raw.maxStock == null || Number(raw.maxStock) <= 0 ? null : money(Number(raw.maxStock)),
    itemKind: raw.itemKind === "SERVICE" ? "SERVICE" : "PRODUCT",
    tracksInventory: raw.tracksInventory !== false,
    taxTreatment: raw.taxTreatment || "GRAVADO",
    vatRate: raw.vatRate == null ? 19 : money(raw.vatRate),
    incomeAccount: String(raw.incomeAccount || "4135"),
    inventoryAccount: String(raw.inventoryAccount || "1435"),
    costAccount: String(raw.costAccount || "6135"),
    active: raw.active !== false,
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function normalizeDb(db: Db): boolean {
  let dirty = false;
  const counters = new Map<string, number>();
  const filled = db.products.map((raw) => {
    const before = JSON.stringify(raw);
    const p = fillProduct(raw);
    if (JSON.stringify(p) !== before) dirty = true;
    const m = p.sku.match(/^([A-Z]{3})-(\d+)$/);
    if (m && SKU_PATTERN.test(p.sku)) {
      const key = `${p.gymId}|${m[1]}`;
      counters.set(key, Math.max(counters.get(key) || 0, Number(m[2])));
    }
    return p;
  });

  const pending = filled
    .filter((p) => !SKU_PATTERN.test(p.sku))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.name.localeCompare(b.name, "es"));
  for (const p of pending) {
    const prefix = familyPrefix(p.category);
    const key = `${p.gymId}|${prefix}`;
    const n = (counters.get(key) || 0) + 1;
    counters.set(key, n);
    p.sku = `${prefix}-${String(n).padStart(5, "0")}`;
    dirty = true;
  }
  db.products = filled;
  if (!Array.isArray(db.suppliers)) {
    db.suppliers = [];
    dirty = true;
  }
  for (const p of db.products) {
    const name = p.supplier.trim();
    if (!name) continue;
    let s = db.suppliers.find((x) => x.gymId === p.gymId && x.name.toLowerCase() === name.toLowerCase());
    if (!s) {
      s = blankSupplier(p.gymId, name, p.createdAt);
      db.suppliers.push(s);
      dirty = true;
    }
    if (p.supplierId !== s.id) {
      p.supplierId = s.id;
      dirty = true;
    }
  }
  return dirty;
}

function sold30(db: Db, gymId: string, productId: string) {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let n = 0;
  for (const s of db.sales) {
    if (s.gymId !== gymId || s.status !== "pagada") continue;
    if (new Date(s.createdAt).getTime() < since) continue;
    for (const line of s.items) if (line.productId === productId) n += line.qty;
  }
  return n;
}

export function listProducts(gymId: string, opts?: { includeInactive?: boolean }) {
  return readDb()
    .products.filter((p) => p.gymId === gymId && (opts?.includeInactive || p.active))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function listRestock(gymId: string): RestockLine[] {
  const db = readDb();
  const lines: RestockLine[] = [];
  for (const p of db.products) {
    if (p.gymId !== gymId || !p.active || !p.tracksInventory) continue;
    if (p.minStock <= 0 || p.floorQty >= p.minStock || p.warehouseQty <= 0) continue;
    const target = restockTarget(p.minStock, p.maxStock, sold30(db, gymId, p.id));
    const qty = Math.min(p.warehouseQty, Math.max(0, target - p.floorQty));
    if (qty <= 0) continue;
    lines.push({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      floorQty: p.floorQty,
      warehouseQty: p.warehouseQty,
      qty,
      target,
    });
  }
  return lines.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function bringToFloor(gymId: string, productId?: string): number {
  const db = readDb();
  let n = 0;
  for (const line of listRestockFrom(db, gymId)) {
    if (productId && line.productId !== productId) continue;
    const p = db.products.find((x) => x.id === line.productId && x.gymId === gymId);
    if (!p) continue;
    const qty = Math.min(p.warehouseQty, line.qty);
    if (qty <= 0) continue;
    p.warehouseQty -= qty;
    p.floorQty += qty;
    p.stock = p.floorQty;
    n += 1;
  }
  if (n) writeDb(db);
  return n;
}

function listRestockFrom(db: Db, gymId: string): RestockLine[] {
  const lines: RestockLine[] = [];
  for (const p of db.products) {
    if (p.gymId !== gymId || !p.active || !p.tracksInventory) continue;
    if (p.minStock <= 0 || p.floorQty >= p.minStock || p.warehouseQty <= 0) continue;
    const target = restockTarget(p.minStock, p.maxStock, sold30(db, gymId, p.id));
    const qty = Math.min(p.warehouseQty, Math.max(0, target - p.floorQty));
    if (qty <= 0) continue;
    lines.push({ productId: p.id, name: p.name, sku: p.sku, floorQty: p.floorQty, warehouseQty: p.warehouseQty, qty, target });
  }
  return lines;
}

function takenBarcodes(db: Db, gymId: string, exceptId?: string) {
  return new Set(
    db.products
      .filter((p) => p.gymId === gymId && p.id !== exceptId && p.barcode)
      .map((p) => p.barcode),
  );
}

function blankSupplier(gymId: string, name: string, createdAt?: string): Supplier {
  return {
    id: randomUUID(),
    gymId,
    name,
    taxId: "",
    contactName: "",
    phone: "",
    email: "",
    address: "",
    leadTimeDays: 7,
    notes: "",
    active: true,
    createdAt: createdAt || new Date().toISOString(),
  };
}

function requireSupplier(db: Db, gymId: string, input: { supplierId?: string; supplier?: string }): Supplier {
  const id = String(input.supplierId || "").trim();
  if (id) {
    const s = db.suppliers.find((x) => x.id === id && x.gymId === gymId && x.active);
    if (!s) throw new Error("Ese proveedor no es de esta sede. Créelo primero.");
    return s;
  }
  const name = String(input.supplier || "").trim().toLowerCase();
  const s = name ? db.suppliers.find((x) => x.gymId === gymId && x.active && x.name.toLowerCase() === name) : null;
  if (!s) throw new Error("Cree el proveedor antes de dar de alta el producto.");
  return s;
}

export function listSuppliers(gymId: string) {
  return readDb()
    .suppliers.filter((s) => s.gymId === gymId)
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export function createSupplier(gymId: string, input: Partial<Supplier>): Supplier {
  const name = String(input.name || "").trim();
  if (name.length < 2) throw new Error("Escriba la razón social.");
  const db = readDb();
  if (db.suppliers.some((s) => s.gymId === gymId && s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Ese proveedor ya está en esta sede.");
  }
  const supplier: Supplier = {
    ...blankSupplier(gymId, name),
    taxId: String(input.taxId || "").trim(),
    contactName: String(input.contactName || "").trim(),
    phone: String(input.phone || "").replace(/\D/g, ""),
    email: String(input.email || "").trim(),
    address: String(input.address || "").trim(),
    leadTimeDays: Math.max(0, Math.round(Number(input.leadTimeDays) || 7)),
    notes: String(input.notes || "").trim(),
  };
  db.suppliers.push(supplier);
  writeDb(db);
  return supplier;
}

export function updateSupplier(gymId: string, id: string, patch: Partial<Supplier>): Supplier {
  const db = readDb();
  const i = db.suppliers.findIndex((s) => s.id === id && s.gymId === gymId);
  if (i < 0) throw new Error("No se encontró el proveedor.");
  const cur = db.suppliers[i];
  const name = patch.name != null ? String(patch.name).trim() : cur.name;
  if (name.length < 2) throw new Error("Escriba la razón social.");
  if (db.suppliers.some((s) => s.gymId === gymId && s.id !== id && s.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("Ese proveedor ya está en esta sede.");
  }
  const next: Supplier = {
    ...cur,
    name,
    taxId: patch.taxId != null ? String(patch.taxId).trim() : cur.taxId,
    contactName: patch.contactName != null ? String(patch.contactName).trim() : cur.contactName,
    phone: patch.phone != null ? String(patch.phone).replace(/\D/g, "") : cur.phone,
    email: patch.email != null ? String(patch.email).trim() : cur.email,
    address: patch.address != null ? String(patch.address).trim() : cur.address,
    leadTimeDays: patch.leadTimeDays != null ? Math.max(0, Math.round(Number(patch.leadTimeDays) || 0)) : cur.leadTimeDays,
    notes: patch.notes != null ? String(patch.notes).trim() : cur.notes,
    active: patch.active != null ? !!patch.active : cur.active,
  };
  db.suppliers[i] = next;
  for (const p of db.products) {
    if (p.gymId === gymId && p.supplierId === id) p.supplier = next.name;
  }
  writeDb(db);
  return next;
}

export function deleteSupplier(gymId: string, id: string): Supplier {
  const db = readDb();
  const i = db.suppliers.findIndex((s) => s.id === id && s.gymId === gymId);
  if (i < 0) throw new Error("No se encontró el proveedor.");
  if (db.products.some((p) => p.gymId === gymId && p.supplierId === id)) {
    throw new Error("Tiene productos. No se elimina.");
  }
  const [removed] = db.suppliers.splice(i, 1);
  writeDb(db);
  return removed;
}

export function createProduct(gymId: string, input: Partial<Product> & { barcodeMode?: string }): Product {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Escriba el nombre.");
  const price = money(input.price || 0);
  if (price <= 0) throw new Error("El precio de venta es obligatorio.");
  const category = String(input.category || "Otros").trim() || "Otros";
  const db = readDb();
  const supplier = requireSupplier(db, gymId, input);
  const sku = nextSku(db.products.filter((p) => p.gymId === gymId).map((p) => p.sku), category);
  const taken = takenBarcodes(db, gymId);
  const mode = input.barcodeMode === "factory" ? "factory" : "generate";
  let barcode = normalizeBarcode(input.barcode || "");
  let origin: BarcodeOrigin = "generated";
  if (mode === "factory") {
    if (!barcode) throw new Error("Dispare el código de fábrica o genere uno nuevo.");
    if (!validBarcode(barcode)) throw new Error("Ese código de barras no sirve.");
    origin = "factory";
  } else {
    barcode = generateBarcode(taken);
    origin = "generated";
  }
  const owner = db.products.find((p) => p.gymId === gymId && p.barcode === barcode);
  if (owner) throw new Error(`Ese código ya es de ${owner.name} (${owner.sku}).`);
  const floor = money(input.floorQty ?? input.stock ?? 0);
  const warehouse = money(input.warehouseQty || 0);
  const product = fillProduct({
    ...input,
    id: randomUUID(),
    gymId,
    sku,
    barcode,
    barcodeOrigin: origin,
    name,
    category,
    supplier: supplier.name,
    supplierId: supplier.id,
    price,
    floorQty: floor,
    warehouseQty: warehouse,
    stock: floor,
    active: true,
    createdAt: new Date().toISOString(),
  });
  db.products.push(product);
  writeDb(db);
  return product;
}

export function deleteProduct(gymId: string, id: string): { id: string; name: string; sku: string } {
  const db = readDb();
  const i = db.products.findIndex((p) => p.id === id && p.gymId === gymId);
  if (i < 0) throw new Error("No se encontró el producto.");
  const [removed] = db.products.splice(i, 1);
  writeDb(db);
  return { id: removed.id, name: removed.name, sku: removed.sku };
}

export function updateProduct(gymId: string, id: string, patch: Partial<Product> & { barcodeMode?: string }): Product {
  const db = readDb();
  const i = db.products.findIndex((p) => p.id === id && p.gymId === gymId);
  if (i < 0) throw new Error("No se encontró el producto.");
  const cur = db.products[i];
  const name = patch.name != null ? String(patch.name).trim() || cur.name : cur.name;
  const price = patch.price != null ? money(patch.price) : cur.price;
  if (price <= 0) throw new Error("El precio de venta es obligatorio.");
  let supplierName = cur.supplier;
  let supplierId = cur.supplierId;
  if (patch.supplierId || patch.supplier != null) {
    const linked = requireSupplier(db, gymId, {
      supplierId: String(patch.supplierId || cur.supplierId || ""),
      supplier: patch.supplier != null ? String(patch.supplier) : cur.supplier,
    });
    supplierName = linked.name;
    supplierId = linked.id;
  }
  let barcode = cur.barcode;
  let origin = cur.barcodeOrigin;
  if (patch.barcodeMode === "generate") {
    barcode = generateBarcode(takenBarcodes(db, gymId, id));
    origin = "generated";
  } else if (patch.barcode != null && normalizeBarcode(patch.barcode) && normalizeBarcode(patch.barcode) !== cur.barcode) {
    barcode = normalizeBarcode(patch.barcode);
    if (!validBarcode(barcode)) throw new Error("Ese código de barras no sirve.");
    const owner = db.products.find((p) => p.gymId === gymId && p.id !== id && p.barcode === barcode);
    if (owner) throw new Error(`Ese código ya es de ${owner.name} (${owner.sku}).`);
    origin = "factory";
  }
  const floor = patch.floorQty != null ? money(patch.floorQty) : cur.floorQty;
  const warehouse = patch.warehouseQty != null ? money(patch.warehouseQty) : cur.warehouseQty;
  const next = fillProduct({
    ...cur,
    name,
    description: patch.description != null ? String(patch.description) : cur.description,
    category: patch.category != null ? String(patch.category).trim() || cur.category : cur.category,
    supplier: supplierName,
    supplierId,
    unit: patch.unit != null ? String(patch.unit).trim() || "unidad" : cur.unit,
    price,
    cost: patch.cost != null ? money(patch.cost) : cur.cost,
    barcode,
    barcodeOrigin: origin,
    floorQty: floor,
    warehouseQty: warehouse,
    stock: floor,
    minStock: patch.minStock != null ? money(patch.minStock) : cur.minStock,
    maxStock: patch.maxStock !== undefined ? (patch.maxStock == null ? null : money(patch.maxStock)) : cur.maxStock,
    itemKind: patch.itemKind === "SERVICE" ? "SERVICE" : patch.itemKind === "PRODUCT" ? "PRODUCT" : cur.itemKind,
    tracksInventory: patch.tracksInventory != null ? !!patch.tracksInventory : cur.tracksInventory,
    taxTreatment: patch.taxTreatment || cur.taxTreatment,
    vatRate: patch.vatRate != null ? money(patch.vatRate) : cur.vatRate,
    incomeAccount: patch.incomeAccount != null ? String(patch.incomeAccount).replace(/\D/g, "") || cur.incomeAccount : cur.incomeAccount,
    inventoryAccount: patch.inventoryAccount != null ? String(patch.inventoryAccount).replace(/\D/g, "") || cur.inventoryAccount : cur.inventoryAccount,
    costAccount: patch.costAccount != null ? String(patch.costAccount).replace(/\D/g, "") || cur.costAccount : cur.costAccount,
    active: patch.active != null ? !!patch.active : cur.active,
    sku: cur.sku,
  });
  db.products[i] = next;
  writeDb(db);
  return next;
}

export function loadStarterCatalog(gymId: string): number {
  const db = readDb();
  const have = new Set(db.products.filter((p) => p.gymId === gymId).map((p) => p.barcode));
  let added = 0;
  for (const s of STARTER_PRODUCTS) {
    if (have.has(s.barcode)) continue;
    const sku = nextSku(db.products.filter((p) => p.gymId === gymId).map((p) => p.sku), s.category);
    db.products.push(fillProduct({
      id: randomUUID(),
      gymId,
      sku,
      barcode: s.barcode,
      barcodeOrigin: "factory",
      name: s.name,
      description: s.description,
      category: s.category,
      supplier: s.supplier,
      unit: "unidad",
      price: s.price,
      cost: s.cost,
      floorQty: s.floorQty,
      warehouseQty: s.warehouseQty,
      stock: s.floorQty,
      minStock: s.minStock,
      maxStock: null,
      active: true,
      createdAt: new Date().toISOString(),
    }));
    added += 1;
  }
  if (added) writeDb(db);
  return added;
}

export function openSession(gymId: string): CashSession | null {
  return readDb().cash.find((c) => c.gymId === gymId && !c.closedAt) || null;
}

export function openCash(gymId: string, openingFloat: number, openedBy: string): CashSession {
  const db = readDb();
  if (db.cash.some((c) => c.gymId === gymId && !c.closedAt)) throw new Error("caja_ya_abierta");
  const session: CashSession = {
    id: randomUUID(),
    gymId,
    openedAt: new Date().toISOString(),
    closedAt: null,
    openingFloat: money(openingFloat),
    closingCount: null,
    openedBy: openedBy || "caja",
  };
  db.cash.push(session);
  writeDb(db);
  return session;
}

export function closeCash(gymId: string, closingCount: number): CashSession {
  const db = readDb();
  const i = db.cash.findIndex((c) => c.gymId === gymId && !c.closedAt);
  if (i < 0) throw new Error("caja_cerrada");
  db.cash[i] = { ...db.cash[i], closedAt: new Date().toISOString(), closingCount: money(closingCount) };
  writeDb(db);
  return db.cash[i];
}

export function checkout(input: {
  gymId: string;
  cashier: string;
  items: { productId: string; qty: number }[];
  discount?: number;
  payments: SalePayment[];
  note?: string;
}): Sale {
  const linesIn = input.items.filter((l) => money(l.qty) > 0);
  if (!linesIn.length) throw new Error("carrito_vacio");
  const db = readDb();
  const grouped = new Map<string, number>();
  for (const l of linesIn) grouped.set(l.productId, (grouped.get(l.productId) || 0) + money(l.qty));

  const saleItems: SaleItem[] = [];
  for (const [productId, qty] of grouped) {
    const p = db.products.find((x) => x.id === productId && x.gymId === input.gymId && x.active);
    if (!p) throw new Error("producto_no_encontrado");
    if (!p.tracksInventory || p.itemKind === "SERVICE") {
      saleItems.push({ productId: p.id, name: p.name, sku: p.sku, qty, price: p.price, lineTotal: p.price * qty });
      continue;
    }
    if (p.floorQty < qty) {
      if (p.warehouseQty > 0) throw new Error(`En el gimnasio no hay ${p.name}. En bodega hay ${p.warehouseQty}. Bájelo al gimnasio antes de vender.`);
      throw new Error(`No hay ${p.name} en el gimnasio.`);
    }
    saleItems.push({ productId: p.id, name: p.name, sku: p.sku, qty, price: p.price, lineTotal: p.price * qty });
    p.floorQty -= qty;
    p.stock = p.floorQty;
  }

  const session = db.cash.find((c) => c.gymId === input.gymId && !c.closedAt);
  if (!session) throw new Error("caja_cerrada");

  const subtotal = saleItems.reduce((a, l) => a + l.lineTotal, 0);
  const discount = Math.min(subtotal, money(input.discount || 0));
  const total = subtotal - discount;
  const payments = (input.payments || [])
    .map((p) => ({ method: p.method, amount: money(p.amount) }))
    .filter((p) => p.amount > 0 && (p.method === "efectivo" || p.method === "tarjeta" || p.method === "transferencia"));
  const paid = payments.reduce((a, p) => a + p.amount, 0);
  if (paid < total) throw new Error("pago_insuficiente");

  const numbers = db.sales.filter((s) => s.gymId === input.gymId).map((s) => s.number);
  const sale: Sale = {
    id: randomUUID(),
    gymId: input.gymId,
    number: (numbers.length ? Math.max(...numbers) : 0) + 1,
    createdAt: new Date().toISOString(),
    items: saleItems,
    subtotal,
    discount,
    total,
    payments,
    change: paid - total,
    note: String(input.note || "").trim(),
    status: "pagada",
    cashier: input.cashier || "caja",
    sessionId: session.id,
  };
  db.sales.push(sale);
  writeDb(db);
  return sale;
}

/** Venta que no descuenta inventario: membresía, pase, servicio. */
export function recordServiceSale(input: {
  gymId: string;
  cashier: string;
  name: string;
  amount: number;
  method: "efectivo" | "tarjeta" | "transferencia";
  note?: string;
}): Sale {
  const amount = money(input.amount);
  if (amount <= 0) throw new Error("monto_invalido");
  const method = input.method;
  if (method !== "efectivo" && method !== "tarjeta" && method !== "transferencia") throw new Error("metodo_invalido");
  const db = readDb();
  const session = db.cash.find((c) => c.gymId === input.gymId && !c.closedAt) || null;
  if (input.method === "efectivo" && !session) throw new Error("caja_cerrada");
  const numbers = db.sales.filter((s) => s.gymId === input.gymId).map((s) => s.number);
  const sale: Sale = {
    id: randomUUID(),
    gymId: input.gymId,
    number: (numbers.length ? Math.max(...numbers) : 0) + 1,
    createdAt: new Date().toISOString(),
    items: [{ productId: "servicio:membresia", name: input.name, sku: "MEM", qty: 1, price: amount, lineTotal: amount }],
    subtotal: amount,
    discount: 0,
    total: amount,
    payments: [{ method, amount }],
    change: 0,
    note: String(input.note || "").trim(),
    status: "pagada",
    cashier: input.cashier || "caja",
    sessionId: session?.id || null,
  };
  db.sales.push(sale);
  writeDb(db);
  return sale;
}

export function topSellerIds(gymId: string, limit = 6): string[] {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const s of readDb().sales) {
    if (s.gymId !== gymId || s.status !== "pagada") continue;
    if (new Date(s.createdAt).getTime() < since) continue;
    for (const line of s.items) {
      if (!line.productId || line.productId.startsWith("servicio:")) continue;
      counts.set(line.productId, (counts.get(line.productId) || 0) + line.qty);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
}

export function voidSale(gymId: string, id: string, by = "", reason = ""): Sale {
  const db = readDb();
  const i = db.sales.findIndex((s) => s.id === id && s.gymId === gymId);
  if (i < 0) throw new Error("venta_no_encontrada");
  const sale = db.sales[i];
  if (sale.status === "anulada") throw new Error("ya_anulada");
  if (bogotaDay(sale.createdAt) !== bogotaDay()) throw new Error("solo_hoy");
  if (sale.sessionId) {
    const session = db.cash.find((c) => c.id === sale.sessionId);
    if (session?.closedAt) throw new Error("turno_cerrado");
  }
  const why = String(reason || "").trim().slice(0, 180);
  if (!why) throw new Error("motivo_requerido");
  for (const line of sale.items) {
    const p = db.products.find((x) => x.id === line.productId && x.gymId === gymId);
    if (p && p.tracksInventory && p.itemKind !== "SERVICE") {
      p.floorQty += line.qty;
      p.stock = p.floorQty;
    }
  }
  db.sales[i] = {
    ...sale,
    status: "anulada",
    voidedAt: new Date().toISOString(),
    voidedBy: String(by || "").trim() || "caja",
    voidReason: why,
  };
  writeDb(db);
  return db.sales[i];
}

export function saleMedio(s: Sale): SaleMedio {
  const blob = `${s.note || ""} ${s.cashier || ""}`.toLowerCase();
  if (blob.includes("wompi")) return "wompi";
  const methods = [...new Set(s.payments.map((p) => p.method))];
  if (methods.length > 1) return "mixto";
  if (methods[0] === "efectivo" || methods[0] === "tarjeta" || methods[0] === "transferencia") return methods[0];
  return "efectivo";
}

function plataDe(s: Sale) {
  const out = { efectivo: 0, tarjeta: 0, transferencia: 0, wompi: 0 };
  if (saleMedio(s) === "wompi") {
    out.wompi = s.total;
    return out;
  }
  let left = s.total;
  const ordered = [...s.payments].sort((a, b) => (a.method === "efectivo" ? 1 : -1));
  for (const p of ordered) {
    const take = Math.min(left, p.amount);
    out[p.method] += take;
    left -= take;
  }
  return out;
}

export function querySales(
  gymId: string,
  opts: { from?: string; to?: string; q?: string; estado?: string; medio?: string; limit?: number },
) {
  const db = readDb();
  const q = String(opts.q || "").trim().toLowerCase();
  const porNumero = /^\d+$/.test(q);
  let rows = db.sales.filter((s) => s.gymId === gymId);
  if (porNumero) {
    rows = rows.filter((s) => String(s.number) === q);
  } else {
    const from = opts.from || bogotaDay();
    const to = opts.to || from;
    const [a, b] = from <= to ? [from, to] : [to, from];
    rows = rows.filter((s) => {
      const d = bogotaDay(s.createdAt);
      return d >= a && d <= b;
    });
    if (q) {
      rows = rows.filter((s) =>
        String(s.number).includes(q) ||
        (s.cashier || "").toLowerCase().includes(q) ||
        (s.note || "").toLowerCase().includes(q) ||
        (s.voidReason || "").toLowerCase().includes(q) ||
        s.items.some((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)),
      );
    }
  }
  if (opts.estado === "pagada" || opts.estado === "anulada") {
    rows = rows.filter((s) => s.status === opts.estado);
  }
  if (opts.medio && opts.medio !== "todos") {
    rows = rows.filter((s) => saleMedio(s) === opts.medio);
  }
  rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const cobradas = rows.filter((s) => s.status === "pagada");
  const medios = { efectivo: 0, tarjeta: 0, transferencia: 0, wompi: 0 };
  for (const s of cobradas) {
    const p = plataDe(s);
    medios.efectivo += p.efectivo;
    medios.tarjeta += p.tarjeta;
    medios.transferencia += p.transferencia;
    medios.wompi += p.wompi;
  }
  const limit = Math.min(Math.max(opts.limit || 400, 1), 400);
  const items = rows.slice(0, limit).map((s) => {
    const session = s.sessionId ? db.cash.find((c) => c.id === s.sessionId) : undefined;
    const turno = !s.sessionId || !session ? "sin_turno" : session.closedAt ? "cerrado" : "abierto";
    return { ...s, medio: saleMedio(s), turno };
  });
  return {
    porNumero,
    totalCount: rows.length,
    items,
    summary: {
      tickets: cobradas.length,
      anuladas: rows.filter((s) => s.status === "anulada").length,
      total: cobradas.reduce((a, s) => a + s.total, 0),
      discount: cobradas.reduce((a, s) => a + (s.discount || 0), 0),
      medios,
    },
  };
}

export function attachSaleDian(gymId: string, saleId: string, dian: { cufe: string; consecutivo: string }) {
  const db = readDb();
  const i = db.sales.findIndex((s) => s.gymId === gymId && s.id === saleId);
  if (i < 0) throw new Error("venta_no_encontrada");
  db.sales[i] = {
    ...db.sales[i],
    dian: { cufe: dian.cufe, consecutivo: dian.consecutivo, sentAt: new Date().toISOString() },
  };
  writeDb(db);
  return db.sales[i];
}

export function listSales(gymId: string, day?: string) {
  const want = day || bogotaDay();
  return readDb()
    .sales.filter((s) => s.gymId === gymId && bogotaDay(s.createdAt) === want)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function addExpense(gymId: string, input: { category: string; amount: number; note?: string; by: string }): Expense {
  const amount = money(input.amount);
  if (amount <= 0) throw new Error("monto_invalido");
  const db = readDb();
  const session = db.cash.find((c) => c.gymId === gymId && !c.closedAt);
  if (!session) throw new Error("caja_cerrada");
  const expense: Expense = {
    id: randomUUID(),
    gymId,
    createdAt: new Date().toISOString(),
    category: String(input.category || "Otros").trim() || "Otros",
    amount,
    note: String(input.note || "").trim(),
    by: input.by || "caja",
    sessionId: session.id,
  };
  db.expenses.push(expense);
  writeDb(db);
  return expense;
}

export function listExpenses(gymId: string, day?: string) {
  const want = day || bogotaDay();
  return readDb()
    .expenses.filter((e) => e.gymId === gymId && bogotaDay(e.createdAt) === want)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function daySummary(gymId: string) {
  const day = bogotaDay();
  const sales = listSales(gymId, day).filter((s) => s.status === "pagada");
  const expenses = listExpenses(gymId, day);
  const byMethod = { efectivo: 0, tarjeta: 0, transferencia: 0 };
  for (const s of sales) {
    let left = s.total;
    const ordered = [...s.payments].sort((a, b) => (a.method === "efectivo" ? 1 : -1));
    for (const p of ordered) {
      const take = Math.min(left, p.amount);
      byMethod[p.method] += take;
      left -= take;
    }
  }
  const expenseTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const session = openSession(gymId);
  const inShift = session ? sales.filter((s) => s.sessionId === session.id) : [];
  let efectivoTurno = 0;
  for (const s of inShift) {
    let left = s.total;
    const ordered = [...s.payments].sort((a, b) => (a.method === "efectivo" ? 1 : -1));
    for (const p of ordered) {
      const take = Math.min(left, p.amount);
      if (p.method === "efectivo") efectivoTurno += take;
      left -= take;
    }
  }
  const expenseShift = session
    ? expenses.filter((e) => e.sessionId === session.id).reduce((a, e) => a + e.amount, 0)
    : 0;
  const expectedCash = session ? session.openingFloat + efectivoTurno - expenseShift : 0;
  return {
    day,
    tickets: sales.length,
    total: sales.reduce((a, s) => a + s.total, 0),
    discount: sales.reduce((a, s) => a + s.discount, 0),
    byMethod,
    expenses: expenseTotal,
    session,
    expectedCash,
    efectivoTurno,
    gastosEfectivoTurno: expenseShift,
  };
}

export function queryExpenses(gymId: string, from?: string, to?: string) {
  const start = from || bogotaDay();
  const end = to || start;
  const [a, b] = start <= end ? [start, end] : [end, start];
  const items = readDb()
    .expenses.filter((e) => e.gymId === gymId && bogotaDay(e.createdAt) >= a && bogotaDay(e.createdAt) <= b)
    .sort((x, y) => (x.createdAt < y.createdAt ? 1 : -1));
  const byCategory = new Map<string, number>();
  for (const e of items) byCategory.set(e.category, (byCategory.get(e.category) || 0) + e.amount);
  return {
    items,
    total: items.reduce((n, e) => n + e.amount, 0),
    byCategory: [...byCategory.entries()].map(([name, total]) => ({ name, total })).sort((x, y) => y.total - x.total),
  };
}

export function findProductByCode(gymId: string, code: string) {
  const c = String(code || "").trim().toLowerCase();
  if (!c) return null;
  return readDb().products.find((p) => p.gymId === gymId && (p.barcode.toLowerCase() === c || p.sku.toLowerCase() === c)) || null;
}

export function listOrders(gymId: string) {
  return readDb()
    .orders.filter((o) => o.gymId === gymId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createOrder(input: {
  gymId: string;
  supplierId: string;
  note?: string;
  by: string;
  lines: { productId: string; qty: number; cost?: number }[];
}): PurchaseOrder {
  const db = readDb();
  const supplier = db.suppliers.find((s) => s.id === input.supplierId && s.gymId === input.gymId && s.active);
  if (!supplier) throw new Error("proveedor_no_encontrado");
  const lines: PurchaseLine[] = [];
  for (const raw of input.lines) {
    const qty = money(raw.qty);
    if (qty <= 0) continue;
    const p = db.products.find((x) => x.id === raw.productId && x.gymId === input.gymId);
    if (!p) throw new Error("producto_no_encontrado");
    lines.push({ productId: p.id, name: p.name, sku: p.sku, qty, cost: money(raw.cost ?? p.cost) });
  }
  if (!lines.length) throw new Error("pedido_vacio");
  const numbers = db.orders.filter((o) => o.gymId === input.gymId).map((o) => o.number);
  const order: PurchaseOrder = {
    id: randomUUID(),
    gymId: input.gymId,
    number: (numbers.length ? Math.max(...numbers) : 0) + 1,
    supplierId: supplier.id,
    supplierName: supplier.name,
    status: "pedido",
    createdAt: new Date().toISOString(),
    receivedAt: null,
    note: String(input.note || "").trim(),
    lines,
    by: input.by || "caja",
  };
  db.orders.push(order);
  writeDb(db);
  return order;
}

export function receiveOrder(gymId: string, id: string): PurchaseOrder {
  const db = readDb();
  const i = db.orders.findIndex((o) => o.id === id && o.gymId === gymId);
  if (i < 0) throw new Error("pedido_no_encontrado");
  const order = db.orders[i];
  if (order.status === "recibido") throw new Error("ya_recibido");
  if (order.status === "anulado") throw new Error("pedido_anulado");
  for (const line of order.lines) {
    const p = db.products.find((x) => x.id === line.productId && x.gymId === gymId);
    if (!p) continue;
    p.warehouseQty += line.qty;
    if (line.cost > 0) p.cost = line.cost;
  }
  db.orders[i] = { ...order, status: "recibido", receivedAt: new Date().toISOString() };
  writeDb(db);
  return db.orders[i];
}

export function cancelOrder(gymId: string, id: string): PurchaseOrder {
  const db = readDb();
  const i = db.orders.findIndex((o) => o.id === id && o.gymId === gymId);
  if (i < 0) throw new Error("pedido_no_encontrado");
  if (db.orders[i].status === "recibido") throw new Error("ya_recibido");
  db.orders[i] = { ...db.orders[i], status: "anulado" };
  writeDb(db);
  return db.orders[i];
}

export function retailReport(gymId: string, from?: string, to?: string) {
  const start = from || bogotaDay();
  const end = to || start;
  const [a, b] = start <= end ? [start, end] : [end, start];
  const db = readDb();
  const sales = db.sales.filter((s) => s.gymId === gymId && bogotaDay(s.createdAt) >= a && bogotaDay(s.createdAt) <= b);
  const paid = sales.filter((s) => s.status === "pagada");
  const voids = sales.filter((s) => s.status === "anulada");
  const medios = { efectivo: 0, tarjeta: 0, transferencia: 0, wompi: 0 };
  let costKnown = 0;
  let revenueWithCost = 0;
  let missingCost = 0;
  const byProduct = new Map<string, { name: string; sku: string; qty: number; revenue: number; cost: number }>();
  const byCashier = new Map<string, { tickets: number; revenue: number }>();
  for (const s of paid) {
    const plata = (() => {
      if (saleMedio(s) === "wompi") return { efectivo: 0, tarjeta: 0, transferencia: 0, wompi: s.total };
      const out = { efectivo: 0, tarjeta: 0, transferencia: 0, wompi: 0 };
      let left = s.total;
      for (const p of [...s.payments].sort((x, y) => (x.method === "efectivo" ? 1 : -1))) {
        const take = Math.min(left, p.amount);
        out[p.method] += take;
        left -= take;
      }
      return out;
    })();
    medios.efectivo += plata.efectivo;
    medios.tarjeta += plata.tarjeta;
    medios.transferencia += plata.transferencia;
    medios.wompi += plata.wompi;
    const who = byCashier.get(s.cashier || "caja") || { tickets: 0, revenue: 0 };
    who.tickets += 1;
    who.revenue += s.total;
    byCashier.set(s.cashier || "caja", who);
    for (const line of s.items) {
      const product = db.products.find((p) => p.id === line.productId);
      const unitCost = product && product.cost > 0 ? product.cost : 0;
      if (unitCost > 0) {
        costKnown += unitCost * line.qty;
        revenueWithCost += line.lineTotal;
      } else missingCost += 1;
      const key = `${line.productId}::${line.name}`;
      const row = byProduct.get(key) || { name: line.name, sku: line.sku, qty: 0, revenue: 0, cost: 0 };
      row.qty += line.qty;
      row.revenue += line.lineTotal;
      row.cost += unitCost * line.qty;
      byProduct.set(key, row);
    }
  }
  const expenses = queryExpenses(gymId, a, b);
  const low = db.products
    .filter((p) => p.gymId === gymId && p.active && p.tracksInventory && p.itemKind !== "SERVICE" && p.minStock > 0 && p.floorQty < p.minStock)
    .map((p) => ({ id: p.id, name: p.name, sku: p.sku, floorQty: p.floorQty, warehouseQty: p.warehouseQty, minStock: p.minStock }));
  const closes = db.cash
    .filter((c) => c.gymId === gymId && c.closedAt && bogotaDay(c.closedAt) >= a && bogotaDay(c.closedAt) <= b)
    .map((c) => {
      const shiftSales = db.sales.filter((s) => s.sessionId === c.id && s.status === "pagada");
      let cash = 0;
      for (const s of shiftSales) {
        if (saleMedio(s) === "wompi") continue;
        let left = s.total;
        for (const p of s.payments) {
          const take = Math.min(left, p.amount);
          if (p.method === "efectivo") cash += take;
          left -= take;
        }
      }
      const gastos = db.expenses.filter((e) => e.sessionId === c.id).reduce((n, e) => n + e.amount, 0);
      const esperado = c.openingFloat + cash - gastos;
      return {
        id: c.id,
        openedAt: c.openedAt,
        closedAt: c.closedAt,
        openedBy: c.openedBy,
        openingFloat: c.openingFloat,
        counted: c.closingCount,
        esperado,
        difference: c.closingCount == null ? null : c.closingCount - esperado,
      };
    });
  const revenue = paid.reduce((n, s) => n + s.total, 0);
  return {
    from: a,
    to: b,
    tickets: paid.length,
    voids: voids.length,
    voidTotal: voids.reduce((n, s) => n + s.total, 0),
    revenue,
    discount: paid.reduce((n, s) => n + (s.discount || 0), 0),
    costKnown,
    revenueWithCost,
    missingCost,
    margin: revenueWithCost - costKnown,
    expenses: expenses.total,
    expensesByCategory: expenses.byCategory,
    medios,
    products: [...byProduct.values()].sort((x, y) => y.revenue - x.revenue).slice(0, 12),
    cashiers: [...byCashier.entries()].map(([name, v]) => ({ name, ...v })).sort((x, y) => y.revenue - x.revenue),
    low,
    closes,
  };
}
