"use client";

import { cop } from "../lib/money";
import { barcodeSvg } from "../lib/barcodeSvg";

/**
 * Etiqueta de góndola como en Zora: 32 × 15 mm, dos por fila,
 * en una térmica de 80 mm. No es un recibo.
 */

function esc(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function corto(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : t.slice(0, n);
}

export function EtiquetaCodigo({
  gymName,
  code,
  nombre,
  sku,
  precio,
  enStock,
}: {
  gymId: string;
  gymName: string;
  gymShort: string;
  code: string;
  nombre: string;
  sku: string;
  precio: number;
  descripcion?: string;
  enStock: number;
}) {
  const svg = barcodeSvg(code, { digits: false });
  if (!svg) return null;
  const titulo = corto(nombre || sku || "Producto", 16);
  const precioTxt = cop(precio || 0);

  function imprimir(cuantas: number) {
    const pedidas = Math.min(500, Math.max(1, Math.round(cuantas)));
    const filas = Math.ceil(pedidas / 2);
    const una = `
      <article class="eti">
        <p class="marca">${esc(corto(gymName, 18))}</p>
        <div class="barras">${svg}</div>
        <p class="nom">${esc(titulo)}</p>
        <p class="precio">${esc(precioTxt)}</p>
      </article>`;
    const fila = `<div class="fila">${una}${una}</div>`;
    const w = window.open("", "_blank", "noopener,width=420,height=640");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Etiquetas ${esc(sku)}</title>
      <style>
        @page { size: 80mm 15mm; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        .fila { display: flex; width: 67mm; height: 15mm; break-after: page; }
        .eti { width: 32mm; height: 15mm; overflow: hidden; box-sizing: border-box; padding: 0.6mm 1mm 0; text-align: center; color: #000; font-family: Arial, sans-serif; }
        .eti + .eti { margin-left: 3mm; }
        .marca { margin: 0; font-size: 5.5pt; font-weight: 700; letter-spacing: 0.04em; line-height: 1; text-transform: uppercase; }
        .barras { height: 6.2mm; overflow: hidden; }
        .barras svg { width: 100%; height: 6.2mm; display: block; }
        .nom { margin: 0; font-size: 5.5pt; line-height: 1.05; font-weight: 700; }
        .precio { margin: 0; font-size: 6pt; font-weight: 700; line-height: 1; }
      </style></head><body>${fila.repeat(filas)}
      <script>onload=()=>{print();}</script></body></html>`);
    w.document.close();
  }

  const stock = Math.max(0, Math.round(enStock));

  return (
    <div className="mt-3">
      <p className="text-xs text-gym-muted">Rollo de 32 × 15 mm, dos etiquetas por fila, en térmica de 80 mm.</p>
      <div className="mt-2 inline-flex bg-white text-black" style={{ width: "67mm", height: "15mm" }}>
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden text-center" style={{ width: "32mm", height: "15mm", marginLeft: i ? "3mm" : 0, padding: "0.6mm 1mm 0" }}>
            <p className="truncate text-[5.5pt] font-bold uppercase leading-none">{corto(gymName, 18)}</p>
            <div className="h-[6.2mm] overflow-hidden" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="truncate text-[5.5pt] font-bold leading-none">{titulo}</p>
            <p className="text-[6pt] font-bold leading-none">{precioTxt}</p>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {[2, 10].map((n) => (
          <button key={n} type="button" onClick={() => imprimir(n)} className="rounded-lg border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">
            Imprimir {n}
          </button>
        ))}
        {stock > 0 && (
          <button type="button" onClick={() => imprimir(stock)} className="rounded-lg border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">
            Las {stock} del stock
          </button>
        )}
      </div>
    </div>
  );
}
