"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BEATS, STEPS, TOUR_END, adminAt, beatAt, phoneAt, type AdminView, type PhoneView } from "../../lib/urban/tour";
import type { UrbanClock } from "./UrbanWorld3D";
import { AdminPanel, PhoneScreen } from "./Screens";

const UrbanWorld3D = dynamic(() => import("./UrbanWorld3D"), {
  ssr: false,
  loading: () => (
    <div className="ur-loading">
      <span />
      Cargando conjunto 3D…
    </div>
  ),
});

const CHAPTERS = [
  { n: 1, t: "Verificación de identidad", d: "María entra a la app con su correo, autoriza el tratamiento de sus datos (Ley 1581), fotografía su documento, supera la prueba de vida en vivo y la administración aprueba.", on: true },
  { n: 2, t: "Entra con su rostro", d: "El kiosko de la portería la reconoce, muestra ACCESO CONCEDIDO y el relé acciona el torniquete." },
  { n: 3, t: "Cuando la puerta no abre", d: "Persona desconocida, posible suplantación o sin autorización: ACCESO DENEGADO. El celador puede abrir a mano y queda registrado." },
  { n: 4, t: "Invitados", d: "El residente invita desde la app, el celador autoriza el ingreso y el residente recibe una notificación cuando su invitado entra y sale." },
  { n: 5, t: "Un paquete en portería", d: "El celador registra el paquete, al residente le llega «Tienes un paquete» y lo retira mostrando su documento." },
  { n: 6, t: "La caseta en vivo", d: "Muro de cámaras, el televisor de la portería y la llamada de voz entre el celador y el residente." },
  { n: 7, t: "Administración", d: "Torres y apartamentos, padrón facial, aprobaciones, puntos de acceso y auditoría, desde el panel web." },
];

const PIECES = [
  { k: "App del residente", d: "Android e iOS. Verificación de identidad guiada, invitaciones, paquetes, comunicados, incidentes, reservas, documentos y llamadas a portería.", c: "#3B82F6" },
  { k: "Kiosko facial en la puerta", d: "Reconoce al residente, revisa prueba de vida, consentimiento, autorización y horario del punto. Solo entonces abre.", c: "#22C55E" },
  { k: "Centro de control del celador", d: "Accesos en tiempo real, visitantes, paquetes, cámaras en vivo y apertura manual con registro.", c: "#F59E0B" },
  { k: "Panel de administración", d: "Torres y apartamentos, residentes, usuarios y roles, acceso facial con doble aprobación, cámaras y auditoría.", c: "#A78BFA" },
];

const TRUST = [
  ["Ley 1581", "Sin autorización expresa del residente, no se toca su rostro."],
  ["Prueba de vida", "Reto en vivo con orden aleatorio: una foto o una pantalla no pasan."],
  ["Doble aprobación", "Una persona de la administración revisa y aprueba cada registro."],
  ["Falla segura", "Si algo no cuadra, la puerta no abre. Cada intento queda con su motivo."],
];

function useViewport() {
  const [v, setV] = useState({ w: 1280, h: 800 });
  useEffect(() => {
    const f = () => setV({ w: window.innerWidth, h: window.innerHeight });
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return v;
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function UrbanLanding({ contactUrl }: { contactUrl: string }) {
  const vp = useViewport();
  const mobile = vp.w < 760;
  const phoneScale = mobile ? Math.min((vp.h * 0.5) / 812, (vp.w * 0.6) / 375) : Math.min(1, (vp.h - 200) / 812);
  const adminScale = mobile ? (vp.w * 0.95) / 560 : Math.min((vp.w * 0.72) / 1080, (vp.h - 250) / 660, 1);
  const clock = useMemo<UrbanClock>(() => ({ t: 0, touring: false, mobile: false, mode: "hero" }), []);
  clock.mobile = mobile;
  const [mode, setMode] = useState<"hero" | "explore" | "tour">("hero");
  const [webgl, setWebgl] = useState(true);
  const [heroOn, setHeroOn] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [capture, setCapture] = useState(false);
  const [tick, setTick] = useState(0);
  const tRef = useRef(0);
  const heroRef = useRef<HTMLDivElement>(null);
  const progRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setWebgl(false);
    }
    const q = new URLSearchParams(window.location.search);
    if (q.get("capture") === "1") setCapture(true);
    if (q.get("tour") === "1") {
      const t = Number(q.get("t") || 0);
      tRef.current = Number.isFinite(t) ? t : 0;
      clock.t = tRef.current;
      setMode("tour");
      if (q.get("pause") === "1") setPlaying(false);
    }
  }, [clock]);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setHeroOn(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    clock.mode = mode;
    clock.touring = mode === "tour";
    document.body.style.overflow = mode === "hero" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mode, clock]);

  // Reloj del recorrido
  const lastKey = useRef("");
  useEffect(() => {
    if (mode !== "tour") return;
    let id = 0;
    let prev = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (playing && !ended) {
        tRef.current += dt;
        if (tRef.current >= TOUR_END) {
          tRef.current = TOUR_END;
          setEnded(true);
        }
      }
      clock.t = tRef.current;
      if (progRef.current) progRef.current.style.width = `${(tRef.current / TOUR_END) * 100}%`;
      const key = (tRef.current * 20) | 0;
      if (String(key) !== lastKey.current) {
        lastKey.current = String(key);
        setTick(key);
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [mode, playing, ended, clock]);

  const startTour = useCallback(() => {
    tRef.current = 0;
    clock.t = 0;
    setEnded(false);
    setPlaying(true);
    setMode("tour");
  }, [clock]);
  const seek = useCallback(
    (t: number) => {
      tRef.current = Math.max(0, Math.min(TOUR_END - 0.01, t));
      clock.t = tRef.current;
      setEnded(false);
      setTick((x) => x + 1);
    },
    [clock],
  );
  const exit = useCallback(() => {
    setMode("hero");
    setEnded(false);
  }, []);

  useEffect(() => {
    if (mode === "hero") return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") exit();
      if (e.key === " " && mode === "tour") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [mode, exit]);

  const t = tRef.current;
  const bi = beatAt(t);
  const beat = BEATS[bi];
  const phone: PhoneView | null = mode === "tour" ? phoneAt(t) : null;
  const admin: AdminView | null = mode === "tour" ? adminAt(t) : null;
  void tick;

  const full = mode !== "hero";
  const contact = contactUrl || "https://wa.me/573218559425?text=Hola%2C%20quiero%20agendar%20una%20demo%20de%20URBAN";

  return (
    <main className={`ur-root ${capture ? "ur-capture" : ""}`}>
      <header className="ur-nav">
        <a href="#top" className="ur-brand">
          <img src="/brand/vx-icon-color.svg" alt="" />
          <span>VISIONYX</span>
          <em>· URBAN</em>
        </a>
        <nav>
          <a href="#capitulos">Capítulos</a>
          <a href="#producto">Producto</a>
          <a href={contact} className="ur-btn ur-btn-sm" target="_blank" rel="noopener noreferrer">Agendar demo</a>
        </nav>
      </header>

      <section id="top" className="ur-hero">
        <div className="ur-hero-copy">
          <div className="ur-kicker">VISIONYX · URBAN</div>
          <h1 className="ur-h1">
            La portería de tu conjunto,<br />
            <span className="ur-grad">ahora con identidad.</span>
          </h1>
          <p className="ur-sub">
            URBAN conecta la app del residente, el kiosko facial de la puerta, la caseta del celador y la administración. Recórrelo en 3D, tal como funciona el software.
          </p>
          <div className="ur-cta-row">
            <button className="ur-btn ur-btn-xl" onClick={startTour}>▶ Ver capítulo 1</button>
            <button className="ur-btn-ghost" onClick={() => setMode("explore")}>Explorar en 3D</button>
          </div>
          <div className="ur-tag">Inteligencia que conecta el mundo real</div>
        </div>
        <div className="ur-hero-3d" ref={heroRef}>
          <div className={full ? "ur-world ur-world-full" : "ur-world"}>
            {webgl ? (
              <UrbanWorld3D clock={clock} active={full || heroOn} explore={mode === "explore"} capture={capture} />
            ) : (
              <div className="ur-poster">Tu navegador no soporta WebGL</div>
            )}
            {!full && (
              <button className="ur-enter" onClick={() => setMode("explore")} aria-label="Explorar el conjunto en 3D">
                <span>Conjunto URBAN · simulación 3D</span>
                <b>Explorar →</b>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* HUD pantalla completa */}
      {full && (
        <div className={`ur-hud ${mode === "tour" ? "is-tour" : ""}`}>
          <div className="ur-hud-top">
            <img src="/brand/vx-icon-color.svg" alt="" className="ur-hud-logo" />
            <div className="ur-hud-title">
              <div>{mode === "tour" ? "URBAN · Capítulo 1" : "URBAN · Explorar"}</div>
              <b>{mode === "tour" ? "Verificación de identidad" : "Arrastra para girar · pellizca o rueda para acercar"}</b>
            </div>
            <span style={{ flex: 1 }} />
            {mode === "explore" && <button className="ur-btn ur-btn-sm" onClick={startTour}>▶ Capítulo 1</button>}
            <button className="ur-x" onClick={exit} aria-label="Salir">×</button>
          </div>

          {mode === "tour" && !ended && (
            <>
              <div className={`ur-caption ${admin ? "is-admin" : ""}`} key={beat.id}>
                <div className="ur-caption-k">Paso {beat.step + 1} de {STEPS.length} · {STEPS[beat.step]}</div>
                <div className="ur-caption-t">{beat.title}</div>
                <div className="ur-caption-d">{beat.text}</div>
              </div>
              {phone && (
                <div className="ur-phone-wrap" key={phone.s === "wa" ? "ph-wa" : "ph-app"} style={{ ["--ps" as any]: phoneScale }}>
                  <PhoneScreen v={phone} t={t} />
                </div>
              )}
              {admin && (
                <div className={`ur-admin-wrap ${mobile ? "is-m" : ""}`} style={{ ["--as" as any]: adminScale }}>
                  <AdminPanel v={admin} compact={mobile} />
                </div>
              )}
            </>
          )}

          {mode === "tour" && ended && (
            <div className="ur-end">
              <img src="/brand/vx-icon-color.svg" alt="" />
              <div className="ur-end-k">Capítulo 1 completo</div>
              <h2>María ya puede entrar con su rostro.</h2>
              <p>Su identidad quedó verificada con documento, prueba de vida y aprobación de la administración.</p>
              <div className="ur-cta-row ur-center">
                <a className="ur-btn" href={contact} target="_blank" rel="noopener noreferrer">Agendar demo de URBAN</a>
                <button className="ur-btn-ghost" onClick={startTour}>↺ Repetir</button>
                <button className="ur-btn-ghost" disabled>Capítulo 2 · Próximamente</button>
              </div>
            </div>
          )}

          {mode === "tour" && (
            <div className="ur-bar">
              <div className="ur-steps">
                {STEPS.map((s, i) => {
                  const first = BEATS.find((b) => b.step === i)!;
                  return (
                    <button key={s} className={`${i === beat.step ? "on" : ""} ${i < beat.step ? "done" : ""}`} onClick={() => seek(first.t0)}>
                      <i>{i + 1}</i>
                      <span>{s}</span>
                    </button>
                  );
                })}
              </div>
              <div className="ur-ctrl">
                <button onClick={() => (ended ? startTour() : setPlaying((p) => !p))} aria-label={playing ? "Pausar" : "Reproducir"}>
                  {ended ? "↺" : playing ? "❚❚" : "▶"}
                </button>
                <div
                  className="ur-prog"
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    seek(((e.clientX - r.left) / r.width) * TOUR_END);
                  }}
                >
                  <div ref={progRef} style={{ width: `${(t / TOUR_END) * 100}%` }} />
                </div>
                <span className="ur-time">{fmt(t)} / {fmt(TOUR_END)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <section id="capitulos" className="ur-sec">
        <div className="ur-kicker">Recorridos guiados</div>
        <h2 className="ur-h2">Siete capítulos, un conjunto real.</h2>
        <p className="ur-sub">Cada capítulo muestra un flujo del software con sus pantallas y textos reales. Nada inventado.</p>
        <div className="ur-chapters">
          {CHAPTERS.map((c) => (
            <div key={c.n} className={`ur-ch ${c.on ? "is-on" : ""}`}>
              <div className="ur-ch-n">{String(c.n).padStart(2, "0")}</div>
              <div className="ur-ch-t">{c.t}</div>
              <div className="ur-ch-d">{c.d}</div>
              {c.on ? (
                <button className="ur-btn ur-btn-sm" onClick={startTour}>▶ Ver ahora</button>
              ) : (
                <span className="ur-soon">Próximamente</span>
              )}
            </div>
          ))}
        </div>
      </section>

      <section id="producto" className="ur-sec">
        <div className="ur-kicker">El producto</div>
        <h2 className="ur-h2">Cuatro piezas, una sola plataforma.</h2>
        <div className="ur-pieces">
          {PIECES.map((p) => (
            <div key={p.k} className="ur-piece" style={{ ["--c" as any]: p.c }}>
              <i />
              <div className="ur-piece-t">{p.k}</div>
              <div className="ur-piece-d">{p.d}</div>
            </div>
          ))}
        </div>
        <div className="ur-trust">
          {TRUST.map(([a, b]) => (
            <div key={a}>
              <b>{a}</b>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="ur-cta">
        <img src="/brand/vx-icon-color.svg" alt="" className="ur-cta-logo" />
        <h2 className="ur-h2 ur-center">
          Tu conjunto,<br />
          <span className="ur-grad">con portería inteligente.</span>
        </h2>
        <p className="ur-sub ur-center">Te mostramos URBAN funcionando con tus torres, tus puntos de acceso y tu equipo de portería.</p>
        <div className="ur-cta-row ur-center">
          <a href={contact} className="ur-btn ur-btn-xl" target="_blank" rel="noopener noreferrer">Agendar demo por WhatsApp →</a>
          <a href="/gemelo" className="ur-btn-ghost">Ver VISIONYX para gimnasios</a>
        </div>
        <img src="/brand/vx-horizontal-color.svg" alt="VISIONYX" className="ur-cta-brand" />
        <div className="ur-tag ur-center">Inteligencia que conecta el mundo real</div>
      </section>
      <footer className="ur-foot">Este conjunto no existe: es una simulación con datos de demostración. El software sí. · © VISIONYX</footer>
    </main>
  );
}
