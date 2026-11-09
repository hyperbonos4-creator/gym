"use client";

import { useCallback, useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getActiveGymId, getUser } from "../../lib/session";

const inputCls = "w-full rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2.5 text-sm text-white outline-none focus:border-gym-primary";

type Plan = { label: string; sedes: number; precio: number };
type View = {
  abierta?: boolean;
  dias?: number | null;
  planes?: Record<string, Plan>;
  plan?: Plan | null;
  cuenta?: { id: string; name: string; plan: string; status: string; trialEndsAt: string; gymIds: string[] } | null;
  gym?: { id: string; name: string; brandName?: string; logo?: boolean } | null;
};

export default function CuentaPage() {
  const [gymId, setGymId] = useState("");
  const [view, setView] = useState<View>({});
  const [brandName, setBrandName] = useState("");
  const [msg, setMsg] = useState("");
  const [team, setTeam] = useState({ username: "", password: "", nombre: "", role: "recepcion" });
  const [sede, setSede] = useState({ name: "", city: "" });
  const [cuentas, setCuentas] = useState<NonNullable<View["cuenta"]>[]>([]);
  const [superadmin, setSuperadmin] = useState(false);

  const load = useCallback(async (id: string) => {
    const data = await fetch(`/api/cuenta?gym=${encodeURIComponent(id)}`, { cache: "no-store" }).then((r) => r.json());
    setView(data);
    setBrandName(data.gym?.brandName || data.gym?.name || "");
  }, []);

  useEffect(() => {
    const id = getActiveGymId() || "fuerza-elite";
    setGymId(id);
    load(id);
    if (getUser()?.role === "superadmin") {
      setSuperadmin(true);
      fetch("/api/cuenta", { cache: "no-store" }).then((r) => r.json()).then((d) => setCuentas(d.items || []));
    }
  }, [load]);

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    const file = (document.getElementById("logo") as HTMLInputElement)?.files?.[0];
    let logoBase64 = "";
    if (file) {
      logoBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer el logo."));
        reader.readAsDataURL(file);
      });
    }
    const data = await fetch("/api/cuenta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gym: gymId, brandName, logoBase64 }) }).then((r) => r.json());
    setMsg(data.ok ? "Marca guardada para esta sede." : data.error || "No se pudo guardar la marca.");
    if (data.ok) load(gymId);
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const data = await fetch("/api/cuenta/equipo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...team, gymIds: [gymId] }) }).then((r) => r.json());
    setMsg(data.ok ? `Usuario ${data.user.username} creado solo para esta sede.` : data.error || "No se pudo crear.");
    if (data.ok) setTeam({ username: "", password: "", nombre: "", role: "recepcion" });
  }

  async function addSede(e: React.FormEvent) {
    e.preventDefault();
    const data = await fetch("/api/cuenta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sede", gym: gymId, ...sede }) }).then((r) => r.json());
    setMsg(data.ok ? `Sede ${data.gym.name} creada. Actualizando el selector…` : data.error || "No se pudo crear la sede.");
    if (data.ok) window.location.reload();
  }

  async function setCuenta(id: string, action: string, plan?: string) {
    const data = await fetch("/api/cuenta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id, plan }) }).then((r) => r.json());
    setMsg(data.ok ? "Cuenta actualizada." : data.error || "No se pudo actualizar.");
    if (data.ok) {
      const d = await fetch("/api/cuenta", { cache: "no-store" }).then((r) => r.json());
      setCuentas(d.items || []);
      load(gymId);
    }
  }

  const cuenta = view.cuenta;
  const estado = !cuenta ? "Sede de la plataforma. No tiene prueba ni corte." : !view.abierta ? "Suspendida" : cuenta.status === "activa" ? "Activa" : `Prueba · ${view.dias} días`;

  return (
    <GymShell active="cuenta">
      <div className="px-6 py-6">
        <div className="mb-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gym-primary">Software</div>
          <h2 className="mt-1 text-2xl font-extrabold text-white">Cuenta</h2>
          <p className="mt-1 text-sm text-gym-muted">{view.gym?.name || "Esta sede"}. {estado}.</p>
        </div>
        {msg && <div className="mb-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</div>}

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          {Object.entries(view.planes || {}).map(([id, plan]) => (
            <div key={id} className={`glass p-4 ${cuenta?.plan === id ? "border-gym-primary" : ""}`}>
              <div className="text-[10px] font-bold uppercase text-gym-muted">{plan.label}</div>
              <div className="mt-1 text-lg font-extrabold text-white">{cop(plan.precio)}<span className="text-xs font-medium text-gym-muted"> / mes</span></div>
              <p className="mt-1 text-xs text-gym-muted">Hasta {plan.sedes} {plan.sedes === 1 ? "sede" : "sedes"}.</p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={saveBrand} className="glass grid gap-3 p-5">
            <h3 className="text-base font-extrabold text-white">Marca de esta sede</h3>
            <p className="text-sm text-gym-muted">El nombre y el logo aparecen en el selector. La app del socio sigue siendo la misma; entra a su gimnasio.</p>
            <label className="text-xs font-semibold text-gym-muted">Nombre visible<input className={`${inputCls} mt-1`} value={brandName} onChange={(e) => setBrandName(e.target.value)} /></label>
            <label className="text-xs font-semibold text-gym-muted">Logo<input id="logo" className="mt-1 block w-full text-sm text-gym-silver" type="file" accept="image/png,image/jpeg,image/webp" /></label>
            <button className="btn-gym">Guardar marca</button>
          </form>

          <form onSubmit={invite} className="glass grid gap-3 p-5">
            <h3 className="text-base font-extrabold text-white">Equipo</h3>
            <p className="text-sm text-gym-muted">Esta persona solo entra a la sede actual.</p>
            <input className={inputCls} placeholder="Nombre" value={team.nombre} onChange={(e) => setTeam({ ...team, nombre: e.target.value })} required />
            <input className={inputCls} placeholder="Usuario" value={team.username} onChange={(e) => setTeam({ ...team, username: e.target.value })} required />
            <input className={inputCls} type="password" placeholder="Contraseña" value={team.password} onChange={(e) => setTeam({ ...team, password: e.target.value })} required />
            <select className={inputCls} value={team.role} onChange={(e) => setTeam({ ...team, role: e.target.value })}>
              <option value="recepcion">Recepción</option>
              <option value="caja">Caja</option>
              <option value="entrenador">Entrenador</option>
              <option value="admin">Administrador de la sede</option>
            </select>
            <button className="btn-gym">Crear usuario</button>
          </form>

          <form onSubmit={addSede} className="glass grid gap-3 p-5">
            <h3 className="text-base font-extrabold text-white">Otra sede de esta cuenta</h3>
            <p className="text-sm text-gym-muted">El plan Inicio admite una. Operación admite tres. Red admite diez.</p>
            <input className={inputCls} placeholder="Nombre de la sede" value={sede.name} onChange={(e) => setSede({ ...sede, name: e.target.value })} required />
            <input className={inputCls} placeholder="Ciudad" value={sede.city} onChange={(e) => setSede({ ...sede, city: e.target.value })} />
            <button className="btn-gym">Agregar sede</button>
          </form>

          <section className="glass p-5">
            <h3 className="text-base font-extrabold text-white">Copia de esta sede</h3>
            <p className="mt-1 text-sm text-gym-muted">Socios, caja, rutinas y nutrición de esta sede. No incluye certificados de la DIAN ni contraseñas.</p>
            <a className="btn-gym mt-4" href={`/api/cuenta/respaldo?gym=${encodeURIComponent(gymId)}`}>Descargar copia</a>
          </section>
        </div>

        {superadmin && (
          <section className="glass mt-4 p-5">
            <h3 className="text-base font-extrabold text-white">Cuentas del software</h3>
            <p className="mt-1 text-sm text-gym-muted">Las sedes que ya operaban no están en esta lista y no se suspenden solas.</p>
            <div className="mt-4 divide-y divide-gym-border/50">
              {cuentas.length === 0 && <p className="py-4 text-sm text-gym-muted">Todavía no hay cuentas creadas desde el registro.</p>}
              {cuentas.map((c) => c && (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <div className="text-sm font-bold text-white">{c.name}</div>
                    <div className="text-xs text-gym-muted">{c.status} · {c.plan} · {c.gymIds.length} sedes</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs text-gym-silver" onClick={() => setCuenta(c.id, "activar")}>Activar</button>
                    <button type="button" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs text-gym-silver" onClick={() => setCuenta(c.id, "suspender")}>Suspender</button>
                    <button type="button" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs text-gym-silver" onClick={() => setCuenta(c.id, "plan", "operacion")}>Plan operación</button>
                    <button type="button" className="rounded-xl border border-gym-border px-3 py-1.5 text-xs text-gym-silver" onClick={() => setCuenta(c.id, "plan", "red")}>Plan red</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </GymShell>
  );
}
