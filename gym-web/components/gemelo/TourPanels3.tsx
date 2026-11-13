"use client";

/**
 * Pantallas del recorrido "Caja y ventas" (Parte 3). Textos del código real:
 *  - Punto de venta (app/caja/page.tsx): buscador "Nombre, código o pistola…", carrito, Cobrar, forma de pago
 *    (efectivo · transferencia · tarjeta · mixto), A cobrar / Exacto, "Venta cobrada", "Cambio a devolver",
 *    "¿El cliente desea factura?".
 *  - Venta: la bebida que Valentina sacó de la nevera entra por la pistola (lib/gemelo/sale.ts, mismo nombre, precio
 *    y código del catálogo). Tras cobrar, "¿El cliente desea factura?" → "Sí, imprimir" imprime el ticket (formato
 *    80 mm de imprimir(): VENTA n.º, renglones, "Total a pagar", pagos y cambio).
 *  - Facturación DIAN (app/facturacion/page.tsx): 07 Factura electrónica → ticket de hoy, Tipo de documento, Número,
 *    Nombre o razón social, Correo del cliente, Tipo de persona, Forma/Medio de pago; ítems del ticket con IVA
 *    (0 %, 5 % o 19 %); "Enviar factura a la DIAN" → "Factura {consecutivo} aceptada." + CUFE, que se anota en la
 *    venta (/api/facturacion/venta); 08 Archivos del motor: XML firmado y PDF. Ambiente de habilitación (demo).
 *  - Inventario (app/inventario) y Catálogo (app/productos: "Bajar todo" de bodega al gimnasio).
 *  - Pedidos (app/pedidos): compra al proveedor, "Crear pedido", "Recibir en bodega", "Entrada a bodega registrada.".
 *  - Cierre de caja (app/caja: Antes de cerrar, Se espera en la caja, Efectivo contado, Diferencia, Cerrar caja).
 * Productos y precios del catálogo de ejemplo (lib/retailCatalog.ts). Nada se envía: ni DIAN, ni Wompi, ni WhatsApp.
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { TOUR_PERSON, type Tour } from "../../lib/gemelo/tour";
import { SALE_ITEM, cop } from "../../lib/gemelo/sale";

const P = TOUR_PERSON;
const show = (el: HTMLElement | null | undefined, v: boolean, disp = "") => {
  if (el) el.style.display = v ? disp : "none";
};
function typed(s: string, t: number, t0: number, t1: number) {
  if (t <= t0) return "";
  if (t >= t1) return s;
  return s.slice(0, Math.floor(((t - t0) / (t1 - t0)) * s.length + 0.0001));
}
const fixedPos = (() => [0, 0]) as any;
const PH: Record<string, string> = {
  pos: "Punto de venta", fact: "Punto de venta", cliente: "Facturación DIAN", items: "Facturación DIAN", dian: "Facturación DIAN", files: "Facturación DIAN",
  stock: "Inventario", order: "Pedidos", close: "Punto de venta",
};
const INV = ["fact", "cliente", "items", "dian", "files"];
const CHIP: Record<string, string> = {
  pos: "La pistola agrega la bebida y se cobra",
  fact: "Factura 1/5 · ¿El cliente desea factura?",
  cliente: "Factura 2/5 · Datos del cliente",
  items: "Factura 3/5 · Ítems del ticket e IVA",
  dian: "Factura 4/5 · Envío a la DIAN y CUFE",
  files: "Factura 5/5 · XML firmado y PDF",
  stock: "Inventario de gimnasio y bodega",
  order: "Pedido al proveedor y entrada a bodega",
  close: "Cierre de caja: el conteo debe cuadrar",
};
const CUFE = "a3f9c2e1…7b04d8e5 (demo)";

export function CajaPanel({ tour }: { tour: Tour }) {
  const root = useRef<HTMLDivElement>(null);
  const f = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => {
    f.current[k] = el;
  };
  const { size } = useThree();
  const ad = typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search);
  useFrame(() => {
    const el = root.current;
    if (!el) return;
    const ph = tour.phase;
    const on = tour.active && tour.chapter === 3 && ph in PH;
    el.style.display = on ? "" : "none";
    if (!on) return;
    const t = tour.phaseT;
    const portrait = size.width < size.height;
    const fitInteractive = !ad && portrait;
    const PW = portrait ? 400 : 600;
    const PHh = portrait ? 610 : 560;
    el.classList.toggle("gm-coach-p", portrait);
    el.style.width = `${PW}px`;
    el.style.height = `${PHh}px`;
    const s = fitInteractive
      ? Math.min((size.height - 64 - 176 - 44) / PHh, (size.width * 0.95) / PW)
      : portrait
        ? Math.min((size.height * 0.68) / PHh, (size.width * 0.94) / PW)
        : Math.min((size.height * 0.84) / PHh, (size.width * 0.56) / PW);
    const tx = portrait ? size.width * 0.5 : size.width * 0.64;
    const ty = fitInteractive ? 64 + 44 + (PHh * s) / 2 : portrait ? size.height * 0.615 : size.height * 0.5;
    const first = ph === "pos";
    const ie = first ? 1 - Math.pow(1 - Math.min(1, t / 0.6), 3) : 1;
    const sw = Math.min(1, t / 0.35);
    el.style.transform = `translate(${tx}px,${ty + (1 - ie) * 120}px) translate(-50%,-50%) scale(${s * (0.92 + 0.08 * ie) * (0.985 + 0.015 * sw)})`;
    el.style.opacity = String(Math.min(1, ie * 1.3));
    const F = f.current;
    for (const k of ["pos", "stock", "order", "close"]) show(F[k], k === ph || (k === "pos" && ph === "fact"), "block");
    show(F.inv, ph === "cliente" || ph === "items" || ph === "dian" || ph === "files", "block");
    show(F.isteps, INV.includes(ph), "flex");
    const ii = INV.indexOf(ph);
    for (let i = 0; i < 5; i++) F[`is${i}`]!.className = i < ii ? "done" : i === ii ? "on" : "";
    F.mod!.textContent = PH[ph];
    if (F.chip) {
      show(F.chip, !ad, "block");
      F.chip.textContent = CHIP[ph];
    }
    if (ph === "pos") {
      // la pistola ya leyó la bebida en el mostrador: el código entra al buscador y el renglón aparece en la cuenta
      const scan = typed(SALE_ITEM.barcode, t, 0.2, 0.9);
      F.q!.textContent = scan || "Nombre, código o pistola…";
      F.q!.classList.toggle("gm-ph-holder", !scan);
      F.q!.parentElement!.classList.toggle("gm-focus", t < 1.1);
      show(F.l0, t > 1.0, "grid");
      show(F.empty, t <= 1.0, "block");
      F.card0!.classList.toggle("gm-tap2", t > 0.9 && t < 1.4);
      F.tot!.textContent = t > 1.0 ? cop(SALE_ITEM.price) : "$0";
      F.cobrar!.textContent = t > 1.0 ? `Cobrar ${cop(SALE_ITEM.price)}` : "Cobrar";
      F.cobrar!.classList.toggle("gm-press", t > 2.2 && t < 2.6);
      show(F.cart, t <= 2.8, "block");
      show(F.cobro, t > 2.8 && t < 7.2, "block");
      show(F.done, t >= 7.2, "block");
      F.mEf!.classList.toggle("on", t > 3.6);
      show(F.ef, t > 3.6, "block");
      const rec = typed("10000", t, 4.4, 5.2);
      F.rec!.textContent = rec ? `$${Number(rec).toLocaleString("es-CO")}` : " ";
      F.recLine!.textContent = rec.length === 5 ? `A cobrar ${cop(SALE_ITEM.price)} · recibido $10.000 · cambio ${cop(10000 - SALE_ITEM.price)}` : `A cobrar ${cop(SALE_ITEM.price)}`;
      F.pay!.classList.toggle("gm-press", t > 6.6 && t < 7.0);
      show(F.preg, false);
      show(F.printed, false);
      show(F.receipt, false);
    }
    if (ph === "fact") {
      show(F.cart, false);
      show(F.cobro, false);
      show(F.done, true, "block");
      F.si!.classList.toggle("gm-press", t > 2.0 && t < 2.4);
      show(F.preg, t < 2.4, "block");
      show(F.printed, t >= 2.4, "block");
      show(F.receipt, t >= 2.4, "block");
      if (F.receipt) F.receipt.style.opacity = String(Math.min(1, Math.max(0, (t - 2.4) / 0.5)));
    }
    if (ph === "cliente") {
      show(F.vCli, true, "block");
      show(F.vItems, false);
      show(F.vSend, false);
      show(F.vFiles, false);
      F.tk!.classList.toggle("on", t > 0.8);
      F.dTipo!.textContent = t > 1.2 ? "Cédula de ciudadanía" : " ";
      F.dDoc!.textContent = typed(P.doc, t, 1.6, 2.4) || " ";
      F.dNom!.textContent = typed(P.nombre, t, 2.6, 3.6) || " ";
      F.dMail!.textContent = typed(P.email, t, 3.8, 4.8) || " ";
      F.dPer!.textContent = t > 5.2 ? "Natural" : " ";
      F.dForma!.textContent = t > 6.0 ? "Contado" : " ";
      F.dMedio!.textContent = t > 6.4 ? "Efectivo" : " ";
      const foc = t < 2.5 ? "dDoc" : t < 3.7 ? "dNom" : t < 4.9 ? "dMail" : t < 5.5 ? "dPer" : "dMedio";
      for (const k of ["dDoc", "dNom", "dMail", "dPer", "dMedio"]) F[k]!.parentElement!.classList.toggle("gm-focus", k === foc && t > 1.4 && t < 6.9);
    }
    if (ph === "items") {
      show(F.vCli, false);
      show(F.vItems, true, "block");
      show(F.vSend, false);
      show(F.vFiles, false);
      F.it0!.style.opacity = String(Math.min(1, Math.max(0, (t - 0.4) / 0.4)));
      F.iva!.parentElement!.classList.toggle("gm-focus", t > 1.4 && t < 2.6);
      F.iva!.classList.toggle("gm-tap2", t > 1.8 && t < 2.2);
      show(F.sum, t > 2.6, "block");
    }
    if (ph === "dian") {
      show(F.vCli, false);
      show(F.vItems, false);
      show(F.vSend, true, "block");
      show(F.vFiles, false);
      F.send!.classList.toggle("gm-press", t > 1.0 && t < 1.35);
      F.send!.textContent = t > 1.35 && t < 3.0 ? "Enviando…" : "Enviar factura a la DIAN";
      show(F.dOk, t >= 3.0, "block");
      show(F.dCufe, t >= 4.2, "block");
      F.tkState!.textContent = t >= 4.2 ? "SETP990000142" : "Sin CUFE";
      F.tkState!.classList.toggle("ok", t >= 4.2);
    }
    if (ph === "files") {
      show(F.vCli, false);
      show(F.vItems, false);
      show(F.vSend, false);
      show(F.vFiles, true, "block");
      F.xml!.classList.toggle("gm-press", t > 0.8 && t < 1.1);
      F.pdf!.classList.toggle("gm-press", t > 1.5 && t < 1.8);
      show(F.pdfDoc, t >= 1.8, "block");
    }
    if (ph === "stock") {
      for (let i = 0; i < 4; i++) {
        const r = F[`s${i}`];
        if (r) r.style.opacity = String(Math.min(1, Math.max(0, (t - 0.3 - i * 0.3) / 0.3)));
      }
      show(F.banner, t > 2.8, "flex");
      F.bajar!.classList.toggle("gm-press", t > 4.6 && t < 4.95);
      const bajo = t >= 4.95;
      show(F.bOk, bajo, "block");
      F.g2!.textContent = bajo ? "20" : "18";
      F.g3!.textContent = bajo ? "3" : "2";
      F.b2!.textContent = bajo ? "28" : "30";
      F.b3!.textContent = bajo ? "3" : "4";
      F.g2!.classList.toggle("warn", !bajo);
      F.g3!.classList.toggle("warn", !bajo);
    }
    if (ph === "order") {
      F.prov!.textContent = t > 0.9 ? "Distribuidora Andina (demo)" : "Elige proveedor";
      F.prov!.parentElement!.classList.toggle("gm-focus", t > 0.4 && t < 1.4);
      show(F.o0, t > 1.6, "grid");
      show(F.o1, t > 2.3, "grid");
      F.crear!.classList.toggle("gm-press", t > 3.4 && t < 3.75);
      show(F.oOk, t >= 3.75, "block");
      show(F.oRow, t >= 3.75, "flex");
      F.recibir!.classList.toggle("gm-press", t > 6.0 && t < 6.35);
      show(F.oRec, t >= 6.35, "block");
      F.oState!.textContent = t >= 6.35 ? "Recibido" : "Pendiente";
      F.oState!.classList.toggle("ok", t >= 6.35);
      show(F.recibir, t < 6.35);
    }
    if (ph === "close") {
      F.cont!.textContent = typed("551400", t, 1.6, 2.6) ? `$${Number(typed("551400", t, 1.6, 2.6)).toLocaleString("es-CO")}` : " ";
      F.cont!.parentElement!.classList.toggle("gm-focus", t > 1.3 && t < 2.9);
      show(F.diff, t > 2.8, "flex");
      F.cerrar!.classList.toggle("gm-press", t > 4.3 && t < 4.65);
      show(F.cOk, t >= 4.65, "block");
    }
  });
  return (
    <Html calculatePosition={fixedPos} zIndexRange={[68, 58]} style={{ pointerEvents: "none" }}>
      <div ref={root} className="gm-3dpanel gm-coach gm-caja" style={{ display: "none", position: "absolute", left: 0, top: 0, transformOrigin: "50% 50%" }}>
        <div ref={reg("chip")} className="gm-phone-chip" style={{ display: "none" }} />
        <div className="gm-3dpanel-top">
          <img src="/brand/vx-icon-color.svg" alt="" className="h-6 w-6" />
          <span ref={reg("mod")} className="font-bold text-white">Punto de venta</span>
          <span className="text-gym-muted">· VISIONYX Norte</span>
          <span className="ml-auto rounded-full border border-gym-border px-2 py-0.5 text-[10px] text-gym-muted">Caja</span>
        </div>
        {/* Punto de venta (app/caja) */}
        <div ref={reg("pos")} className="gm-co">
          <div ref={reg("cart")}>
            <div className="gm-co-field"><label>Buscar</label><div ref={reg("q")}>Nombre, código o pistola…</div></div>
            <div className="gm-cj-cards">
              {[["Bebida isotónica 600 ml", "$5.500", "24"], ["Barra de proteína", "$8.900", "24"], ["Agua 600 ml", "$3.000", "30"], ["Bebida energética", "$7.000", "12"]].map(([n, p, q], i) => (
                <div key={n} ref={i === 0 ? reg("card0") : undefined} className="gm-cj-card"><b>{n}</b><span>{p}</span><em>Gimnasio {q}</em></div>
              ))}
            </div>
            <div className="gm-co-sec" style={{ marginTop: 10 }}>Cuenta</div>
            <div ref={reg("empty")} className="gm-co-tip" style={{ marginTop: 0 }}>Toque una tarjeta o pase la pistola.</div>
            <div ref={reg("l0")} className="gm-cj-line" style={{ display: "none" }}><span>{SALE_ITEM.name}<br /><small style={{ opacity: 0.7 }}>{SALE_ITEM.barcode}</small></span><em>1 × {cop(SALE_ITEM.price)}</em><b>{cop(SALE_ITEM.price)}</b></div>
            <div className="gm-cj-total"><span>Total</span><b ref={reg("tot")}>$0</b></div>
            <div className="gm-co-row" style={{ justifyContent: "space-between" }}><span className="gm-co-btn">Dejar en espera (F8)</span><span ref={reg("cobrar")} className="gm-co-btn pri">Cobrar</span></div>
          </div>
          <div ref={reg("cobro")} style={{ display: "none" }}>
            <div className="gm-cj-line"><span>{SALE_ITEM.name}</span><em>1 × {cop(SALE_ITEM.price)}</em><b>{cop(SALE_ITEM.price)}</b></div>
            <div className="gm-cj-total"><span>Total</span><b>{cop(SALE_ITEM.price)}</b></div>
            <div className="gm-cj-modes"><span ref={reg("mEf")}>Efectivo</span><span>Transferencia</span><span>Tarjeta</span><span>Mixto</span></div>
            <div ref={reg("ef")} style={{ display: "none" }}>
              <div className="gm-co-field" style={{ marginTop: 10 }}><label>Recibido</label><div ref={reg("rec")}> </div></div>
              <div ref={reg("recLine")} className="gm-co-tip">A cobrar {cop(SALE_ITEM.price)}</div>
              <div className="gm-co-row"><span className="gm-co-btn">Exacto</span><span className="gm-co-btn">Borrar</span><span ref={reg("pay")} className="gm-co-btn pri" style={{ marginLeft: "auto" }}>Cobrar {cop(SALE_ITEM.price)}</span></div>
            </div>
          </div>
          <div ref={reg("done")} style={{ display: "none" }}>
            <div className="gm-co-msg ok"><b>Venta cobrada</b> · Ticket 142 · Efectivo {cop(SALE_ITEM.price)}</div>
            <div className="gm-cj-change"><span>Cambio a devolver</span><b>{cop(10000 - SALE_ITEM.price)}</b></div>
            <div ref={reg("preg")} style={{ display: "none" }}>
              <p className="gm-cj-q">¿El cliente desea factura?</p>
              <div ref={reg("si")} className="gm-co-btn pri" style={{ textAlign: "center", padding: 12 }}>Sí, imprimir</div>
              <div className="gm-co-btn" style={{ textAlign: "center", marginTop: 8 }}>No, sin factura</div>
            </div>
            <div ref={reg("receipt")} className="gm-cj-receipt" style={{ display: "none" }}>
              <h4>VISIONYX</h4>
              <div className="c">Norte</div>
              <div className="m">VENTA 142</div>
              <div className="c">12/11/2026, 6:05 p. m.</div>
              <div style={{ borderTop: "1px solid #ddd", marginTop: 4, paddingTop: 4 }}><b>{SALE_ITEM.name}</b><div className="r"><span>1 × {cop(SALE_ITEM.price)}</span><span>{cop(SALE_ITEM.price)}</span></div></div>
              <div className="t"><span>Total a pagar</span><b>{cop(SALE_ITEM.price)}</b></div>
              <div className="r" style={{ marginTop: 4 }}><span>efectivo</span><span>$10.000</span></div>
              <div style={{ fontWeight: 700, marginTop: 2 }}>Cambio {cop(10000 - SALE_ITEM.price)}</div>
            </div>
            <div ref={reg("printed")} className="gm-co-tip" style={{ display: "none" }}>Ticket impreso. La factura electrónica de esta venta se emite en Facturación DIAN · 07.</div>
          </div>
        </div>
        {/* Facturación DIAN · 07 Factura electrónica y 08 Archivos del motor */}
        <div ref={reg("isteps")} className="gm-cj-steps" style={{ display: "none" }}>
          {[0, 1, 2, 3, 4].map((i) => <i key={i} ref={reg(`is${i}`)} />)}
        </div>
        <div ref={reg("inv")} className="gm-co" style={{ display: "none" }}>
          <div className="gm-co-row" style={{ marginTop: 0, justifyContent: "space-between" }}>
            <div><div className="gm-co-sec" style={{ margin: 0 }}>07 · Factura electrónica</div><b className="text-white">VISIONYX Norte</b></div>
            <span className="gm-co-state">Ambiente: Habilitación</span>
          </div>
          <div ref={reg("tk")} className="gm-co-li" style={{ marginTop: 8 }}><b>Ticket 142 · {cop(SALE_ITEM.price)} · Efectivo</b><span ref={reg("tkState")}>Sin CUFE</span></div>
          <div ref={reg("vCli")}>
            <div className="gm-co-mgrid gm-cj-cli" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginTop: 8 }}>
              <div className="gm-co-field"><label>Tipo de documento</label><div ref={reg("dTipo")}> </div></div>
              <div className="gm-co-field" style={{ gridColumn: "span 2" }}><label>Número de documento</label><div ref={reg("dDoc")}> </div></div>
              <div className="gm-co-field" style={{ gridColumn: "1 / -1" }}><label>Nombre o razón social</label><div ref={reg("dNom")}> </div></div>
              <div className="gm-co-field" style={{ gridColumn: "1 / -1" }}><label>Correo del cliente</label><div ref={reg("dMail")}> </div></div>
              <div className="gm-co-field"><label>Tipo de persona</label><div ref={reg("dPer")}> </div></div>
              <div className="gm-co-field"><label>Forma de pago</label><div ref={reg("dForma")}> </div></div>
              <div className="gm-co-field"><label>Medio de pago</label><div ref={reg("dMedio")}> </div></div>
            </div>
          </div>
          <div ref={reg("vItems")} style={{ display: "none" }}>
            <div className="gm-co-tip" style={{ marginBottom: 4 }}>Elige un ticket de hoy o escribe el concepto. La venta queda en caja aunque la DIAN la rechace. El CUFE se anota solo si la acepta.</div>
            <div className="gm-co-tip">Los ítems salen del ticket de caja. El IVA se elige en la factura.</div>
            <div className="gm-cj-th" style={{ gridTemplateColumns: "1fr 44px 84px 60px" }}><span>Descripción</span><span>Cant.</span><span>Precio unitario</span><span>IVA</span></div>
            <div ref={reg("it0")} className="gm-cj-tr" style={{ gridTemplateColumns: "1fr 44px 84px 60px" }}><span>{SALE_ITEM.name}</span><b>1</b><b>{cop(SALE_ITEM.price)}</b><b>0 %</b></div>
            <div className="gm-co-field" style={{ marginTop: 8 }}><label>IVA</label><div className="gm-cj-sel"><span ref={reg("iva")} className="on">0 %</span><span>5 %</span><span>19 %</span></div></div>
            <div ref={reg("sum")} style={{ display: "none", marginTop: 6 }}>
              {[["Subtotal", cop(SALE_ITEM.price)], ["IVA 0 %", "$0"], ["Total", cop(SALE_ITEM.price)]].map(([a, b]) => (
                <div key={a} className="gm-cj-kv"><span>{a}</span><b>{b}</b></div>
              ))}
            </div>
          </div>
          <div ref={reg("vSend")} style={{ display: "none" }}>
            <div className="gm-co-tip">{P.nombre} · CC {P.doc} · {P.email}<br />{SALE_ITEM.name} · 1 × {cop(SALE_ITEM.price)} · IVA 0 % · Total {cop(SALE_ITEM.price)} · Contado, efectivo</div>
            <div className="gm-co-row" style={{ justifyContent: "flex-end" }}><span ref={reg("send")} className="gm-co-btn pri">Enviar factura a la DIAN</span></div>
            <div ref={reg("dOk")} className="gm-co-msg ok" style={{ display: "none" }}>Factura SETP990000142 aceptada.<br /><span style={{ fontSize: 11, opacity: 0.85 }}>CUFE {CUFE}</span></div>
            <div ref={reg("dCufe")} className="gm-co-tip" style={{ display: "none" }}>El CUFE quedó anotado en el ticket 142 de la caja.</div>
          </div>
          <div ref={reg("vFiles")} style={{ display: "none" }}>
            <div className="gm-co-sec">08 · Archivos del motor</div>
            <div className="gm-co-tip" style={{ marginTop: 0 }}>XML firmado y PDF del documento que el motor guardó para este NIT.</div>
            <div className="gm-co-row"><span ref={reg("xml")} className="gm-co-btn">Descargar XML</span><span ref={reg("pdf")} className="gm-co-btn">Descargar PDF</span></div>
            <div ref={reg("pdfDoc")} className="gm-cj-pdf" style={{ display: "none" }}>
              <b>Factura electrónica de venta SETP990000142</b><br />
              VISIONYX Norte · ambiente de habilitación (demo)<br />
              Cliente: {P.nombre} · CC {P.doc}<br />
              Correo: {P.email}<br />
              {SALE_ITEM.name} · 1 × {cop(SALE_ITEM.price)} · IVA 0 %<br />
              <b>Total {cop(SALE_ITEM.price)}</b> · Contado · Efectivo<br />
              <span style={{ fontSize: 10, color: "#555" }}>CUFE {CUFE}</span>
            </div>
          </div>
        </div>
        {/* Inventario + Catálogo (bajar de bodega) */}
        <div ref={reg("stock")} className="gm-co">
          <div className="gm-co-tip" style={{ marginTop: 0 }}>Conteo de lo que está en el gimnasio y en bodega. Guardar un renglón reemplaza esas cantidades.</div>
          <div className="gm-cj-th"><span>Producto</span><span>Gimnasio</span><span>Bodega</span><span>Mínimo</span></div>
          {[["Bebida isotónica 600 ml", "23", "24", "12"], ["Barra de proteína", "24", "16", "10"], ["Agua 600 ml", "g2", "b2", "20"], ["Whey protein 2 lb", "g3", "b3", "3"]].map(([n, g, b, m], i) => (
            <div key={n} ref={reg(`s${i}`)} className="gm-cj-tr">
              <span>{n}</span>
              {g.startsWith("g") ? <b ref={reg(g)}>{g}</b> : <b>{g}</b>}
              {b.startsWith("b") ? <b ref={reg(b)}>{b}</b> : <b>{b}</b>}
              <b>{m}</b>
            </div>
          ))}
          <div ref={reg("banner")} className="gm-cj-banner" style={{ display: "none" }}>
            <span>Hay 2 pedidos por bajar de la bodega al gimnasio</span>
            <b ref={reg("bajar")} className="gm-co-btn">Bajar todo</b>
          </div>
          <div ref={reg("bOk")} className="gm-co-msg ok" style={{ display: "none" }}>Se bajaron 2 productos de la bodega al gimnasio.</div>
        </div>
        {/* Pedidos */}
        <div ref={reg("order")} className="gm-co">
          <div className="gm-co-tip" style={{ marginTop: 0 }}>Compra al proveedor. Al recibirlo, las unidades entran a bodega. De ahí se bajan al gimnasio desde el catálogo.</div>
          <div className="gm-co-field" style={{ marginTop: 8 }}><label>Proveedor</label><div ref={reg("prov")}>Elige proveedor</div></div>
          <div className="gm-cj-th" style={{ gridTemplateColumns: "1fr 60px 90px" }}><span>Producto</span><span>Cant.</span><span>Costo</span></div>
          <div ref={reg("o0")} className="gm-cj-tr" style={{ display: "none", gridTemplateColumns: "1fr 60px 90px" }}><span>Whey protein 2 lb</span><b>6</b><b>$120.000</b></div>
          <div ref={reg("o1")} className="gm-cj-tr" style={{ display: "none", gridTemplateColumns: "1fr 60px 90px" }}><span>Agua 600 ml</span><b>48</b><b>$900</b></div>
          <div className="gm-co-row" style={{ justifyContent: "flex-end" }}><span ref={reg("crear")} className="gm-co-btn pri">Crear pedido</span></div>
          <div ref={reg("oOk")} className="gm-co-msg ok" style={{ display: "none" }}>Pedido #18 creado. Recibirlo suma las unidades a bodega.</div>
          <div ref={reg("oRow")} className="gm-co-li" style={{ display: "none", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <div><b>Pedido #18 · Distribuidora Andina (demo)</b><br /><span ref={reg("oState")}>Pendiente</span></div>
            <span ref={reg("recibir")} className="gm-co-btn pri">Recibir en bodega</span>
          </div>
          <div ref={reg("oRec")} className="gm-co-msg ok" style={{ display: "none" }}>Entrada a bodega registrada.</div>
        </div>
        {/* Cierre de caja */}
        <div ref={reg("close")} className="gm-co">
          <div className="gm-co-sec">Antes de cerrar</div>
          <div className="gm-co-tip" style={{ marginTop: 0 }}>El efectivo esperado es el fondo, más el efectivo del turno, menos los gastos de ese turno. Tarjeta, transferencia y Wompi no entran al cajón.</div>
          {[["Fondo", "$200.000"], ["Efectivo del turno", "$386.400"], ["Gastos del turno", "−$35.000"], ["Se espera en la caja", "$551.400"]].map(([a, b]) => (
            <div key={a} className="gm-cj-kv"><span>{a}</span><b>{b}</b></div>
          ))}
          <div className="gm-co-field" style={{ marginTop: 8 }}><label>Efectivo contado</label><div ref={reg("cont")}> </div></div>
          <div ref={reg("diff")} className="gm-cj-kv ok" style={{ display: "none" }}><span>Diferencia</span><b>$0</b></div>
          <div className="gm-co-row" style={{ justifyContent: "flex-end" }}><span ref={reg("cerrar")} className="gm-co-btn pri">Cerrar caja</span></div>
          <div ref={reg("cOk")} className="gm-co-msg ok" style={{ display: "none" }}>Caja cerrada.</div>
        </div>
      </div>
    </Html>
  );
}
