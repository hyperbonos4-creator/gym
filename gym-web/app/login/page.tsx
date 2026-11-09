"use client";

import { useState } from "react";
import BrandLogo from "../../components/BrandLogo";
import { applySession } from "../../lib/session";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const u = String(data.get("username") ?? username).trim();
    const p = String(data.get("password") ?? password);
    if (!u || !p) {
      setError("Ingresa tu usuario y contraseña.");
      return;
    }
    setError(null);
    setLoading(true);
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!data.ok || !data.user) {
          throw new Error("Usuario o contraseña incorrectos.");
        }
        applySession(data.user);
        window.location.assign("/");
      })
      .catch((err) => {
        setError(err.message || "No se pudo iniciar sesión");
        setLoading(false);
      });
  }

  return (
    <>
      {process.env.NEXT_PUBLIC_GYM_DEMO_MODE === "1" && (
        <div className="fixed inset-x-0 top-0 z-20 border-b border-amber-400/40 bg-amber-500/15 px-3 py-2 text-center text-xs font-semibold text-amber-100">Entorno de demostración · Datos de ejemplo</div>
      )}
    <main className="relative flex h-dvh items-center justify-center overflow-hidden bg-gym-black px-4 py-4">
      <div className="login-hex pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gym-radial" />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-gym-primary/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-1/4 h-96 w-96 rounded-full bg-gym-violet/20 blur-[120px]" />

      <div className="login-stack relative z-10 w-full">
        <BrandLogo variant="hero" />

        <div className="glass login-card w-full max-w-md animate-fadeUp">
          <div className="login-card-head text-center">
            <h1 className="text-lg font-extrabold tracking-tight text-white">Acceso a la plataforma</h1>
            <p className="mt-1 text-xs text-gym-muted">Inteligencia que conecta el mundo real</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gym-muted">Usuario</span>
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                className="rounded-xl border border-gym-border bg-gym-navy/80 px-4 py-2.5 text-sm text-gym-silver outline-none transition-colors focus:border-gym-primary"
                placeholder="admin"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-gym-muted">Contraseña</span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="rounded-xl border border-gym-border bg-gym-navy/80 px-4 py-2.5 text-sm text-gym-silver outline-none transition-colors focus:border-gym-primary"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-status-err/40 bg-status-err/10 px-3 py-2 text-xs text-status-err">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-gym mt-1 w-full disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gym-muted">
            ¿Vas a abrir tu gimnasio aquí? <a href="/registro" className="font-semibold text-gym-primary">Crear cuenta</a>
          </p>
        </div>
      </div>
    </main>
    </>
  );
}
