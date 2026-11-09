/** Código de familia: las tres primeras letras de la góndola. SUP-00012 no cambia si el producto se mueve. */

export function familyPrefix(category: string): string {
  const base = String(category || "GEN")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();
  return (base.slice(0, 3) || "GEN").padEnd(3, "X");
}

export function nextSku(skus: string[], category: string): string {
  const prefix = familyPrefix(category);
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const sku of skus) {
    const m = String(sku || "").match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}-${String(max + 1).padStart(5, "0")}`;
}

export const SKU_PATTERN = /^[A-Z]{3}-\d{5}$/;

/**
 * A cuántas queda el gimnasio cuando bajan de la bodega.
 * Sin máximo: el doble del límite, o una semana de venta si se vende más, tope el triple.
 */
export function restockTarget(minStock: number, maxStock: number | null, sold30: number): number {
  const min = Math.max(0, Math.round(minStock) || 0);
  if (maxStock != null && maxStock > min) return Math.round(maxStock);
  const week = sold30 > 0 ? Math.ceil((sold30 / 30) * 7) : 0;
  let meta = min * 2;
  if (week > meta) meta = Math.min(week, min * 3);
  return meta;
}
