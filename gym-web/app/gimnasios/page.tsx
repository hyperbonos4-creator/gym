"use client";

import { useEffect, useState } from "react";
import GymShell from "../../components/GymShell";
import { cop } from "../../lib/money";
import { getUser } from "../../lib/session";
import type { Gym } from "../../lib/tenants";

type PlatformUser = {
  username: string;
  nombre: string;
  role: string;
  gymIds: string[] | "all";
};

const inputCls = "rounded-xl border border-gym-border bg-gym-navy/80 px-3 py-2 text-sm text-gym-silver outline-none focus:border-gym-primary";

export default function GimnasiosPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [msg, setMsg] = useState("");
  const [pulse, setPulse] = useState<Record<string, { socios: number; ventas: number; sinPlan: number }>>({});
  const [busy, setBusy] = useState<"gym" | "user" | null>(null);
  const [gymForm, setGymForm] = useState({ name: "", city: "", short: "" });
  const [userForm, setUserForm] = useState({ username: "", password: "", nombre: "", role: "admin", gymIds: [] as string[] });

  useEffect(() => {
    const u = getUser();
    if (u && u.role !== "superadmin") {
      window.location.assign("/");
      return;
    }
    reload();
  }, []);

  async function reload() {
    const [g, u] = await Promise.all([
      fetch("/api/gyms", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/users", { cache: "no-store" }).then((r) => r.json()),
    ]);
    const list = g.items || [];
    setGyms(list);
    setUsers(u.items || []);
    const next: Record<string, { socios: number; ventas: number; sinPlan: number }> = {};
    await Promise.all(list.map(async (gym: { id: string }) => {
      try {
        const d = await fetch(`/api/dashboard?gym=${encodeURIComponent(gym.id)}`, { cache: "no-store" }).then((r) => r.json());
        next[gym.id] = { socios: d.socios || 0, ventas: d.caja?.ingresos || 0, sinPlan: d.membresias?.sinPlan || 0 };
      } catch { /* la sede sigue en la lista */ }
    }));
    setPulse(next);
  }

  async function onCreateGym(e: React.FormEvent) {
    e.preventDefault();
    setBusy("gym");
    setMsg("");
    try {
      const res = await fetch("/api/gyms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gymForm),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "no se pudo crear");
      setGymForm({ name: "", city: "", short: "" });
      setMsg(`Gimnasio creado: ${data.gym.name}. Recargando para que aparezca en el selector…`);
      window.location.reload();
    } catch (err: any) {
      setMsg(err.message || "Error al crear gimnasio");
    } finally {
      setBusy(null);
    }
  }

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy("user");
    setMsg("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error === "usuario_existe" ? "Ese usuario ya existe." : data.error || "no se pudo crear");
      setUserForm({ username: "", password: "", nombre: "", role: "admin", gymIds: [] });
      setMsg(`Usuario ${data.user.username} creado. Cierra sesión y entra con esa cuenta para probar el aislamiento.`);
      await reload();
    } catch (err: any) {
      setMsg(err.message || "Error al crear usuario");
    } finally {
      setBusy(null);
    }
  }

  function gymLabel(ids: string[] | "all") {
    if (ids === "all") return "Todos los gimnasios";
    if (!ids.length) return "Sin sede";
    return ids.map((id) => gyms.find((g) => g.id === id)?.name || id).join(", ");
  }

  function toggleGym(id: string) {
    setUserForm((f) => ({
      ...f,
      gymIds: f.gymIds.includes(id) ? f.gymIds.filter((x) => x !== id) : [...f.gymIds, id],
    }));
  }

  return (
    <GymShell active="gimnasios">
      <div className="px-6 py-6">
        <div className="glass mb-6 p-6">
          <h2 className="text-xl font-extrabold tracking-tight text-white">Gimnasios y sedes</h2>
          <p className="mt-1 max-w-2xl text-sm text-gym-muted">
            Cada sede opera sola. Los socios pertenecen a una sede: solo aparecen y pueden entrar donde están registrados.
          </p>
          {msg && <div className="mt-4 rounded-xl border border-gym-primary/40 bg-gym-primary/10 px-4 py-2 text-sm text-gym-primary">{msg}</div>}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="glass p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gym-muted">Nuevo gimnasio</h3>
            <form onSubmit={onCreateGym} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gym-muted">Nombre</span>
                <input className={inputCls} value={gymForm.name} onChange={(e) => setGymForm({ ...gymForm, name: e.target.value })} placeholder="Gym Norte" required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gym-muted">Ciudad / sede</span>
                <input className={inputCls} value={gymForm.city} onChange={(e) => setGymForm({ ...gymForm, city: e.target.value })} placeholder="Medellín" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gym-muted">Iniciales</span>
                <input className={inputCls} maxLength={3} value={gymForm.short} onChange={(e) => setGymForm({ ...gymForm, short: e.target.value })} placeholder="GN" />
              </label>
              <button type="submit" disabled={busy === "gym"} className="btn-gym mt-1 disabled:opacity-50">
                {busy === "gym" ? "Creando…" : "Crear gimnasio"}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-2">
              {gyms.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-xl border border-gym-border/60 bg-gym-navy/40 px-3 py-2">
                  <div>
                    <div className="text-sm font-semibold text-gym-silver">{g.name}</div>
                    <div className="text-[11px] text-gym-muted">{g.city} · {pulse[g.id] ? `${pulse[g.id].socios} socios · ${cop(pulse[g.id].ventas)} hoy · ${pulse[g.id].sinPlan} sin plan` : g.id}</div>
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${g.whatsapp === "conectado" ? "text-status-ok" : "text-gym-muted"}`}>
                    WA {g.whatsapp}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gym-muted">Nuevo usuario</h3>
            <form onSubmit={onCreateUser} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gym-muted">Usuario</span>
                <input className={inputCls} value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="entrenador.norte" required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gym-muted">Contraseña</span>
                <input type="password" className={inputCls} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="mínimo 4 caracteres" required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gym-muted">Nombre</span>
                <input className={inputCls} value={userForm.nombre} onChange={(e) => setUserForm({ ...userForm, nombre: e.target.value })} placeholder="Ana Pérez" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-gym-muted">Rol</span>
                <select className={inputCls} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="admin">Admin de sede</option>
                  <option value="operador">Operador</option>
                  <option value="recepcion">Recepción</option>
                  <option value="caja">Caja</option>
                  <option value="entrenador">Entrenador</option>
                </select>
              </label>
              <div>
                <span className="text-xs font-semibold text-gym-muted">Puede ver únicamente</span>
                <div className="mt-2 flex flex-col gap-1.5">
                  {gyms.map((g) => (
                    <label key={g.id} className="flex items-center gap-2 text-sm text-gym-silver">
                      <input type="checkbox" checked={userForm.gymIds.includes(g.id)} onChange={() => toggleGym(g.id)} />
                      {g.name}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={busy === "user"} className="btn-gym mt-1 disabled:opacity-50">
                {busy === "user" ? "Creando…" : "Crear usuario"}
              </button>
            </form>

            <div className="mt-6 flex flex-col gap-2">
              {users.map((u) => (
                <div key={u.username} className="rounded-xl border border-gym-border/60 bg-gym-navy/40 px-3 py-2">
                  <div className="text-sm font-semibold text-gym-silver">{u.nombre} <span className="font-normal text-gym-muted">@{u.username}</span></div>
                  <div className="text-[11px] text-gym-muted">{u.role} · {gymLabel(u.gymIds)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GymShell>
  );
}
