"use client";

import { useState } from "react";
import BrandLogo from "../../components/BrandLogo";
import { applySession, setActiveGymId } from "../../lib/session";

const inputCls = "rounded-xl border border-gym-border bg-gym-navy/80 px-4 py-2.5 text-sm text-gym-silver outline-none focus:border-gym-primary";

export default function RegistroPage() {
  const [form, setForm] = useState({ cuenta: "", gymName: "", city: "", nombre: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cuenta/registro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo crear la cuenta.");
      applySession(data.user);
      if (data.gym?.id) setActiveGymId(data.gym.id);
      window.location.assign("/cuenta");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gym-black px-4 py-8">
      <div className="login-hex pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gym-radial" />
      <div className="login-stack relative z-10 w-full">
        <BrandLogo variant="hero" />
        <div className="glass login-card w-full max-w-md">
          <div className="login-card-head text-center">
            <h1 className="text-lg font-extrabold text-white">Abre tu gimnasio</h1>
            <p className="mt-1 text-xs text-gym-muted">14 días de prueba. Una sede. Tus socios no se mezclan con los de otra cuenta.</p>
          </div>
          <form onSubmit={onSubmit} className="grid gap-3">
            <label className="text-xs font-semibold text-gym-muted">Nombre de la cuenta<input className={`${inputCls} mt-1 w-full`} value={form.cuenta} onChange={set("cuenta")} required /></label>
            <label className="text-xs font-semibold text-gym-muted">Nombre de la sede<input className={`${inputCls} mt-1 w-full`} value={form.gymName} onChange={set("gymName")} required /></label>
            <label className="text-xs font-semibold text-gym-muted">Ciudad<input className={`${inputCls} mt-1 w-full`} value={form.city} onChange={set("city")} /></label>
            <label className="text-xs font-semibold text-gym-muted">Tu nombre<input className={`${inputCls} mt-1 w-full`} value={form.nombre} onChange={set("nombre")} required /></label>
            <label className="text-xs font-semibold text-gym-muted">Usuario<input className={`${inputCls} mt-1 w-full`} value={form.username} onChange={set("username")} autoComplete="username" required /></label>
            <label className="text-xs font-semibold text-gym-muted">Contraseña<input className={`${inputCls} mt-1 w-full`} type="password" value={form.password} onChange={set("password")} autoComplete="new-password" required /></label>
            {error && <div className="rounded-lg border border-status-err/40 bg-status-err/10 px-3 py-2 text-xs text-status-err">{error}</div>}
            <button className="btn-gym w-full" disabled={loading}>{loading ? "Creando…" : "Crear cuenta"}</button>
          </form>
          <p className="mt-4 text-center text-xs text-gym-muted"><a href="/login" className="font-semibold text-gym-primary">Ya tengo usuario</a></p>
        </div>
      </div>
    </main>
  );
}
