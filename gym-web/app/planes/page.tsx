"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop, miles, enteros } from "../../lib/money";
import { getActiveGymId } from "../../lib/session";

type Plan = {
  id: string;
  name: string;
  description?: string;
  benefits?: string[];
  price: number;
  durationDays: number;
  active: boolean;
  accessWindow?: string;
  accessDays?: number[] | null;
  accessFrom?: string | null;
  accessTo?: string | null;
  priceHistory?: { price: number; from: string }[];
  nextPrice?: { price: number; from: string } | null;
  kind?: "membresia" | "tiquetera";
  guestCredits?: number;
  createdAt?: string;
};

type Stat = { id: string; active: number; renewals: number; paid: number };

const inputCls = "mt-1 w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-white outline-none focus:border-gym-primary";
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function fecha(iso: string) {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  if (!y) return iso;
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function horarioDe(p: Pick<Plan, "accessWindow" | "accessFrom" | "accessTo">) {
  if (p.accessWindow === "manana") return "5:00 a. m.–12:00 p. m.";
  if (p.accessWindow === "noche") return "5:00 p. m.–10:00 p. m.";
  if (p.accessWindow === "personalizado" && p.accessFrom && p.accessTo) return `${p.accessFrom}–${p.accessTo}`;
  return "Todo el día";
}

function diasDe(days?: number[] | null) {
  if (!days?.length) return "Todos los días";
  const key = [...days].sort().join(",");
  if (key === "1,2,3,4,5") return "Lunes–viernes";
  if (key === "1,2,3,4,5,6") return "Lunes–sábado";
  return [...days].sort().map((d) => DAY_NAMES[d]?.slice(0, 3)).join(" · ");
}

function condiciones(p: Plan) {
  if (p.kind === "tiquetera") {
    return [
      `● ${p.guestCredits || 0} invitados`,
      "● Un ingreso por persona",
      "● El titular no abre el grupo",
      ...(p.benefits || []).map((b) => `✓ ${b}`),
    ];
  }
  return [`● ${horarioDe(p)}`, `● ${diasDe(p.accessDays)}`, ...(p.benefits || []).map((b) => `✓ ${b}`)];
}

const emptyDraft = {
  name: "",
  description: "",
  benefits: "",
  days: "30",
  price: "",
  horario: "completo",
  desde: "06:00",
  hasta: "12:00",
  dias: "todos",
  customDays: [1, 2, 3, 4, 5] as number[],
  nextPrice: "",
  nextFrom: "",
  kind: "membresia",
  credits: "15",
};

export default function PlanesPage() {
  const [gymId, setGymId] = useState("fuerza-elite");
  const [items, setItems] = useState<Plan[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [summary, setSummary] = useState({ disponibles: 0, ocultos: 0, membresiasActivas: 0, renovacionesMes: 0, cobradoMes: 0, popularId: null as string | null });
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [ficha, setFicha] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (id: string) => {
    const r = await fetch(`/api/plans?gym=${encodeURIComponent(id)}`, { cache: "no-store" });
    const d = await r.json();
    setItems(d.items || []);
    setStats(d.byPlan || []);
    setSummary({
      disponibles: d.disponibles || 0,
      ocultos: d.ocultos || 0,
      membresiasActivas: d.membresiasActivas || 0,
      renovacionesMes: d.renovacionesMes || 0,
      cobradoMes: d.cobradoMes || 0,
      popularId: d.popularId || null,
    });
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
  }, [load]);

  function daysPayload() {
    if (draft.dias === "lv") return [1, 2, 3, 4, 5];
    if (draft.dias === "ls") return [1, 2, 3, 4, 5, 6];
    if (draft.dias === "custom") return draft.customDays;
    return null;
  }

  function bodyFromDraft() {
    return {
      gym: gymId,
      name: draft.name,
      description: draft.description,
      benefits: draft.benefits.split("\n"),
      durationDays: Number(draft.days),
      price: draft.price,
      accessWindow: draft.horario,
      accessDays: daysPayload(),
      accessFrom: draft.horario === "personalizado" ? draft.desde : null,
      accessTo: draft.horario === "personalizado" ? draft.hasta : null,
      kind: draft.kind,
      guestCredits: draft.kind === "tiquetera" ? Number(draft.credits) : undefined,
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const payload = bodyFromDraft();
    const r = await fetch("/api/plans", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? {
        ...payload,
        id: editing,
        nextPrice: draft.nextPrice && draft.nextFrom ? { price: draft.nextPrice, from: draft.nextFrom } : null,
      } : payload),
    });
    const d = await r.json();
    if (!r.ok) {
      setMsg(d.error === "horario_invalido" ? "El horario personalizado necesita una hora de inicio y una de fin." : d.error === "invitados_invalidos" ? "El pase necesita entre 1 y 200 invitados." : "Revisa el nombre, los días y el precio.");
      return;
    }
    setDraft(emptyDraft);
    setEditing(null);
    setFormOpen(false);
    setMsg(editing ? `${d.plan.name} quedó actualizado. Las membresías ya vendidas conservan su precio.` : `${d.plan.name} quedó disponible para vender.`);
    load(gymId);
  }

  function fill(p: Plan, asCopy: boolean) {
    const key = !p.accessDays?.length ? "todos" : p.accessDays.join(",") === "1,2,3,4,5" ? "lv" : p.accessDays.join(",") === "1,2,3,4,5,6" ? "ls" : "custom";
    setDraft({
      name: asCopy ? `${p.name} copia` : p.name,
      description: p.description || "",
      benefits: (p.benefits || []).join("\n"),
      days: String(p.durationDays),
      price: miles(String(p.price)),
      horario: p.accessWindow || "completo",
      desde: p.accessFrom || "06:00",
      hasta: p.accessTo || "12:00",
      dias: key,
      customDays: p.accessDays?.length ? p.accessDays : [1, 2, 3, 4, 5],
      nextPrice: p.nextPrice ? miles(String(p.nextPrice.price)) : "",
      nextFrom: p.nextPrice?.from || "",
      kind: p.kind === "tiquetera" ? "tiquetera" : "membresia",
      credits: String(p.guestCredits || 15),
    });
    setEditing(asCopy ? null : p.id);
    setFormOpen(true);
    setFicha(null);
  }

  async function toggle(p: Plan) {
    await fetch("/api/plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gym: gymId, id: p.id, active: !p.active }),
    });
    load(gymId);
  }

  const previewPlan: Plan = {
    id: "preview",
    name: draft.name || "Nombre del plan",
    description: draft.description,
    benefits: draft.benefits.split("\n").map((s) => s.trim()).filter(Boolean),
    price: enteros(draft.price),
    durationDays: Number(draft.days) || 0,
    active: true,
    accessWindow: draft.horario,
    accessDays: daysPayload(),
    accessFrom: draft.desde,
    accessTo: draft.hasta,
    kind: draft.kind === "tiquetera" ? "tiquetera" : "membresia",
    guestCredits: Number(draft.credits) || 0,
  };
  const selected = items.find((p) => p.id === ficha) || null;
  const statOf = (id: string) => stats.find((s) => s.id === id);

  return (
    <GymShell active="planes">
      <div className="px-6 py-6">
        <p className="max-w-2xl text-sm text-gym-silver">Define qué puede comprar un socio, cuánto cuesta y cuándo puede utilizar el gimnasio.</p>
        <p className="mt-1 max-w-2xl text-xs text-gym-muted">El acceso se calcula automáticamente según la membresía vigente y las condiciones del plan. Un pase de invitados no abre al titular: el invitado entra por rostro y, si no puede, por un PIN de un solo uso.</p>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [String(summary.disponibles), summary.disponibles === 1 ? "disponible para venta" : "disponibles para venta"],
            [String(summary.ocultos), summary.ocultos === 1 ? "oculto" : "ocultos"],
            [String(summary.membresiasActivas), summary.membresiasActivas === 1 ? "membresía activa" : "membresías activas"],
            [cop(summary.cobradoMes), "cobrado este mes"],
          ].map(([n, l]) => (
            <div key={l} className="glass px-4 py-3">
              <div className="text-lg font-extrabold text-white">{n}</div>
              <div className="text-[11px] uppercase tracking-wider text-gym-muted">{l}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gym-muted">{summary.renovacionesMes} {summary.renovacionesMes === 1 ? "renovación" : "renovaciones"} este mes. El cobro cuenta solo lo que quedó registrado como pagado.</p>

        {msg && <div className="mt-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</div>}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((p) => {
            const st = statOf(p.id);
            return (
              <article key={p.id} className={`glass p-4 ${p.active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">{p.name}</div>
                    {summary.popularId === p.id && <div className="text-[11px] font-semibold text-gym-primary">Más popular</div>}
                  </div>
                  <div className={`text-[11px] font-semibold ${p.active ? "text-status-ok" : "text-gym-muted"}`}>{p.active ? "● Disponible" : "○ Oculto"}</div>
                </div>
                <div className="mt-2 text-2xl font-extrabold text-white">{cop(p.price)}</div>
                <div className="text-sm text-gym-silver">{p.durationDays} {p.durationDays === 1 ? "día" : "días"}</div>
                <ul className="mt-3 space-y-0.5 text-sm text-gym-silver">
                  {condiciones(p).map((line) => <li key={line}>{line}</li>)}
                </ul>
                <div className="mt-3 text-sm text-white">{st?.active || 0} {(st?.active || 0) === 1 ? "activo" : "activos"}</div>
                <div className="text-[11px] text-gym-muted">{st?.renewals || 0} {(st?.renewals || 0) === 1 ? "renovación" : "renovaciones"} este mes · {cop(st?.paid || 0)} cobrado</div>
                {p.nextPrice && <div className="mt-1 text-[11px] text-status-warn">Nuevo precio {cop(p.nextPrice.price)} desde {fecha(p.nextPrice.from)}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setFicha(p.id)} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Ver plan</button>
                  <button type="button" onClick={() => fill(p, false)} className="btn-gym px-3 py-1.5 text-xs">Editar</button>
                </div>
              </article>
            );
          })}
        </div>

        {selected && (
          <section className="glass mt-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Ficha del plan</div>
                <h3 className="text-xl font-extrabold text-white">{selected.name}</h3>
                <p className="text-sm text-gym-silver">{cop(selected.price)} · {selected.durationDays} {selected.durationDays === 1 ? "día" : "días"}</p>
              </div>
              <button type="button" onClick={() => setFicha(null)} className="text-xs font-semibold text-gym-muted">Cerrar</button>
            </div>
            {selected.description && <p className="mt-2 text-sm text-gym-silver">{selected.description}</p>}
            <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-gym-muted">Acceso</div>
            <ul className="mt-1 text-sm text-gym-silver">
              {condiciones(selected).map((line) => <li key={line}>{line}</li>)}
              <li>● Renovación manual</li>
            </ul>
            <p className="mt-2 text-xs text-gym-muted">Fuera de ese horario o de esos días, el torniquete niega aunque la membresía siga vigente.</p>
            <div className="mt-3 text-sm text-white">{statOf(selected.id)?.active || 0} socios activos ahora</div>
            <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-gym-muted">Precio</div>
            <ul className="mt-1 text-sm text-gym-silver">
              {(selected.priceHistory?.length ? selected.priceHistory : [{ price: selected.price, from: (selected.createdAt || "").slice(0, 10) }]).map((h) => (
                <li key={`${h.from}-${h.price}`}>{cop(h.price)} desde {h.from ? fecha(h.from) : "el alta del plan"}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => fill(selected, false)} className="btn-gym px-3 py-1.5 text-xs">Editar</button>
              <button type="button" onClick={() => fill(selected, true)} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Duplicar</button>
              <button type="button" onClick={() => toggle(selected)} className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">{selected.active ? "Ocultar para nuevas ventas" : "Volver a ofrecer"}</button>
              <a href="/membresias" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Ver clientes con membresía</a>
            </div>
          </section>
        )}

        <div className="mt-5">
          <button type="button" onClick={() => { setFormOpen((v) => !v); setEditing(null); setDraft(emptyDraft); }} className="btn-gym px-4 py-2 text-xs">
            {formOpen && !editing ? "Cerrar" : "+ Nuevo plan"}
          </button>
        </div>

        {formOpen && (
          <form onSubmit={save} className="mt-4 grid gap-4 lg:grid-cols-5">
            <div className="glass flex flex-col gap-4 p-5 lg:col-span-3">
              <h3 className="text-sm font-bold text-white">{editing ? "Editar plan" : "Nuevo plan"}</h3>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Identidad</div>
                <label className="mt-2 block text-xs text-gym-muted">Nombre
                  <input className={inputCls} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Mensual" required />
                </label>
                <label className="mt-2 block text-xs text-gym-muted">Descripción
                  <input className={inputCls} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Acceso al gimnasio durante 30 días" />
                </label>
                <label className="mt-2 block text-xs text-gym-muted">Beneficios, uno por línea
                  <textarea className={inputCls} rows={3} value={draft.benefits} onChange={(e) => setDraft({ ...draft, benefits: e.target.value })} placeholder="Acceso a las pesas" />
                </label>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Tipo</div>
                <div className="mt-2 flex flex-col gap-1 text-sm text-gym-silver">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="kind" checked={draft.kind !== "tiquetera"} onChange={() => setDraft({ ...draft, kind: "membresia" })} />
                    Membresía · entra mientras esté vigente
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="kind" checked={draft.kind === "tiquetera"} onChange={() => setDraft({ ...draft, kind: "tiquetera" })} />
                    Pase de invitados · un ingreso por persona
                  </label>
                </div>
                {draft.kind === "tiquetera" && (
                  <label className="mt-2 block text-xs text-gym-muted">Invitados incluidos
                    <input className={inputCls} inputMode="numeric" value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: e.target.value.replace(/\D/g, "") })} />
                  </label>
                )}
                {draft.kind === "tiquetera" && (
                  <p className="mt-2 text-[11px] text-gym-muted">El titular genera cada invitación en el celular. El invitado registra el rostro y entra una vez. Si no puede registrarlo, la puerta acepta un PIN que expira en ese mismo ingreso. El registro queda a nombre de quien invitó.</p>
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Vigencia</div>
                <label className="mt-2 block text-xs text-gym-muted">Duración en días
                  <input className={inputCls} inputMode="numeric" value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value.replace(/\D/g, "") })} required />
                </label>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Acceso</div>
                <div className="mt-2 flex flex-col gap-1 text-sm text-gym-silver">
                  {[
                    ["completo", "Todo el día"],
                    ["manana", "Mañana · 5:00 a. m.–12:00 p. m."],
                    ["noche", "Noche · 5:00 p. m.–10:00 p. m."],
                    ["personalizado", "Horario personalizado"],
                  ].map(([id, label]) => (
                    <label key={id} className="flex items-center gap-2">
                      <input type="radio" name="horario" checked={draft.horario === id} onChange={() => setDraft({ ...draft, horario: id })} />
                      {label}
                    </label>
                  ))}
                </div>
                {draft.horario === "personalizado" && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs text-gym-muted">Desde<input type="time" className={inputCls} value={draft.desde} onChange={(e) => setDraft({ ...draft, desde: e.target.value })} /></label>
                    <label className="text-xs text-gym-muted">Hasta<input type="time" className={inputCls} value={draft.hasta} onChange={(e) => setDraft({ ...draft, hasta: e.target.value })} /></label>
                  </div>
                )}
                <div className="mt-3 flex flex-col gap-1 text-sm text-gym-silver">
                  {[
                    ["todos", "Todos los días"],
                    ["lv", "Lunes–viernes"],
                    ["ls", "Lunes–sábado"],
                    ["custom", "Días personalizados"],
                  ].map(([id, label]) => (
                    <label key={id} className="flex items-center gap-2">
                      <input type="radio" name="dias" checked={draft.dias === id} onChange={() => setDraft({ ...draft, dias: id })} />
                      {label}
                    </label>
                  ))}
                </div>
                {draft.dias === "custom" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DAY_NAMES.map((label, i) => (
                      <label key={label} className="flex items-center gap-1 text-xs text-gym-silver">
                        <input
                          type="checkbox"
                          checked={draft.customDays.includes(i)}
                          onChange={() => setDraft({
                            ...draft,
                            customDays: draft.customDays.includes(i) ? draft.customDays.filter((d) => d !== i) : [...draft.customDays, i],
                          })}
                        />
                        {label.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Precio</div>
                <label className="mt-2 block text-xs text-gym-muted">Precio de venta
                  <input className={inputCls} inputMode="numeric" value={draft.price} onChange={(e) => setDraft({ ...draft, price: miles(e.target.value) })} placeholder="90.000" required />
                </label>
                <p className="mt-1 text-[11px] text-gym-muted">Precio guardado: {draft.price ? cop(enteros(draft.price)) : "—"}. Cambiarlo no reescribe las membresías ya vendidas.</p>
                {editing && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs text-gym-muted">Nuevo precio desde
                      <input type="date" className={inputCls} value={draft.nextFrom} onChange={(e) => setDraft({ ...draft, nextFrom: e.target.value })} />
                    </label>
                    <label className="text-xs text-gym-muted">Precio futuro
                      <input className={inputCls} inputMode="numeric" value={draft.nextPrice} onChange={(e) => setDraft({ ...draft, nextPrice: miles(e.target.value) })} placeholder="100.000" />
                    </label>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-gym-muted">Renovación manual. El cobro automático no está activo.</p>
              </div>
              <button className="btn-gym" type="submit">{editing ? "Guardar plan" : "Crear plan"}</button>
            </div>
            <aside className="glass p-5 lg:col-span-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Vista previa para el cliente</div>
              <div className="mt-3 text-lg font-extrabold uppercase tracking-wide text-white">{previewPlan.name}</div>
              <div className="mt-1 text-2xl font-extrabold text-gym-primary">{previewPlan.price ? cop(previewPlan.price) : "—"}</div>
              <div className="text-sm text-gym-silver">{previewPlan.durationDays || "—"} {previewPlan.durationDays === 1 ? "día" : "días"}</div>
              {previewPlan.description && <p className="mt-2 text-sm text-gym-muted">{previewPlan.description}</p>}
              <ul className="mt-3 space-y-1 text-sm text-gym-silver">
                {condiciones(previewPlan).map((line) => <li key={line}>{line}</li>)}
              </ul>
              <div className="mt-4 rounded-xl border border-gym-border px-3 py-2 text-center text-xs font-semibold text-gym-muted">Elegir este plan</div>
            </aside>
          </form>
        )}
      </div>
    </GymShell>
  );
}
