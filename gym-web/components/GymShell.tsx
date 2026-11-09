"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NAV, NAV_GROUPS, SOON_KEYS, roleCanSee } from "../lib/nav";
import { getUser, logout, getActiveGymId, setActiveGymId, type SessionUser } from "../lib/session";
import type { Gym } from "../lib/tenants";
import BrandLogo from "./BrandLogo";

export default function GymShell({
  active,
  children,
}: {
  active: string;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gymMenu, setGymMenu] = useState(false);
  const [health, setHealth] = useState<"ok" | "parcial" | "off" | null>(null);
  const [signals, setSignals] = useState<{ accessOffline: number; accessDevices: number; membresiasHoy: number; cajaAbierta: boolean; whatsapp: boolean | null } | null>(null);
  const [soonOpen, setSoonOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const navScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gym?.id) return;
    let stop = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/access/overview?gym=${encodeURIComponent(gym.id)}`, { cache: "no-store" });
        const d = await r.json();
        if (stop) return;
        let offline = 0;
        try {
          const s = await fetch(`/api/signals?gym=${encodeURIComponent(gym.id)}`, { cache: "no-store" });
          const body = await s.json();
          if (!stop && typeof body.accessOffline === "number") {
            setSignals(body);
            offline = body.accessOffline;
          }
        } catch {
          /* el menú sigue usable sin señales */
        }
        if (stop) return;
        if (!d.backend) setHealth("off");
        else if (!d.vision || !d.whatsapp || offline > 0) setHealth("parcial");
        else setHealth("ok");
      } catch {
        if (!stop) setHealth("off");
      }
    };
    tick();
    const t = setInterval(tick, 20000);
    return () => { stop = true; clearInterval(t); };
  }, [gym?.id]);

  useEffect(() => {
    const u = getUser();
    if (!u) { window.location.assign("/login"); return; }
    setUser(u);
    fetch("/api/gyms", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const items: Gym[] = Array.isArray(d.items) ? d.items : [];
        setGyms(items);
        const saved = getActiveGymId();
        const allowed = items.find((g) => g.id === saved) || items[0] || null;
        if (allowed) {
          if (saved !== allowed.id) {
            setActiveGymId(allowed.id);
            window.location.reload();
            return;
          }
          setGym(allowed);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!gym?.id) return;
    fetch(`/api/cuenta?gym=${encodeURIComponent(gym.id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.cuenta && d.abierta === false) setNotice("La prueba de esta cuenta terminó. Puedes consultar la sede. Para volver a registrar, activa el plan en Cuenta.");
        else if (d.cuenta?.status === "prueba" && typeof d.dias === "number" && d.dias <= 3) setNotice(`Quedan ${d.dias} días de prueba del software.`);
        else setNotice("");
      })
      .catch(() => {});
  }, [gym?.id]);

  function pickGym(g: Gym) {
    if (g.id === gym?.id) {
      setGymMenu(false);
      return;
    }
    setActiveGymId(g.id);
    setGymMenu(false);
    window.location.reload();
  }

  const current = NAV.find((n) => n.key === active) ?? NAV[0];
  const canSwitch = gyms.length > 1;
  const hrefFor = (key: string) => (key === "dashboard" ? "/" : `/${key}`);
  const visible = NAV.filter((n) => (n.key !== "gimnasios" || user?.role === "superadmin") && roleCanSee(user?.role || "admin", n.key));
  const navItems = visible.filter((n) => n.enabled);
  const soon = visible.filter((n) => SOON_KEYS.includes(n.key));
  function navMark(key: string): { text: string; title: string; warn: boolean } | null {
    if (!signals) return null;
    if (key === "torniquetes") {
      return signals.accessOffline > 0
        ? { text: `${signals.accessOffline} ${signals.accessOffline === 1 ? "incidencia" : "incidencias"}`, title: "Sin comunicación", warn: true }
        : signals.accessDevices > 0 ? { text: "En línea", title: "El controlador está avisando", warn: false } : null;
    }
    if (key === "membresias") {
      return signals.membresiasHoy > 0
        ? { text: `${signals.membresiasHoy} ${signals.membresiasHoy === 1 ? "pendiente" : "pendientes"}`, title: "Vencen hoy", warn: true }
        : { text: "Al día", title: "Al día", warn: false };
    }
    if (key === "caja") {
      return signals.cajaAbierta ? { text: "Abierta", title: "Caja abierta", warn: false } : { text: "Cerrada", title: "Sin turno", warn: true };
    }
    if (key === "whatsapp") {
      if (signals.whatsapp == null) return null;
      return signals.whatsapp ? { text: "Conectado", title: "Conectado", warn: false } : { text: "Desconectado", title: "Desconectado", warn: true };
    }
    return null;
  }

  function rememberNavScroll() {
    const el = navScrollRef.current;
    if (el) sessionStorage.setItem("gym-nav-scroll", String(el.scrollTop));
  }

  useLayoutEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const saved = Number(sessionStorage.getItem("gym-nav-scroll") || "0");
    if (saved > 0) el.scrollTop = saved;
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gym-black text-gym-silver">
      {menuOpen && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMenuOpen(false)} />}

      <nav
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(19.5rem,calc(100vw-3.25rem))] shrink-0 flex-col border-r border-gym-border/70 bg-gym-navy/95 shadow-panel backdrop-blur-xl transition-transform duration-200 md:static md:z-20 md:w-[240px] md:translate-x-0 md:bg-gym-navy/80 md:shadow-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
          <div className="flex flex-1 flex-col items-center">
            <a href="/" className="block h-[72px]">
              <BrandLogo variant="nav" className="h-full" />
            </a>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-gym-muted">Plataforma</div>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-gym-border/70 text-gym-silver md:hidden" aria-label="Cerrar menú">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div
          ref={navScrollRef}
          onScroll={rememberNavScroll}
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-2"
        >
          {NAV_GROUPS.map((group) => {
            const items = navItems.filter((n) => n.group === group);
            if (!items.length) return null;
            return (
            <div key={group} className="flex flex-col gap-1">
              <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gym-muted/70">{group}</div>
              {items.map((n) => {
                const isActive = active === n.key;
                const mark = navMark(n.key);
                return (
                  <a
                    key={n.key}
                    href={hrefFor(n.key)}
                    title={n.sub}
                    onClick={() => {
                      rememberNavScroll();
                      setMenuOpen(false);
                    }}
                    className={`flex h-10 items-center gap-2.5 rounded-xl px-3 text-left transition-colors ${
                      isActive
                        ? "bg-gradient-to-r from-gym-primaryDeep/25 to-gym-violet/10 text-gym-primary"
                        : "text-gym-muted hover:bg-gym-border/30 hover:text-gym-silver"
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? "drop-shadow-[0_0_6px_rgba(56,189,248,0.6)]" : ""}`}>{n.icon}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-none">{n.label}</span>
                    <span className={`w-2 shrink-0 text-right ${mark ? "" : "invisible"}`} aria-hidden={!mark}>
                      <span title={mark ? `${mark.title}. ${mark.text}` : undefined} className={`block h-2 w-2 rounded-full ${mark?.warn ? "bg-status-warn" : "bg-status-ok"}`} />
                    </span>
                  </a>
                );
              })}
            </div>
            );
          })}
          {soon.length > 0 && (
            <button type="button" onClick={() => setSoonOpen(true)} className="mx-2 mb-2 rounded-xl px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gym-muted/80 hover:bg-gym-border/30">
              Próximamente
            </button>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-2.5 border-t border-gym-border/60 px-4 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gym-primaryDeep to-gym-violet text-sm font-bold text-white">
              {user.nombre.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-gym-silver">{user.nombre}</div>
              <div className="text-[10px] capitalize text-gym-muted">{user.role}</div>
            </div>
            <button onClick={logout} title="Cerrar sesión" className="rounded-lg p-1.5 text-gym-muted transition-colors hover:bg-status-err/20 hover:text-status-err">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
            </button>
          </div>
        )}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        {process.env.NEXT_PUBLIC_GYM_DEMO_MODE === "1" && (
          <div className="shrink-0 border-b border-amber-400/40 bg-amber-500/15 px-3 py-2 text-center text-xs font-semibold text-amber-100 md:px-6">
            Entorno de demostración · Datos de ejemplo · Sin hardware, WhatsApp ni pagos reales
          </div>
        )}
        <header className="z-10 shrink-0 border-b border-gym-border/70 bg-gym-navy/60 backdrop-blur-xl">
          <div className="flex items-center gap-2 px-3 py-2.5 md:gap-3 md:px-6 md:py-3.5">
            <button onClick={() => setMenuOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gym-border/70 text-gym-silver hover:bg-gym-border/40 md:hidden" aria-label="Abrir menú">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[15px] font-extrabold leading-tight tracking-tight text-white">{current.label}</h1>
              <p className="mt-0.5 hidden truncate text-[11px] leading-snug text-gym-muted sm:block">{current.sub}</p>
            </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="relative">
              <button
                onClick={() => canSwitch && setGymMenu((v) => !v)}
                className={`flex h-10 items-center gap-2 rounded-xl border border-gym-border/70 bg-gym-panel/50 px-2 md:px-3 ${canSwitch ? "hover:border-gym-primary/60" : "cursor-default"}`}
                aria-label={gym?.name ?? "Selecciona gimnasio"}
              >
                <span className="grid h-6 w-6 shrink-0 overflow-hidden rounded-md bg-black ring-1 ring-gym-border">
                  {gym?.logo ? <img src={`/api/marca?gym=${encodeURIComponent(gym.id)}`} alt="" className="h-full w-full object-cover" /> : <BrandLogo variant="mark" />}
                </span>
                <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
                  <span className="max-w-[9rem] truncate text-xs font-semibold text-gym-silver md:max-w-[160px]">{gym?.brandName || gym?.name || "Selecciona gimnasio"}</span>
                  {gym?.city && gym.city !== "Sede principal" && <span className="max-w-[9rem] truncate text-[10px] text-gym-muted md:max-w-[160px]">{gym.city}</span>}
                </span>
                {canSwitch && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0 text-gym-muted"><path d="M6 9l6 6 6-6" /></svg>
                )}
              </button>
              {gymMenu && (
                <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-gym-border/80 bg-gym-panel/95 p-1.5 shadow-panel backdrop-blur-xl">
                  {gyms.map((g) => (
                    <button key={g.id} onClick={() => pickGym(g)} className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-gym-border/40 ${gym?.id === g.id ? "bg-gym-border/30" : ""}`}>
                      <span className="grid h-7 w-7 overflow-hidden rounded-md bg-black ring-1 ring-gym-border">
                        {g.logo ? <img src={`/api/marca?gym=${encodeURIComponent(g.id)}`} alt="" className="h-full w-full object-cover" /> : <BrandLogo variant="mark" />}
                      </span>
                      <span className="flex flex-1 flex-col leading-tight">
                        <span className="truncate text-xs font-semibold text-gym-silver">{g.name}</span>
                        <span className="text-[10px] text-gym-muted">{g.city}</span>
                      </span>
                      <span className={`h-2 w-2 rounded-full ${g.whatsapp === "conectado" ? "bg-status-ok" : "bg-gym-muted"}`} title={`WhatsApp ${g.whatsapp}`} />
                    </button>
                  ))}
                  <div className="mt-1 border-t border-gym-border/60 px-2.5 py-1.5 text-[10px] text-gym-muted">Solo ves los datos del gimnasio seleccionado.</div>
                </div>
              )}
            </div>

            {active !== "membresias" && active !== "torniquetes" && <div className="hidden items-center gap-2 rounded-lg border border-gym-border/70 bg-gym-panel/50 px-3 py-1.5 sm:flex" title="Acceso, reconocimiento y WhatsApp">
              <span className={`h-2.5 w-2.5 rounded-full ${health === "ok" ? "bg-status-ok" : health === "off" ? "bg-status-err" : "bg-status-warn"}`} />
              <span className="text-xs font-semibold text-gym-silver">
                {health === "ok" ? "Operativo" : health === "off" ? "Sin conexión" : health === "parcial" ? (signals?.accessOffline ? "Torniquete sin contacto" : signals?.whatsapp === false ? "WhatsApp desconectado" : "Revisar sistema") : "Revisando"}
              </span>
            </div>}
          </div>
          </div>
          <p className="line-clamp-2 px-3 pb-2.5 text-[12px] leading-snug text-gym-muted sm:hidden">{current.sub}</p>
          {gym?.name && (
            <button type="button" onClick={() => canSwitch && setGymMenu((v) => !v)} className="flex w-full items-center gap-2 border-t border-gym-border/50 px-3 py-2 text-left sm:hidden">
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gym-silver">{gym.name}</span>
              {gym.city && gym.city !== "Sede principal" && <span className="shrink-0 text-[10px] text-gym-muted">{gym.city}</span>}
            </button>
          )}
        </header>
        {notice && <a href="/cuenta" className="block border-b border-status-warn/40 bg-status-warn/10 px-4 py-2 text-sm text-status-warn">{notice}</a>}

        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <div className="pointer-events-none absolute inset-0 bg-gym-radial" />
          <div className="relative">{children}</div>
        </main>
      </div>
      {soonOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setSoonOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-gym-border bg-gym-navy p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gym-muted">Próximamente</div>
            <h2 className="mt-1 text-lg font-extrabold text-white">Lo que sigue en la plataforma</h2>
            <p className="mt-1 text-sm text-gym-silver">Todavía no están en operación. El menú de hoy solo muestra lo que ya funciona.</p>
            <ul className="mt-4 space-y-2">
              {soon.map((n) => (
                <li key={n.key} className="flex items-center gap-3 text-sm text-gym-silver">
                  <span className="text-gym-muted">{n.icon}</span>
                  <span>
                    <span className="font-semibold text-white">{n.label}</span>
                    <span className="mt-0.5 block text-[11px] text-gym-muted">{n.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setSoonOpen(false)} className="mt-4 rounded-xl border border-gym-border px-3 py-1.5 text-xs font-semibold text-gym-silver">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
