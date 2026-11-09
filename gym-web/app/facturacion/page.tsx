"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

const inputCls = "w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2.5 text-sm text-white outline-none focus:border-gym-primary";
const PESOS_DV = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
const RESPONSABILIDADES = [
  ["O-13", "Gran contribuyente"],
  ["O-15", "Autorretenedor"],
  ["O-23", "Agente de retención de IVA"],
  ["O-47", "Régimen simple"],
  ["R-99-PN", "Sin responsabilidad especial"],
] as const;
const TABS = [
  ["sede", "Sede"],
  ["empresa", "Empresa"],
  ["certificado", "Certificado"],
  ["software", "Software"],
  ["resolucion", "Resolución"],
  ["ambiente", "Ambiente"],
  ["emitir", "Emitir"],
  ["documentos", "Documentos"],
] as const;

type Tab = (typeof TABS)[number][0];
type Tone = "ok" | "err" | "info";
type SaleRow = {
  id: string;
  number: number;
  total: number;
  items: { name: string; qty: number; price: number; sku?: string }[];
  dian?: { cufe?: string; consecutivo?: string } | null;
};

const emptyEmpresa = {
  nit: "", dv: "", razon_social: "", nombre_comercial: "", email: "", telefono: "", regimen: "48",
  responsabilidades: "O-13",
  direccion: { address: "", city: "", city_code: "", department: "", department_code: "", country: "CO" },
};

function dvDe(nit: string) {
  const digits = nit.replace(/\D/g, "").split("").reverse();
  if (!digits.length) return "";
  const sum = digits.reduce((acc, digit, i) => acc + Number(digit) * (PESOS_DV[i] || 0), 0);
  const rest = sum % 11;
  return String(rest > 1 ? 11 - rest : rest);
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gym-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-gym-muted">{hint}</span> : null}
    </label>
  );
}

function Block({ kicker, title, text, children }: { kicker: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <section className="glass overflow-hidden">
      <header className="border-b border-gym-border/70 px-5 py-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gym-primary">{kicker}</div>
        <h3 className="mt-1 text-base font-extrabold text-white">{title}</h3>
        <p className="mt-1 text-sm text-gym-muted">{text}</p>
      </header>
      <div className="grid gap-4 p-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function FacturacionPage() {
  const [tab, setTab] = useState<Tab>("sede");
  const [gymId, setGymId] = useState("fuerza-elite");
  const [gymName, setGymName] = useState("Esta sede");
  const [enabled, setEnabled] = useState(false);
  const [nit, setNit] = useState("");
  const [msg, setMsg] = useState("");
  const [tone, setTone] = useState<Tone>("info");
  const [busy, setBusy] = useState("");
  const [motorOn, setMotorOn] = useState(false);
  const [certReady, setCertReady] = useState(false);
  const [certDetail, setCertDetail] = useState("Sin certificado");
  const [stats, setStats] = useState<{ proximo?: number; disponibles?: number; dias?: number }>({});
  const [empresa, setEmpresa] = useState(emptyEmpresa);
  const [representante, setRepresentante] = useState({ nombres: "", apellidos: "", cedula: "" });
  const [software, setSoftware] = useState({ software_id: "", software_name: "", pin: "", clave_tecnica: "", test_set_id: "" });
  const [resolucion, setResolucion] = useState({ numero_resolucion: "", prefijo: "", rango_desde: "", rango_hasta: "", fecha_desde: "", fecha_hasta: "" });
  const [soporte, setSoporte] = useState({ numero_resolucion: "", prefijo: "", rango_desde: "", rango_hasta: "", fecha_desde: "", fecha_hasta: "", test_set_id: "" });
  const [ambiente, setAmbiente] = useState("habilitacion");
  const [pfx, setPfx] = useState<File | null>(null);
  const [cer, setCer] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [cliente, setCliente] = useState({ tipo_documento: "DNI", numero_documento: "", dv: "", nombre_completo: "", email: "", tipo_persona: "2" });
  const [item, setItem] = useState({ description: "", quantity: "1", price: "", tax_percent: "0", sku: "ITEM" });
  const [pago, setPago] = useState({ forma: "1", medio: "10" });
  const [saleId, setSaleId] = useState("");
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [docName, setDocName] = useState("");
  const [ajuste, setAjuste] = useState({ id: "", cuds: "", fecha_emision: "", valor_total: "", motivo: "Anulación del documento", response_code: "2" });
  const [last, setLast] = useState("");

  const call = useCallback(async (id: string, path: string, init?: RequestInit) => {
    const res = await fetch(`/api/facturacion/dian/${path}?gym=${encodeURIComponent(id)}`, { cache: "no-store", ...init });
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : { raw: await res.text() };
    return { res, data };
  }, []);

  const note = useCallback((text: string, next: Tone = "info", detail = "") => {
    setMsg(text);
    setTone(next);
    setLast(detail || text);
  }, []);

  const load = useCallback(async (id: string) => {
    const [sedeRes, gymsRes] = await Promise.all([
      fetch(`/api/facturacion/sede?gym=${encodeURIComponent(id)}`, { cache: "no-store" }),
      fetch("/api/gyms", { cache: "no-store" }),
    ]);
    const sedeData = await sedeRes.json();
    const gymsData = await gymsRes.json().catch(() => ({}));
    const found = (gymsData.gyms || gymsData.items || []).find((g: { id?: string; name?: string }) => g.id === id);
    if (found?.name) setGymName(found.name);
    const sede = sedeData.sede || { enabled: false, nit: "" };
    setEnabled(Boolean(sede.enabled));
    setNit(sede.nit || "");
    try {
      const health = await call(id, "health");
      setMotorOn(health.res.ok);
    } catch {
      setMotorOn(false);
    }
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const salesRes = await fetch(`/api/retail/sales?gym=${encodeURIComponent(id)}&historial=1&from=${hoy}&to=${hoy}&estado=pagada`, { cache: "no-store" });
    const salesData = await salesRes.json();
    setSales(salesData.items || []);
    if (!sede.nit) {
      setCertReady(false);
      setCertDetail("Escribe el NIT para revisar el certificado.");
      return;
    }
    try {
      const status = await call(id, "certificate/status");
      const info = status.data?.certificates || {};
      const ready = Boolean(info.pfx_exists && info.key_exists && info.crt_exists);
      setCertReady(ready);
      setCertDetail(ready ? "PFX, certificado y llave de esta sede están guardados." : "Faltan el PFX, el CER o la llave de esta sede.");
      const cfg = await call(id, "config");
      if (cfg.data && !cfg.data.empty && cfg.data.empresa) {
        const e = cfg.data.empresa;
        setEmpresa({
          ...emptyEmpresa,
          ...e,
          responsabilidades: Array.isArray(e.responsabilidades) ? e.responsabilidades.join(",") : String(e.responsabilidades || "O-13"),
          direccion: { ...emptyEmpresa.direccion, ...(e.direccion || {}) },
        });
        setRepresentante({ nombres: "", apellidos: "", cedula: "", ...(cfg.data.representante || {}) });
        setSoftware({ software_id: "", software_name: "", pin: "", clave_tecnica: "", test_set_id: "", ...(cfg.data.software || {}) });
        setResolucion({
          numero_resolucion: cfg.data.resolucion?.numero_resolucion || "",
          prefijo: cfg.data.resolucion?.prefijo || "",
          rango_desde: String(cfg.data.resolucion?.rango_desde ?? ""),
          rango_hasta: String(cfg.data.resolucion?.rango_hasta ?? ""),
          fecha_desde: String(cfg.data.resolucion?.fecha_desde || "").slice(0, 10),
          fecha_hasta: String(cfg.data.resolucion?.fecha_hasta || "").slice(0, 10),
        });
        setSoporte({
          numero_resolucion: cfg.data.resolucion_soporte?.numero_resolucion || "",
          prefijo: cfg.data.resolucion_soporte?.prefijo || "",
          rango_desde: String(cfg.data.resolucion_soporte?.rango_desde ?? ""),
          rango_hasta: String(cfg.data.resolucion_soporte?.rango_hasta ?? ""),
          fecha_desde: String(cfg.data.resolucion_soporte?.fecha_desde || "").slice(0, 10),
          fecha_hasta: String(cfg.data.resolucion_soporte?.fecha_hasta || "").slice(0, 10),
          test_set_id: cfg.data.resolucion_soporte?.test_set_id || "",
        });
        const amb = String(cfg.data.ambiente?.ambiente || "HABILITACION").toLowerCase();
        setAmbiente(amb === "produccion" ? "produccion" : "habilitacion");
      }
    } catch {
      setCertDetail("El motor no pudo leer el certificado.");
    }
    try {
      const est = await call(id, "config/estadisticas");
      const c = est.data?.consecutivos || {};
      if (est.res.ok) {
        setStats({
          proximo: Number(c.proximo || 0) || undefined,
          disponibles: Number(c.facturas_disponibles || 0) || undefined,
          dias: Number(est.data?.resolucion?.dias_vigencia_restantes),
        });
      }
    } catch {
      /* la numeración aparece cuando ya hay resolución guardada */
    }
  }, [call]);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    const venta = new URLSearchParams(window.location.search).get("venta") || "";
    if (venta) {
      setSaleId(venta);
      setTab("emitir");
    }
    load(id);
  }, [load]);

  function tell(data: { detail?: unknown; error?: unknown; message?: unknown; success?: boolean; exito?: boolean; mensaje?: unknown; errors?: string[] }) {
    if (typeof data.detail === "string") return data.detail;
    if (data.error) return String(data.error);
    if (data.errors?.length) return data.errors.join(" ");
    if (data.mensaje) return String(data.mensaje);
    if (data.message) return String(data.message);
    if (data.success || data.exito) return "Listo.";
    return JSON.stringify(data).slice(0, 700);
  }

  const respList = empresa.responsabilidades.split(",").map((x) => x.trim()).filter(Boolean);
  const checks = useMemo(() => [
    [Boolean(nit), "NIT de la sede"],
    [Boolean(empresa.razon_social && empresa.email && empresa.direccion.address), "Empresa y dirección"],
    [Boolean(software.software_id && software.pin && software.clave_tecnica), "Software DIAN"],
    [Boolean(resolucion.numero_resolucion && resolucion.prefijo && resolucion.fecha_desde), "Resolución de factura"],
    [certReady, "Certificado digital"],
    [enabled, "Envío activo"],
  ] as const, [nit, empresa, software, resolucion, certReady, enabled]);
  const listos = checks.filter(([ok]) => ok).length;

  function configBody() {
    return {
      empresa: {
        ...empresa,
        nit,
        dv: empresa.dv || dvDe(nit),
        responsabilidades: respList,
      },
      representante,
      software,
      resolucion: {
        ...resolucion,
        rango_desde: Number(resolucion.rango_desde || 0),
        rango_hasta: Number(resolucion.rango_hasta || 0),
      },
      resolucion_soporte: soporte.prefijo ? {
        ...soporte,
        rango_desde: Number(soporte.rango_desde || 0),
        rango_hasta: Number(soporte.rango_hasta || 0),
      } : undefined,
      ambiente: { ambiente },
      certificado: password ? { ruta_certificado: `certificados/${nit}/certificado_digital.pfx`, password } : undefined,
    };
  }

  async function saveSede(nextEnabled = enabled, nextNit = nit) {
    const res = await fetch("/api/facturacion/sede", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, enabled: nextEnabled, nit: nextNit }),
    });
    const data = await res.json();
    if (data.sede) {
      setEnabled(data.sede.enabled);
      setNit(data.sede.nit);
    }
    return Boolean(data.ok);
  }

  async function saveConfig() {
    if (!nit) {
      note("Escribe el NIT antes de guardar.", "err");
      setTab("sede");
      return;
    }
    setBusy("config");
    try {
      await saveSede(enabled, nit);
      const { data, res } = await call(gymId, "config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configBody()),
      });
      note(tell(data), res.ok && data.success !== false ? "ok" : "err", JSON.stringify(data, null, 2));
      await load(gymId);
    } finally {
      setBusy("");
    }
  }

  async function uploadCert(e: React.FormEvent) {
    e.preventDefault();
    if (!nit) {
      note("Primero guarda el NIT de la sede.", "err");
      setTab("sede");
      return;
    }
    if (!pfx || !cer || !keyFile || !password) {
      note("Sube el PFX, el CER, la llave y la contraseña del certificado de esta sede.", "err");
      return;
    }
    setBusy("cert");
    try {
      await saveSede(enabled, nit);
      const body = new FormData();
      body.set("archivo_pfx", pfx);
      body.set("archivo_cer", cer);
      body.set("archivo_key", keyFile);
      body.set("password", password);
      const { data } = await call(gymId, "config/certificado-validar-certicamara", { method: "POST", body });
      if (data.session_id && data.pfx_ruta_temp) {
        const done = await call(gymId, "config/certificado-autoconfigurar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: data.session_id, pfx_ruta: data.pfx_ruta_temp, pfx_password: password, company_nit: nit }),
        });
        const info = data.info_certificado || {};
        note(tell(done.data), done.data.success ? "ok" : "err", `Sujeto: ${info.subject || "—"}\nVigente hasta: ${info.valido_hasta || "—"}\n${tell(done.data)}`);
      } else note(tell(data), "err", JSON.stringify(data, null, 2));
      await load(gymId);
    } finally {
      setBusy("");
    }
  }

  async function testConexion() {
    setBusy("test");
    try {
      const { data, res } = await call(gymId, "config/test-conexion", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      note(tell(data), res.ok && data.exito !== false ? "ok" : "err", JSON.stringify(data, null, 2));
    } finally {
      setBusy("");
    }
  }

  function invoiceBody(lines: { description: string; quantity: number; price: number; sku?: string; tax_percent: number }[]) {
    return {
      empresa: { ...empresa, nit, dv: empresa.dv || dvDe(nit), responsabilidades: respList },
      cliente: { ...cliente, email: cliente.email },
      items: lines,
      configuracion_dian: {
        software_id: software.software_id,
        software_pin: software.pin,
        clave_tecnica: software.clave_tecnica,
        resolucion_numero: resolucion.numero_resolucion,
        resolucion_prefijo: resolucion.prefijo,
        resolucion_desde: Number(resolucion.rango_desde || 0),
        resolucion_hasta: Number(resolucion.rango_hasta || 0),
        resolucion_fecha_desde: resolucion.fecha_desde,
        resolucion_fecha_hasta: resolucion.fecha_hasta,
        ambiente,
      },
      forma_pago: pago.forma,
      medio_pago: pago.medio,
    };
  }

  async function sendInvoice(e: React.FormEvent) {
    e.preventDefault();
    const sale = sales.find((s) => s.id === saleId);
    if (!cliente.numero_documento || !cliente.nombre_completo || !cliente.email) {
      note("La factura necesita documento, nombre y correo del cliente.", "err");
      return;
    }
    const lines = sale
      ? sale.items.map((it) => ({ description: it.name, quantity: it.qty, price: it.price, sku: it.sku || "ITEM", tax_percent: Number(item.tax_percent || 0) }))
      : [{ description: item.description, quantity: Number(item.quantity || 1), price: Number(item.price || 0), sku: item.sku || "ITEM", tax_percent: Number(item.tax_percent || 0) }];
    if (!lines[0]?.description || !lines[0]?.price) {
      note("Escribe la descripción y el precio, o elige un ticket de caja.", "err");
      return;
    }
    setBusy("factura");
    try {
      const { data } = await call(gymId, "invoice/generate-and-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceBody(lines)),
      });
      if (data.success && saleId && data.cufe) {
        await fetch("/api/facturacion/venta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gym: gymId, saleId, cufe: data.cufe, consecutivo: data.consecutivo }),
        });
      }
      note(data.success ? `Factura ${data.consecutivo} aceptada.` : tell(data), data.success ? "ok" : "err", data.cufe ? `CUFE\n${data.cufe}` : JSON.stringify(data, null, 2));
      await load(gymId);
    } finally {
      setBusy("");
    }
  }

  async function sendScript(tipo: "factura" | "soporte") {
    setBusy(tipo);
    try {
      const { data, res } = await call(gymId, "pruebas/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_documento: tipo, empresa_nit: nit, ambiente }),
      });
      note(tell(data), res.ok ? "ok" : "err", JSON.stringify(data, null, 2));
    } finally {
      setBusy("");
    }
  }

  async function sendAjuste(e: React.FormEvent) {
    e.preventDefault();
    setBusy("ajuste");
    try {
      const { data, res } = await call(gymId, "dian/nota-ajuste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nit,
          ambiente,
          motivo: ajuste.motivo,
          response_code: ajuste.response_code,
          bono_data: {
            documento_original: { id: ajuste.id, cuds: ajuste.cuds, fecha_emision: ajuste.fecha_emision, valor_total: Number(ajuste.valor_total || 0) },
            motivo_anulacion: { codigo: ajuste.response_code, descripcion: ajuste.motivo },
            beneficiario: { nombres: cliente.nombre_completo || "Consumidor", numero_documento: cliente.numero_documento || "222222222222", email: cliente.email || "no-email@example.com" },
          },
        }),
      });
      note(tell(data), res.ok ? "ok" : "err", JSON.stringify(data, null, 2));
    } finally {
      setBusy("");
    }
  }

  const docBase = `/api/facturacion/dian/dian/documentos/${encodeURIComponent(nit)}`;
  const banner = tone === "ok" ? "border-status-ok/40 bg-status-ok/10 text-status-ok" : tone === "err" ? "border-status-err/40 bg-status-err/10 text-status-err" : "border-gym-primary/40 bg-gym-primary/10 text-gym-primary";

  return (
    <GymShell active="facturacion">
      <div className="px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gym-primary">Documentos electrónicos</div>
            <h2 className="mt-1 text-2xl font-extrabold text-white">Facturación DIAN</h2>
            <p className="mt-1 text-sm text-gym-muted">{gymName}. El interruptor apagado deja la venta en caja y no llama a la DIAN.</p>
          </div>
          <button type="button" onClick={saveConfig} disabled={busy === "config"} className="btn-gym">{busy === "config" ? "Guardando…" : "Guardar configuración"}</button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Motor", motorOn ? "Encendido" : "Apagado", motorOn ? "Listo para firmar y enviar" : "El servicio no responde"],
            ["Envío", enabled ? "Activo" : "Apagado", enabled ? "Esta sede puede emitir" : "No sale ningún documento"],
            ["Certificado", certReady ? "Listo" : "Pendiente", certDetail],
            ["Ambiente", ambiente === "produccion" ? "Producción" : "Habilitación", ambiente === "produccion" ? "Documentos con validez fiscal" : "Pruebas, sin validez fiscal"],
          ].map(([title, value, sub]) => (
            <div key={title} className="glass px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-gym-muted">{title}</div>
              <div className="mt-1 text-lg font-extrabold text-white">{value}</div>
              <div className="mt-1 text-xs text-gym-muted">{sub}</div>
            </div>
          ))}
        </div>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {TABS.map(([id, label], index) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold ${tab === id ? "border-gym-primary bg-gym-primary/15 text-gym-primary" : "border-gym-border text-gym-silver"}`}>
              {index + 1}. {label}
            </button>
          ))}
        </div>

        {msg ? <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${banner}`}>{msg}</div> : null}

        {tab === "sede" && (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <Block kicker="01" title="Identificación de la sede" text="El NIT decide qué certificado y qué resolución usa el motor. El dígito de verificación se calcula solo.">
              <Field label="NIT" hint="Sin puntos y sin dígito de verificación">
                <input className={inputCls} inputMode="numeric" value={nit} onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, 15);
                  setNit(next);
                  setEmpresa((prev) => ({ ...prev, nit: next, dv: dvDe(next) }));
                }} />
              </Field>
              <Field label="Dígito de verificación" hint="Calculado con el módulo 11 de la DIAN">
                <input className={inputCls} value={dvDe(nit)} readOnly />
              </Field>
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gym-border/70 px-4 py-3">
                <div>
                  <div className="text-sm font-bold text-white">{enabled ? "Esta sede envía a la DIAN" : "Esta sede no envía a la DIAN"}</div>
                  <div className="text-xs text-gym-muted">Puedes dejar la configuración lista y encender el envío cuando el certificado ya pasó habilitación.</div>
                </div>
                <button type="button" className={`rounded-xl px-4 py-2 text-sm font-bold ${enabled ? "bg-status-ok/20 text-status-ok" : "border border-gym-border text-gym-silver"}`} onClick={async () => {
                  const ok = await saveSede(!enabled, nit);
                  note(ok ? (!enabled ? "Envío activado para esta sede." : "Envío apagado para esta sede.") : "No se pudo guardar la sede.", ok ? "ok" : "err");
                }}>{enabled ? "Apagar envío" : "Activar envío"}</button>
              </div>
            </Block>
            <section className="glass p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gym-primary">Preparación</div>
              <h3 className="mt-1 text-base font-extrabold text-white">{listos} de {checks.length} listos</h3>
              <ul className="mt-4 space-y-2">
                {checks.map(([ok, label]) => (
                  <li key={label} className="flex items-center justify-between text-sm">
                    <span className="text-gym-silver">{label}</span>
                    <span className={ok ? "text-status-ok" : "text-gym-muted"}>{ok ? "Listo" : "Pendiente"}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}

        {tab === "empresa" && (
          <div className="grid gap-4">
            <Block kicker="02" title="Información fiscal" text="Datos del emisor que van en el XML. Deben coincidir con el RUT y con el certificado.">
              <Field label="Razón social"><input className={inputCls} value={empresa.razon_social} onChange={(e) => setEmpresa({ ...empresa, razon_social: e.target.value })} /></Field>
              <Field label="Nombre comercial"><input className={inputCls} value={empresa.nombre_comercial} onChange={(e) => setEmpresa({ ...empresa, nombre_comercial: e.target.value })} /></Field>
              <Field label="Correo de la empresa"><input className={inputCls} type="email" value={empresa.email} onChange={(e) => setEmpresa({ ...empresa, email: e.target.value })} /></Field>
              <Field label="Teléfono"><input className={inputCls} value={empresa.telefono} onChange={(e) => setEmpresa({ ...empresa, telefono: e.target.value })} /></Field>
              <Field label="Régimen">
                <select className={inputCls} value={empresa.regimen} onChange={(e) => setEmpresa({ ...empresa, regimen: e.target.value })}>
                  <option value="48">48 · Responsable de IVA</option>
                  <option value="49">49 · No responsable de IVA</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gym-muted">Responsabilidades fiscales</div>
                <div className="flex flex-wrap gap-2">
                  {RESPONSABILIDADES.map(([code, label]) => {
                    const on = respList.includes(code);
                    return (
                      <button key={code} type="button" onClick={() => {
                        const next = on ? respList.filter((x) => x !== code) : [...respList, code];
                        setEmpresa({ ...empresa, responsabilidades: next.join(",") });
                      }} className={`rounded-full border px-3 py-1 text-xs font-semibold ${on ? "border-gym-primary bg-gym-primary/15 text-gym-primary" : "border-gym-border text-gym-silver"}`}>{code} · {label}</button>
                    );
                  })}
                </div>
              </div>
            </Block>
            <Block kicker="02" title="Dirección fiscal" text="Ciudad y departamento con el código DANE. Medellín es 05001 y Antioquia es 05.">
              <Field label="Dirección" ><input className={inputCls} value={empresa.direccion.address} onChange={(e) => setEmpresa({ ...empresa, direccion: { ...empresa.direccion, address: e.target.value } })} /></Field>
              <Field label="Ciudad"><input className={inputCls} value={empresa.direccion.city} onChange={(e) => setEmpresa({ ...empresa, direccion: { ...empresa.direccion, city: e.target.value } })} /></Field>
              <Field label="Código DANE de la ciudad"><input className={inputCls} value={empresa.direccion.city_code} onChange={(e) => setEmpresa({ ...empresa, direccion: { ...empresa.direccion, city_code: e.target.value.replace(/\D/g, "").slice(0, 5) } })} /></Field>
              <Field label="Departamento"><input className={inputCls} value={empresa.direccion.department} onChange={(e) => setEmpresa({ ...empresa, direccion: { ...empresa.direccion, department: e.target.value } })} /></Field>
              <Field label="Código DANE del departamento"><input className={inputCls} value={empresa.direccion.department_code} onChange={(e) => setEmpresa({ ...empresa, direccion: { ...empresa.direccion, department_code: e.target.value.replace(/\D/g, "").slice(0, 2) } })} /></Field>
              <Field label="País"><input className={inputCls} value={empresa.direccion.country} onChange={(e) => setEmpresa({ ...empresa, direccion: { ...empresa.direccion, country: e.target.value.toUpperCase().slice(0, 2) } })} /></Field>
            </Block>
            <Block kicker="02" title="Representante legal" text="Sale del certificado cuando Certicámara lo incluye. Puedes completarlo a mano.">
              <Field label="Nombres"><input className={inputCls} value={representante.nombres} onChange={(e) => setRepresentante({ ...representante, nombres: e.target.value })} /></Field>
              <Field label="Apellidos"><input className={inputCls} value={representante.apellidos} onChange={(e) => setRepresentante({ ...representante, apellidos: e.target.value })} /></Field>
              <Field label="Cédula"><input className={inputCls} value={representante.cedula} onChange={(e) => setRepresentante({ ...representante, cedula: e.target.value })} /></Field>
            </Block>
          </div>
        )}

        {tab === "certificado" && (
          <form onSubmit={uploadCert} className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Block kicker="03" title="Certificado de Certicámara" text="Los tres archivos quedan en la carpeta de este NIT. Otra sede no puede firmar con ellos.">
              <Field label="Archivo PFX o P12" hint={pfx ? pfx.name : "Ningún archivo"}>
                <input className="block w-full text-sm text-gym-silver" type="file" accept=".pfx,.p12" onChange={(e) => setPfx(e.target.files?.[0] || null)} />
              </Field>
              <Field label="Certificado CER" hint={cer ? cer.name : "Ningún archivo"}>
                <input className="block w-full text-sm text-gym-silver" type="file" accept=".cer,.pem,.crt" onChange={(e) => setCer(e.target.files?.[0] || null)} />
              </Field>
              <Field label="Llave privada" hint={keyFile ? keyFile.name : "Ningún archivo"}>
                <input className="block w-full text-sm text-gym-silver" type="file" accept=".key,.pem" onChange={(e) => setKeyFile(e.target.files?.[0] || null)} />
              </Field>
              <Field label="Contraseña del PFX">
                <input className={inputCls} type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <button className="btn-gym" disabled={busy === "cert"}>{busy === "cert" ? "Validando…" : "Validar y guardar certificado"}</button>
                <button type="button" className="rounded-xl border border-gym-border px-4 py-2 text-sm text-gym-silver" onClick={() => setShowPass((v) => !v)}>{showPass ? "Ocultar contraseña" : "Ver contraseña"}</button>
              </div>
            </Block>
            <section className="glass p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gym-primary">Estado</div>
              <h3 className="mt-1 text-base font-extrabold text-white">{certReady ? "Certificado instalado" : "Certificado pendiente"}</h3>
              <p className="mt-2 text-sm text-gym-muted">{certDetail}</p>
              <p className="mt-4 text-xs leading-5 text-gym-muted">La validación abre el PFX, comprueba que el CER y la llave correspondan, y deja los tres archivos listos para firmar el XML y autenticarse con la DIAN.</p>
            </section>
          </form>
        )}

        {tab === "software" && (
          <Block kicker="04" title="Software registrado en el portal DIAN" text="El identificador, el PIN y la clave técnica salen del catálogo de software de la DIAN. El set de pruebas solo se usa en habilitación.">
            <Field label="Software ID" hint="Identificador UUID entregado por la DIAN"><input className={inputCls} value={software.software_id} onChange={(e) => setSoftware({ ...software, software_id: e.target.value.trim() })} /></Field>
            <Field label="Nombre del software"><input className={inputCls} value={software.software_name} onChange={(e) => setSoftware({ ...software, software_name: e.target.value })} /></Field>
            <Field label="PIN" hint="Cinco dígitos"><input className={inputCls} inputMode="numeric" maxLength={8} value={software.pin} onChange={(e) => setSoftware({ ...software, pin: e.target.value.replace(/\D/g, "") })} /></Field>
            <Field label="Clave técnica"><input className={inputCls} value={software.clave_tecnica} onChange={(e) => setSoftware({ ...software, clave_tecnica: e.target.value.trim() })} /></Field>
            <Field label="Test set ID" hint="Obligatorio en habilitación. En producción puede quedar vacío."><input className={inputCls} value={software.test_set_id} onChange={(e) => setSoftware({ ...software, test_set_id: e.target.value.trim() })} /></Field>
          </Block>
        )}

        {tab === "resolucion" && (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="glass px-4 py-3"><div className="text-[10px] font-bold uppercase text-gym-muted">Próximo consecutivo</div><div className="mt-1 text-lg font-extrabold text-white">{stats.proximo || "—"}</div></div>
              <div className="glass px-4 py-3"><div className="text-[10px] font-bold uppercase text-gym-muted">Disponibles</div><div className="mt-1 text-lg font-extrabold text-white">{stats.disponibles ?? "—"}</div></div>
              <div className="glass px-4 py-3"><div className="text-[10px] font-bold uppercase text-gym-muted">Días de vigencia</div><div className="mt-1 text-lg font-extrabold text-white">{Number.isFinite(stats.dias) ? stats.dias : "—"}</div></div>
            </div>
            <Block kicker="05" title="Resolución de factura electrónica" text="Autorización de numeración para venta de bienes o servicios. El prefijo acepta hasta 4 letras o números.">
              <Field label="Número de resolución"><input className={inputCls} value={resolucion.numero_resolucion} onChange={(e) => setResolucion({ ...resolucion, numero_resolucion: e.target.value })} /></Field>
              <Field label="Prefijo"><input className={inputCls} value={resolucion.prefijo} onChange={(e) => setResolucion({ ...resolucion, prefijo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) })} /></Field>
              <Field label="Rango desde"><input className={inputCls} inputMode="numeric" value={resolucion.rango_desde} onChange={(e) => setResolucion({ ...resolucion, rango_desde: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="Rango hasta"><input className={inputCls} inputMode="numeric" value={resolucion.rango_hasta} onChange={(e) => setResolucion({ ...resolucion, rango_hasta: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="Vigente desde"><input className={inputCls} type="date" value={resolucion.fecha_desde} onChange={(e) => setResolucion({ ...resolucion, fecha_desde: e.target.value })} /></Field>
              <Field label="Vigente hasta"><input className={inputCls} type="date" value={resolucion.fecha_hasta} onChange={(e) => setResolucion({ ...resolucion, fecha_hasta: e.target.value })} /></Field>
            </Block>
            <Block kicker="05" title="Resolución de documento soporte" text="Numeración aparte para adquisiciones a sujetos no obligados a facturar. Si esta sede no emite documento soporte, deja el prefijo vacío.">
              <Field label="Número de resolución"><input className={inputCls} value={soporte.numero_resolucion} onChange={(e) => setSoporte({ ...soporte, numero_resolucion: e.target.value })} /></Field>
              <Field label="Prefijo"><input className={inputCls} value={soporte.prefijo} onChange={(e) => setSoporte({ ...soporte, prefijo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) })} /></Field>
              <Field label="Rango desde"><input className={inputCls} inputMode="numeric" value={soporte.rango_desde} onChange={(e) => setSoporte({ ...soporte, rango_desde: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="Rango hasta"><input className={inputCls} inputMode="numeric" value={soporte.rango_hasta} onChange={(e) => setSoporte({ ...soporte, rango_hasta: e.target.value.replace(/\D/g, "") })} /></Field>
              <Field label="Vigente desde"><input className={inputCls} type="date" value={soporte.fecha_desde} onChange={(e) => setSoporte({ ...soporte, fecha_desde: e.target.value })} /></Field>
              <Field label="Vigente hasta"><input className={inputCls} type="date" value={soporte.fecha_hasta} onChange={(e) => setSoporte({ ...soporte, fecha_hasta: e.target.value })} /></Field>
              <Field label="Test set del documento soporte" hint="Solo habilitación"><input className={inputCls} value={soporte.test_set_id} onChange={(e) => setSoporte({ ...soporte, test_set_id: e.target.value.trim() })} /></Field>
            </Block>
          </div>
        )}

        {tab === "ambiente" && (
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="glass p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gym-primary">06 · Ambiente</div>
              <h3 className="mt-1 text-base font-extrabold text-white">A dónde salen los documentos</h3>
              <div className="mt-4 grid gap-3">
                <button type="button" onClick={() => setAmbiente("habilitacion")} className={`rounded-2xl border p-4 text-left ${ambiente === "habilitacion" ? "border-gym-primary bg-gym-primary/10" : "border-gym-border"}`}>
                  <div className="text-sm font-extrabold text-white">Habilitación</div>
                  <p className="mt-1 text-xs text-gym-muted">Set de pruebas de la DIAN. Los documentos no tienen validez fiscal. Úsalo hasta que la DIAN apruebe el software.</p>
                </button>
                <button type="button" onClick={() => setAmbiente("produccion")} className={`rounded-2xl border p-4 text-left ${ambiente === "produccion" ? "border-status-ok bg-status-ok/10" : "border-gym-border"}`}>
                  <div className="text-sm font-extrabold text-white">Producción</div>
                  <p className="mt-1 text-xs text-gym-muted">Operación real. Solo después de la habilitación aprobada y con la resolución de producción vigente.</p>
                </button>
              </div>
            </section>
            <section className="glass p-5">
              <h3 className="text-base font-extrabold text-white">Conexión</h3>
              <p className="mt-2 text-sm text-gym-muted">Comprueba que el motor alcanza el servicio de la DIAN del ambiente guardado. Guarda la configuración antes de probar.</p>
              <button type="button" onClick={testConexion} disabled={busy === "test"} className="btn-gym mt-4">{busy === "test" ? "Probando…" : "Probar conexión con la DIAN"}</button>
              <div className="mt-4 space-y-2 text-xs text-gym-muted">
                <div>Habilitación · vpfe-hab.dian.gov.co</div>
                <div>Producción · vpfe.dian.gov.co</div>
              </div>
            </section>
          </div>
        )}

        {tab === "emitir" && (
          <div className="grid gap-4">
            <form onSubmit={sendInvoice} className="grid gap-4">
              <Block kicker="07" title="Factura electrónica" text="Elige un ticket de hoy o escribe el concepto. La venta queda en caja aunque la DIAN la rechace. El CUFE se anota solo si la acepta.">
                <div className="sm:col-span-2">
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gym-muted">Ticket de caja de hoy</div>
                  <div className="grid gap-2">
                    <button type="button" onClick={() => setSaleId("")} className={`rounded-xl border px-3 py-2 text-left text-sm ${saleId === "" ? "border-gym-primary text-white" : "border-gym-border text-gym-silver"}`}>Documento manual, sin venta de caja</button>
                    {sales.map((s) => (
                      <button key={s.id} type="button" onClick={() => setSaleId(s.id)} className={`rounded-xl border px-3 py-2 text-left ${saleId === s.id ? "border-gym-primary" : "border-gym-border"}`}>
                        <span className="text-sm font-bold text-white">Ticket #{s.number}</span>
                        <span className="ml-2 text-sm text-gym-silver">{cop(s.total)}</span>
                        {s.dian?.consecutivo ? <span className="ml-2 text-xs text-status-ok">{s.dian.consecutivo}</span> : <span className="ml-2 text-xs text-gym-muted">Sin CUFE</span>}
                      </button>
                    ))}
                    {sales.length === 0 ? <p className="text-xs text-gym-muted">Hoy no hay ventas cobradas en esta sede.</p> : null}
                  </div>
                </div>
                <Field label="Tipo de documento">
                  <select className={inputCls} value={cliente.tipo_documento} onChange={(e) => setCliente({ ...cliente, tipo_documento: e.target.value })}>
                    <option value="DNI">Cédula de ciudadanía</option>
                    <option value="NIT">NIT</option>
                    <option value="CE">Cédula de extranjería</option>
                    <option value="PASSPORT">Pasaporte</option>
                  </select>
                </Field>
                <Field label="Número de documento"><input className={inputCls} value={cliente.numero_documento} onChange={(e) => setCliente({ ...cliente, numero_documento: e.target.value })} /></Field>
                <Field label="Nombre o razón social"><input className={inputCls} value={cliente.nombre_completo} onChange={(e) => setCliente({ ...cliente, nombre_completo: e.target.value })} /></Field>
                <Field label="Correo del cliente"><input className={inputCls} type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} /></Field>
                <Field label="DV del cliente" hint="Solo si el cliente es NIT"><input className={inputCls} value={cliente.dv} onChange={(e) => setCliente({ ...cliente, dv: e.target.value })} /></Field>
                <Field label="Tipo de persona">
                  <select className={inputCls} value={cliente.tipo_persona} onChange={(e) => setCliente({ ...cliente, tipo_persona: e.target.value })}>
                    <option value="2">Natural</option>
                    <option value="1">Jurídica</option>
                  </select>
                </Field>
                {!saleId ? <>
                  <Field label="Descripción"><input className={inputCls} value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} /></Field>
                  <Field label="Cantidad"><input className={inputCls} inputMode="decimal" value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} /></Field>
                  <Field label="Precio unitario"><input className={inputCls} inputMode="numeric" value={item.price} onChange={(e) => setItem({ ...item, price: e.target.value })} /></Field>
                </> : null}
                <Field label="IVA">
                  <select className={inputCls} value={item.tax_percent} onChange={(e) => setItem({ ...item, tax_percent: e.target.value })}>
                    <option value="0">0 %</option>
                    <option value="5">5 %</option>
                    <option value="19">19 %</option>
                  </select>
                </Field>
                <Field label="Forma de pago">
                  <select className={inputCls} value={pago.forma} onChange={(e) => setPago({ ...pago, forma: e.target.value })}>
                    <option value="1">Contado</option>
                    <option value="2">Crédito</option>
                  </select>
                </Field>
                <Field label="Medio de pago">
                  <select className={inputCls} value={pago.medio} onChange={(e) => setPago({ ...pago, medio: e.target.value })}>
                    <option value="10">Efectivo</option>
                    <option value="48">Tarjeta</option>
                    <option value="47">Transferencia</option>
                  </select>
                </Field>
                <div className="sm:col-span-2"><button className="btn-gym" disabled={busy === "factura"}>{busy === "factura" ? "Enviando…" : "Enviar factura a la DIAN"}</button></div>
              </Block>
            </form>
            <section className="glass p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gym-primary">Con la resolución guardada</div>
              <h3 className="mt-1 text-base font-extrabold text-white">Envío del consecutivo siguiente</h3>
              <p className="mt-1 text-sm text-gym-muted">Usa el certificado, la empresa y la numeración ya guardados para esta sede. No arma el cliente desde un ticket.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver" disabled={busy === "factura"} onClick={() => sendScript("factura")}>{busy === "factura" ? "Enviando…" : "Enviar factura"}</button>
                <button type="button" className="rounded-xl border border-gym-border px-4 py-2 text-sm font-semibold text-gym-silver" disabled={busy === "soporte"} onClick={() => sendScript("soporte")}>{busy === "soporte" ? "Enviando…" : "Enviar documento soporte"}</button>
              </div>
            </section>
            <form onSubmit={sendAjuste}>
              <Block kicker="07" title="Nota de ajuste" text="Anula o ajusta un documento soporte ya aceptado. El CUDS es el del documento original.">
                <Field label="Consecutivo del documento soporte"><input className={inputCls} value={ajuste.id} onChange={(e) => setAjuste({ ...ajuste, id: e.target.value })} /></Field>
                <Field label="CUDS"><input className={inputCls} value={ajuste.cuds} onChange={(e) => setAjuste({ ...ajuste, cuds: e.target.value.trim() })} /></Field>
                <Field label="Fecha de emisión"><input className={inputCls} type="date" value={ajuste.fecha_emision} onChange={(e) => setAjuste({ ...ajuste, fecha_emision: e.target.value })} /></Field>
                <Field label="Valor total"><input className={inputCls} inputMode="numeric" value={ajuste.valor_total} onChange={(e) => setAjuste({ ...ajuste, valor_total: e.target.value })} /></Field>
                <Field label="Código de respuesta">
                  <select className={inputCls} value={ajuste.response_code} onChange={(e) => setAjuste({ ...ajuste, response_code: e.target.value })}>
                    <option value="1">1 · Devolución parcial</option>
                    <option value="2">2 · Anulación del documento soporte</option>
                    <option value="3">3 · Rebaja o descuento</option>
                    <option value="4">4 · Ajuste de precio</option>
                    <option value="5">5 · Otros</option>
                  </select>
                </Field>
                <Field label="Motivo"><input className={inputCls} value={ajuste.motivo} onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })} /></Field>
                <div className="sm:col-span-2"><button className="btn-gym" disabled={busy === "ajuste"}>{busy === "ajuste" ? "Enviando…" : "Enviar nota de ajuste"}</button></div>
              </Block>
            </form>
          </div>
        )}

        {tab === "documentos" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Block kicker="08" title="Archivos del motor" text="XML firmado y PDF del documento que el motor guardó para este NIT.">
              <Field label="Nombre del archivo" hint="Por ejemplo FE123.xml"><input className={inputCls} value={docName} onChange={(e) => setDocName(e.target.value.trim())} /></Field>
              <div className="flex items-end gap-2">
                <a className={`rounded-xl border border-gym-border px-4 py-2.5 text-sm font-semibold ${nit && docName ? "text-gym-silver" : "pointer-events-none text-gym-muted"}`} href={nit && docName ? `${docBase}/${encodeURIComponent(docName)}?gym=${encodeURIComponent(gymId)}` : "#"}>Descargar XML</a>
                <a className={`rounded-xl border border-gym-border px-4 py-2.5 text-sm font-semibold ${nit && docName ? "text-gym-silver" : "pointer-events-none text-gym-muted"}`} href={nit && docName ? `${docBase}/${encodeURIComponent(docName)}/pdf?gym=${encodeURIComponent(gymId)}` : "#"}>Descargar PDF</a>
              </div>
            </Block>
            <section className="glass p-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gym-primary">Última respuesta</div>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5 text-gym-silver">{last || "Todavía no hay una respuesta en esta sesión."}</pre>
            </section>
          </div>
        )}
      </div>
    </GymShell>
  );
}
