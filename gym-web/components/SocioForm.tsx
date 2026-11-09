"use client";

import { useEffect, useState } from "react";
import { EMPTY_SOCIO_FORM, fieldCls, inputCls, labelCls, type SocioFormData } from "../lib/socioForm";

type Known = { id: string; nombre: string; docTipo: string; docNumero: string; celular: string };

const PAISES = [
  ["57", "+57"],
  ["1", "+1"],
  ["52", "+52"],
  ["58", "+58"],
  ["593", "+593"],
  ["34", "+34"],
];

function digits(v: string) {
  return String(v || "").replace(/\D/g, "");
}

function docListo(tipo: string, numero: string) {
  const d = digits(numero);
  if (!numero.trim()) return false;
  if (tipo === "PAS") return numero.trim().length >= 5;
  if (tipo === "NIT") return d.length >= 9 && d.length <= 12;
  return d.length >= 6 && d.length <= 12;
}

function whatsappListo(pais: string, celular: string) {
  const d = digits(celular);
  if (pais === "57") return d.length === 10 && d.startsWith("3");
  return d.length >= 8 && d.length <= 15;
}

function phoneText(pais: string, celular: string) {
  const d = digits(celular);
  if (!d) return "";
  if (pais === "57" && d.length === 10) return `+57 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `+${pais} ${d}`;
}

function normalizar(v: string) {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function parecido(nombre: string, items: Known[]) {
  const n = normalizar(nombre);
  const tokens = n.split(" ").filter((w) => w.length > 2);
  if (tokens.length < 2) return null;
  return items.find((s) => {
    const otros = normalizar(s.nombre).split(" ").filter((w) => w.length > 2);
    const set = new Set(otros);
    const comunes = tokens.filter((w) => set.has(w));
    return comunes.length >= 2;
  }) || null;
}

function cuando(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function Toggle({ value, onChange, yes = "Sí", no = "No" }: { value: boolean; onChange: (v: boolean) => void; yes?: string; no?: string }) {
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-gym-border">
      <button type="button" onClick={() => onChange(true)}
        className={`px-4 py-2 text-xs font-semibold transition-colors ${value ? "bg-gradient-to-r from-gym-primaryDeep to-gym-violet text-white" : "text-gym-muted hover:text-gym-silver"}`}>{yes}</button>
      <button type="button" onClick={() => onChange(false)}
        className={`px-4 py-2 text-xs font-semibold transition-colors ${!value ? "bg-gym-border/60 text-gym-silver" : "text-gym-muted hover:text-gym-silver"}`}>{no}</button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 mt-1 text-[11px] font-bold uppercase tracking-wider text-gym-muted/80">{children}</div>;
}

function registerError(result: { error?: string; nombre?: string }) {
  if (result.error === "documento_duplicado") {
    return `Ya existe un cliente con ese documento${result.nombre ? ` (${result.nombre})` : ""}. No se crea otra ficha.`;
  }
  if (result.error === "celular_duplicado") {
    return `Ya existe un cliente con ese celular${result.nombre ? ` (${result.nombre})` : ""}. Reenvía el link desde su ficha.`;
  }
  return `No se pudo registrar: ${result.error}`;
}

export type SocioEdit = SocioFormData & { id: string };

const DRAFT_KEYS = ["docTipo", "docNumero", "nombre", "fechaNac", "genero", "codigoPais", "celular", "email", "enviarEmails", "direccion", "prospecto", "empresa", "contactoRespaldoNombre", "contactoRespaldoTel", "observaciones"] as const;

export function clienteDraftKey(id: string) {
  return `gym-cliente-borrador:${id}`;
}

export function clearClienteDraft(id: string) {
  try { sessionStorage.removeItem(clienteDraftKey(id)); } catch { /* el navegador puede bloquear el almacenamiento */ }
}

function fichaIgual(form: SocioFormData, saved: SocioFormData) {
  return DRAFT_KEYS.every((k) => form[k] === saved[k]);
}

function leerBorrador(edit: SocioEdit | null): { form: SocioFormData; recuperado: boolean } {
  const base: SocioFormData = edit ? { ...EMPTY_SOCIO_FORM, ...edit } : { ...EMPTY_SOCIO_FORM };
  if (!edit) return { form: base, recuperado: false };
  try {
    const raw = sessionStorage.getItem(clienteDraftKey(edit.id));
    if (!raw) return { form: base, recuperado: false };
    const saved = JSON.parse(raw) as Partial<SocioFormData>;
    const form = { ...base, ...saved };
    return { form, recuperado: !fichaIgual(form, base) };
  } catch {
    return { form: base, recuperado: false };
  }
}

export default function SocioForm({
  gymId,
  submitLabel = "Registrar cliente y avisar en la app",
  onDone,
  variant = "simple",
  edit = null,
  onDirty,
}: {
  gymId: string | null;
  submitLabel?: string;
  onDone?: (result: any) => void;
  variant?: "simple" | "alta";
  edit?: SocioEdit | null;
  onDirty?: (dirty: boolean) => void;
}) {
  const [form, setForm] = useState<SocioFormData>(() => leerBorrador(edit).form);
  const [recuperado] = useState(() => leerBorrador(edit).recuperado);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [known, setKnown] = useState<Known[] | null>(null);
  const set = (k: keyof SocioFormData, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const alta = variant === "alta";

  useEffect(() => {
    const base = edit ? { ...EMPTY_SOCIO_FORM, ...edit } : { ...EMPTY_SOCIO_FORM };
    const dirty = !fichaIgual(form, base);
    onDirty?.(dirty);
    if (!edit) return;
    try {
      if (!dirty) sessionStorage.removeItem(clienteDraftKey(edit.id));
      else sessionStorage.setItem(clienteDraftKey(edit.id), JSON.stringify(form));
    } catch { /* sin almacenamiento, la edición sigue en memoria */ }
  }, [form, edit, onDirty]);

  useEffect(() => {
    if ((!alta && !edit) || !gymId) return;
    let stop = false;
    fetch(`/api/socios?gym=${encodeURIComponent(gymId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (!stop) setKnown(d.items || []); })
      .catch(() => { if (!stop) setKnown([]); });
    return () => { stop = true; };
  }, [alta, edit, gymId, result?.ok]);

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setResult(null);
    setCopied(false);
    try {
      if (edit) {
        const res = await fetch("/api/socios", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, id: edit.id, gym: gymId || "fuerza-elite" }),
        });
        const data = await res.json();
        setResult(data);
        if (data.ok) {
          clearClienteDraft(edit.id);
          onDone?.(data);
        }
        return;
      }
      const res = await fetch(`/api/socios/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, gym: gymId || "fuerza-elite" }),
      });
      const data = await res.json();
      setResult(data);
      if (data.ok) {
        setForm({ ...EMPTY_SOCIO_FORM });
        onDone?.(data);
      }
    } catch (err: any) {
      setResult({ ok: false, error: String(err?.message || err) });
    } finally {
      setSending(false);
    }
  }

  const docOk = docListo(form.docTipo, form.docNumero);
  const telOk = whatsappListo(form.codigoPais, form.celular);
  const docDup = docOk ? known?.find((s) => {
    if (s.id === edit?.id || !s.docNumero) return false;
    if (form.docTipo === "PAS") return s.docNumero.trim().toLowerCase() === form.docNumero.trim().toLowerCase();
    return digits(s.docNumero) === digits(form.docNumero);
  }) : undefined;
  const telDup = telOk && !docDup ? known?.find((s) => s.id !== edit?.id && digits(s.celular) === digits(form.celular)) : undefined;
  const mismo = !docDup && !telDup ? parecido(form.nombre, known || []) : null;
  const inicial = form.nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("") || "·";

  if (alta && result?.ok) {
    const socio = result.socio || {};
    const enviado = !!result.wa?.ok;
    const hechos = 1 + (enviado ? 1 : 0);
    const pct = Math.round((hechos / 4) * 100);
    return (
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-status-ok">Cliente creado</div>
        <h3 className="mt-1 text-2xl font-extrabold text-white">{socio.nombre}</h3>
        <p className="mt-1 text-sm text-gym-silver">{socio.docTipo} {socio.docNumero} · {phoneText(socio.codigoPais || "57", socio.celular || "")}</p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-gym-muted">
            <span className="font-bold uppercase tracking-wider">Activación del cliente</span>
            <span>{pct}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gym-border">
            <div className="h-full rounded-full bg-gym-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ul className="mt-4 space-y-1 text-sm text-gym-silver">
          <li className="text-status-ok">✓ Ficha registrada</li>
          <li className={enviado ? "text-status-ok" : "text-status-warn"}>{enviado ? "✓ Aviso enviado: entra por la app" : "○ La ficha está lista. WhatsApp no avisó."}</li>
          <li>○ Rostro pendiente</li>
          <li>○ Membresía pendiente</li>
          <li className="text-status-err">⛔ Acceso todavía no autorizado</li>
        </ul>
        {result.consent && (
          <p className="mt-3 text-xs text-gym-muted">Consentimiento para identificación facial · Registrado{socio.createdAt ? ` · ${cuando(socio.createdAt)}` : ""}</p>
        )}
        <div className="mt-5 rounded-2xl border border-gym-border/70 bg-gym-navy/40 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Siguiente paso</div>
          <p className="mt-1 text-sm text-white">{enviado ? "El cliente entra a la app con su documento y este WhatsApp." : "La ficha ya existe. Cuando WhatsApp esté conectado, se le avisa que abra la app."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { navigator.clipboard?.writeText(result.link); setCopied(true); }} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver">{copied ? "Enlace copiado" : "Copiar enlace"}</button>
            <a href={`/clientes?socio=${encodeURIComponent(socio.id || "")}`} className="rounded-xl border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver">Ver cliente</a>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-sm text-gym-silver">¿Quieres activarlo ahora?</p>
          <a href="/membresias" className="btn-gym mt-2 inline-block px-4 py-2 text-sm">Asignar membresía</a>
        </div>
        <button type="button" onClick={() => { setResult(null); setCopied(false); }} className="mt-4 text-xs font-semibold text-gym-muted">Registrar otro cliente</button>
      </div>
    );
  }

  return (
    <>
      {alta && (
        <div className="mb-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Activación</div>
          <ol className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["1 Datos", "● Actual"],
              ["2 Rostro", "○ Pendiente"],
              ["3 Membresía", "○ Pendiente"],
              ["4 Acceso", "○ Bloqueado"],
            ].map(([n, s]) => (
              <li key={n} className="rounded-xl border border-gym-border/60 px-3 py-2">
                <div className="text-xs font-bold text-white">{n}</div>
                <div className={`text-[11px] ${s.startsWith("●") ? "text-gym-primary" : "text-gym-muted"}`}>{s}</div>
              </li>
            ))}
          </ol>
        </div>
      )}
      <form onSubmit={onRegister} className="flex flex-col">
        {recuperado && (
          <p className="mb-3 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-3 py-2 text-xs text-gym-silver">Recuperamos lo que estabas escribiendo. Pulsa Guardar cambios para dejarlo en la ficha.</p>
        )}
        <SectionTitle>Identificación</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Tipo de documento</span>
            <select value={form.docTipo} onChange={(e) => set("docTipo", e.target.value)} className={inputCls}>
              <option value="CC">CC</option>
              <option value="TI">TI</option>
              <option value="CE">CE</option>
              <option value="PAS">Pasaporte</option>
              <option value="NIT">NIT</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Número de documento</span>
            <input value={form.docNumero} onChange={(e) => set("docNumero", e.target.value)} className={inputCls} placeholder="Ej. 1032456789" />
          </label>
        </div>
        {alta && form.docNumero.trim() && (
          <p className={`mt-2 text-xs ${docDup ? "text-status-warn" : docOk ? "text-status-ok" : "text-gym-muted"}`}>
            {known == null ? "Buscando coincidencias…" : docDup ? `⚠ Ya existe ${docDup.nombre}` : docOk ? "✓ No encontramos otro cliente con este documento." : "Revisa el número."}
            {docDup && <a href={`/clientes?socio=${encodeURIComponent(docDup.id)}`} className="ml-2 font-semibold text-gym-primary">Abrir ficha</a>}
          </p>
        )}
        <label className="mt-3 flex flex-col gap-1.5">
          <span className={labelCls}>Nombre completo *</span>
          <input required value={form.nombre} onChange={(e) => set("nombre", e.target.value)} className={inputCls} placeholder="Ej. Laura Gómez Restrepo" />
        </label>
        {alta && mismo && (
          <p className="mt-2 text-xs text-status-warn">
            Encontramos un cliente parecido: {mismo.nombre}.
            <a href={`/clientes?socio=${encodeURIComponent(mismo.id)}`} className="ml-2 font-semibold text-gym-primary">Revisar antes de crear otro</a>
          </p>
        )}
        {(form.nombre.trim() || form.docNumero.trim() || form.celular.trim()) && alta && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-gym-border/60 bg-gym-navy/40 px-3 py-3">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-gym-primaryDeep to-gym-violet text-sm font-bold text-white">{inicial}</div>
            <div>
              <div className="text-sm font-bold text-white">{form.nombre.trim() || "Nuevo cliente"}</div>
              <div className="text-[11px] text-gym-muted">{form.docTipo} {form.docNumero || "sin documento"}{form.celular ? ` · ${phoneText(form.codigoPais, form.celular)}` : ""}</div>
            </div>
          </div>
        )}
        <div className="mt-3">
          <SectionTitle>Contacto</SectionTitle>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>WhatsApp *</span>
            <span className="flex gap-2">
              <select value={form.codigoPais} onChange={(e) => set("codigoPais", e.target.value)} className={`${fieldCls} w-24 shrink-0 px-2`} aria-label="Código de país">
                {PAISES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input required inputMode="tel" value={form.celular} onChange={(e) => set("celular", e.target.value)} className={`${fieldCls} min-w-0 flex-1`} placeholder="300 123 4567" aria-label="Número de WhatsApp" />
            </span>
          </label>
          {alta && form.celular.trim() && (
            <p className={`mt-2 text-xs ${telDup ? "text-status-warn" : telOk ? "text-status-ok" : "text-gym-muted"}`}>
              {telDup ? `⚠ Ya existe ${telDup.nombre} con este número.` : telOk ? "✓ WhatsApp válido" : "El número todavía no está completo."}
              {telDup && <a href={`/clientes?socio=${encodeURIComponent(telDup.id)}`} className="ml-2 font-semibold text-gym-primary">Abrir ficha</a>}
            </p>
          )}
        </div>
        <details className="mt-4 rounded-xl border border-gym-border/60 px-3 py-2">
          <summary className="cursor-pointer text-xs font-semibold text-gym-primary">Más información</summary>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Fecha de nacimiento</span>
            <input type="date" value={form.fechaNac} onChange={(e) => set("fechaNac", e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Género</span>
            <select value={form.genero} onChange={(e) => set("genero", e.target.value)} className={inputCls}>
              <option value="">Sin especificar</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="O">Otro</option>
            </select>
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className={labelCls}>Correo electrónico</span>
            <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} placeholder="cliente@correo.com" />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>Enviar emails</span>
            <Toggle value={form.enviarEmails} onChange={(v) => set("enviarEmails", v)} />
          </div>
        </div>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className={labelCls}>Dirección</span>
          <input value={form.direccion} onChange={(e) => set("direccion", e.target.value)} className={inputCls} placeholder="Calle 00 # 00-00" />
        </label>

        <div className="my-4 h-px bg-gym-border/50" />
        <SectionTitle>Adicional</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className={labelCls}>¿Es prospecto?</span>
            <Toggle value={form.prospecto} onChange={(v) => set("prospecto", v)} />
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Empresa / convenio</span>
            <input value={form.empresa} onChange={(e) => set("empresa", e.target.value)} className={inputCls} placeholder="Opcional" />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Contacto de respaldo</span>
            <input value={form.contactoRespaldoNombre} onChange={(e) => set("contactoRespaldoNombre", e.target.value)} className={inputCls} placeholder="Nombre" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelCls}>Teléfono de respaldo</span>
            <input inputMode="tel" value={form.contactoRespaldoTel} onChange={(e) => set("contactoRespaldoTel", e.target.value)} className={inputCls} placeholder="Ej. 3009876543" />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1.5">
          <span className={labelCls}>Observaciones</span>
          <textarea value={form.observaciones} onChange={(e) => set("observaciones", e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Notas internas (lesiones, objetivos, etc.)" />
        </label>

        </details>
        {alta ? (
          <div className="mt-4 space-y-3 text-sm text-gym-silver">
            <div className="rounded-2xl border border-gym-border/60 px-3 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Enrolamiento facial</div>
              <p className="mt-1">La ficha queda en la aplicación. WhatsApp solo le dice que la abra con su documento y este número.</p>
              <p className="mt-1 text-xs text-gym-muted">○ Pendiente. Al crear la ficha se genera el enlace y se envía.</p>
            </div>
            <div className="rounded-2xl border border-gym-border/60 px-3 py-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Acceso</div>
              <p className="mt-1">La puerta no abre hasta completar:</p>
              <ul className="mt-1 space-y-0.5 text-xs">
                <li>○ Rostro enrolado</li>
                <li>○ Membresía vigente</li>
                <li>○ Sede autorizada</li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-[11px] text-gym-muted">
            El rostro no se toma aquí. La ficha se abre en la app. Sin un plan vigente, la puerta no abre.
          </p>
        )}

        <div className="sticky bottom-0 z-10 -mx-1 mt-4 border-t border-gym-border/60 bg-gym-navy/95 px-1 py-3 backdrop-blur">
          <button type="submit" disabled={sending || !!docDup || !!telDup} className="btn-gym w-full disabled:opacity-50">
            {sending ? (edit ? "Guardando…" : "Guardando y enviando…") : submitLabel}
          </button>
        </div>
      </form>

      {result && result.ok && edit && (
        <p className="mt-4 text-sm font-semibold text-status-ok">Datos guardados.{result.door === false ? " La puerta sigue con el nombre anterior." : ""}</p>
      )}
      {result && result.ok && !alta && !edit && (
        <div className="mt-5 rounded-xl border border-status-ok/40 bg-status-ok/10 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-status-ok">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M20 6 9 17l-5-5" /></svg>
            {result.socio?.nombre} · ficha lista
          </div>
          <ul className="mt-2 space-y-1 text-xs text-gym-silver">
            <li>Ficha creada</li>
            <li>{result.wa?.ok ? `Aviso enviado a +${result.wa.numero}: entra por la app` : "Aviso pendiente: WhatsApp no está conectado"}</li>
            <li>Membresía sin asignar. La puerta permanece cerrada.</li>
          </ul>
          <a href="/membresias" className="mt-2 inline-block text-xs font-semibold text-gym-primary">Asignar plan →</a>
          <div className="mt-3 flex items-center gap-2">
            <input readOnly value={result.link} className="flex-1 truncate rounded-lg border border-gym-border bg-gym-navy/70 px-3 py-2 text-[11px] text-gym-muted" />
            <button onClick={() => { navigator.clipboard?.writeText(result.link); setCopied(true); }}
              className="rounded-lg border border-gym-border px-3 py-2 text-xs font-semibold text-gym-silver hover:border-gym-primary">
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
      {result && !result.ok && (
        <div className="mt-5 rounded-xl border border-status-err/40 bg-status-err/10 px-3 py-2 text-xs text-status-err">
          {registerError(result)}
        </div>
      )}
    </>
  );
}
