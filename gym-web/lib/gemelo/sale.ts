/**
 * Parte 3 · venta real en recepción: Valentina saca una bebida de la nevera, la deja en el mostrador,
 * la cajera la escanea con la pistola y el punto de venta la agrega. El producto sale del catálogo
 * de ejemplo (lib/retailCatalog.ts), con su nombre, precio y código de barras tal cual.
 */
import { STARTER_PRODUCTS } from "../retailCatalog";
import type { Tour } from "./tour";

const pick = (code: string) => {
  const p = STARTER_PRODUCTS.find((x) => x.barcode === code)!;
  return { name: p.name, price: p.price, barcode: p.barcode };
};
/** La bebida que Valentina compra. */
export const SALE_ITEM = pick("7701001000081");
/** Bebidas de la nevera (todas del catálogo). */
export const FRIDGE_ITEMS = { agua: pick("7701001000091"), isotonica: pick("7701001000081"), energetica: pick("7701001000101") };
export const cop = (n: number) => `$${n.toLocaleString("es-CO")}`;

export const ss = (t: number, a: number, b: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** tiempos (s) dentro de la fase "fridge" */
export const FR = { open0: 0.5, open1: 1.3, grab: 2.3, close0: 3.2, close1: 4.0 };
/** tiempos (s) dentro de la fase "scan" */
export const SC = { put: 0.9, take: 1.6, laser0: 2.3, beep: 3.0, down: 3.9 };

export type BottleAt = "fridge" | "vale" | "counterA" | "cashier" | "counterB";
export function bottleAt(tour: Tour): BottleAt {
  if (!tour.active || tour.chapter !== 3) return "fridge";
  const ph = tour.phase;
  const t = tour.phaseT;
  if (ph === "to_fridge" || (ph === "fridge" && t < FR.grab)) return "fridge";
  if (ph === "fridge" || ph === "to_counter" || (ph === "scan" && t < SC.put)) return "vale";
  if (ph === "scan" && t < SC.take) return "counterA";
  if (ph === "scan" && t < SC.down) return "cashier";
  return "counterB";
}
