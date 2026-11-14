"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BEATS, STEPS, TOUR_END, adminAt, beatAt, phoneAt, type AdminView, type PhoneView } from "../../lib/urban/tour";
import type { UrbanClock } from "./UrbanWorld3D";
import { AdminPanel, PhoneScreen } from "./Screens";
import { BEATS2, STEPS2, TOUR_END2, beatAt2, guardAt, kioskAt, type GuardView, type KioskView } from "../../lib/urban/tour2";
import { GuardPanel, KioskUI } from "./Screens2";
import { BEATS3, STEPS3, TOUR_END3, beatAt3, guardAt3, kioskAt3, type GuardView3, type KioskView3 } from "../../lib/urban/tour3";
import { GuardPanel3, KioskUI3 } from "./Screens3";
import { BEATS4, STEPS4, TOUR_END4, beatAt4, guardAt4, phoneAt4, type GuardView4, type PhoneView4 } from "../../lib/urban/tour4";
import { GuardPanel4, PhoneScreen4 } from "./Screens4";

type Ch = 1 | 2 | 3 | 4;
const TOURS = {
  1: { BEATS, STEPS, END: TOUR_END, beatAt, title: "Verificación de identidad" },
  2: { BEATS: BEATS2, STEPS: STEPS2, END: TOUR_END2, beatAt: beatAt2, title: "Entra con su rostro" },
  3: { BEATS: BEATS3, STEPS: STEPS3, END: TOUR_END3, beatAt: beatAt3, title: "Cuando la puerta no abre" },
  4: { BEATS: BEATS4, STEPS: STEPS4, END: TOUR_END4, beatAt: beatAt4, title: "Invitados, sin códigos" },
} as const;

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
  { n: 2, t: "Entra con su rostro", d: "El kiosko de la portería la reconoce, muestra ACCESO CONCEDIDO y el relé acciona el torniquete.", on: true },
  { n: 3, t: "Cuando la puerta no abre", d: "Una foto en un celular o un rostro desconocido: ACCESO DENEGADO y el torniquete sigue bloqueado. El celador verifica en persona, abre con el relé y queda registrado.", on: true },
  { n: 4, t: "Invitados, sin códigos", d: "El residente invita desde la app, el celador autoriza el ingreso y el residente recibe una notificación cuando su invitado entra y sale.", on: true },
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
  const guardScale = mobile ? adminScale : Math.min((vp.w * 0.68) / 1300, (vp.h - 250) / 660, 1);
  const kioskScale = mobile ? Math.min((vp.w * 0.94) / 520, (vp.h - 92 - 212) / 960) : Math.min((vp.w * 0.6) / 1120, (vp.h - 250) / 640, 1);
  const clock = useMemo<UrbanClock>(() => ({ t: 0, touring: false, mobile: false, mode: "hero", ch: 1 }), []);
  clock.mobile = mobile;
  const [ch, setCh] = useState<Ch>(1);
  clock.ch = ch;
  const TT = TOURS[ch];
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
    if (q.get("ch") === "2") setCh(2);
    if (q.get("ch") === "3") setCh(3);
    if (q.get("ch") === "4") setCh(4);
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
        if (tRef.current >= TOURS[(clock.ch ?? 1) as Ch].END) {
          tRef.current = TOURS[(clock.ch ?? 1) as Ch].END;
          setEnded(true);
        }
      }
      clock.t = tRef.current;
      if (progRef.current) progRef.current.style.width = `${(tRef.current / TOURS[(clock.ch ?? 1) as Ch].END) * 100}%`;
      const key = (tRef.current * 20) | 0;
      if (String(key) !== lastKey.current) {
        lastKey.current = String(key);
        setTick(key);
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [mode, playing, ended, clock, ch]);

  const startTour = useCallback((n: Ch = 1) => {
    setCh(n);
    clock.ch = n;
    tRef.current = 0;
    clock.t = 0;
    setEnded(false);
    setPlaying(true);
    setMode("tour");
  }, [clock]);
  const seek = useCallback(
    (t: number) => {
      tRef.current = Math.max(0, Math.min(TOURS[(clock.ch ?? 1) as Ch].END - 0.01, t));
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
  const bi = TT.beatAt(t);
  const beat = TT.BEATS[bi];
  const phone: PhoneView | null = mode === "tour" && ch === 1 ? phoneAt(t) : null;
  const admin: AdminView | null = mode === "tour" && ch === 1 ? adminAt(t) : null;
  const kiosk: KioskView | null = mode === "tour" && ch === 2 ? kioskAt(t) : null;
  const guard: GuardView | null = mode === "tour" && ch === 2 ? guardAt(t) : null;
  const kiosk3: KioskView3 | null = mode === "tour" && ch === 3 ? kioskAt3(t) : null;
  const guard3: GuardView3 | null = mode === "tour" && ch === 3 ? guardAt3(t) : null;
  const phone4: PhoneView4 | null = mode === "tour" && ch === 4 ? phoneAt4(t) : null;
  const guard4: GuardView4 | null = mode === "tour" && ch === 4 ? guardAt4(t) : null;
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
            <button className="ur-btn ur-btn-xl" onClick={() => startTour(1)}>▶ Ver capítulo 1</button>
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
              <div>{mode === "tour" ? `URBAN · Capítulo ${ch}` : "URBAN · Explorar"}</div>
              <b>{mode === "tour" ? TT.title : "Arrastra para girar · pellizca o rueda para acercar"}</b>
            </div>
            <span style={{ flex: 1 }} />
            {mode === "explore" && <button className="ur-btn ur-btn-sm" onClick={() => startTour(1)}>▶ Capítulo 1</button>}
            {mode === "explore" && <button className="ur-btn ur-btn-sm" onClick={() => startTour(2)}>▶ Capítulo 2</button>}
            {mode === "explore" && <button className="ur-btn ur-btn-sm" onClick={() => startTour(3)}>▶ Capítulo 3</button>}
            {mode === "explore" && <button className="ur-btn ur-btn-sm" onClick={() => startTour(4)}>▶ Capítulo 4</button>}
            <button className="ur-x" onClick={exit} aria-label="Salir">×</button>
          </div>

          {mode === "tour" && !ended && (
            <>
              <div className={`ur-caption ${admin || guard || guard3 || guard4 ? "is-admin" : ""}`} key={`${ch}-${beat.id}`}>
                <div className="ur-caption-k">Paso {beat.step + 1} de {TT.STEPS.length} · {TT.STEPS[beat.step]}</div>
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
              {kiosk && (
                <div className="ur-kiosk-wrap" style={{ ["--ks" as any]: kioskScale }}>
                  <KioskUI v={kiosk} t={t} compact={mobile} />
                </div>
              )}
              {guard && (
                <div className={`ur-admin-wrap ur-guard-wrap ${mobile ? "is-m" : ""}`} style={{ ["--as" as any]: guardScale }}>
                  <GuardPanel v={guard} t={t} compact={mobile} />
                </div>
              )}
              {kiosk3 && (
                <div className="ur-kiosk-wrap" style={{ ["--ks" as any]: kioskScale }}>
                  <KioskUI3 v={kiosk3} t={t} compact={mobile} />
                </div>
              )}
              {guard3 && (
                <div className={`ur-admin-wrap ur-guard-wrap ${mobile ? "is-m" : ""}`} style={{ ["--as" as any]: guardScale }}>
                  <GuardPanel3 v={guard3} t={t} compact={mobile} />
                </div>
              )}
              {phone4 && (
                <div className="ur-phone-wrap" key="ph4" style={{ ["--ps" as any]: phoneScale }}>
                  <PhoneScreen4 v={phone4} />
                </div>
              )}
              {guard4 && (
                <div className={`ur-admin-wrap ur-guard-wrap ${mobile ? "is-m" : ""}`} key={`g4-${guard4.page}`} style={{ ["--as" as any]: guardScale }}>
                  <GuardPanel4 v={guard4} compact={mobile} />
                </div>
              )}
            </>
          )}

          {mode === "tour" && ended && ch === 1 && (
            <div className="ur-end">
              <img src="/brand/vx-icon-color.svg" alt="" />
              <div className="ur-end-k">Capítulo 1 completo</div>
              <h2>María ya puede entrar con su rostro.</h2>
              <p>Su identidad quedó verificada con documento, prueba de vida y aprobación de la administración.</p>
              <div className="ur-cta-row ur-center">
                <a className="ur-btn" href={contact} target="_blank" rel="noopener noreferrer">Agendar demo de URBAN</a>
                <button className="ur-btn-ghost" onClick={() => startTour(1)}>↺ Repetir</button>
                <button className="ur-btn-ghost" onClick={() => startTour(2)}>Capítulo 2 · Entra con su rostro →</button>
              </div>
            </div>
          )}
          {mode === "tour" && ended && ch === 2 && (
            <div className="ur-end">
              <img src="/brand/vx-icon-color.svg" alt="" />
              <div className="ur-end-k">Capítulo 2 completo</div>
              <h2>Su rostro abrió la puerta.</h2>
              <p>El kiosko la reconoció con prueba de vida, el relé accionó el torniquete y el celador vio el ingreso en vivo, con su motivo.</p>
              <div className="ur-cta-row ur-center">
                <a className="ur-btn" href={contact} target="_blank" rel="noopener noreferrer">Agendar demo de URBAN</a>
                <button className="ur-btn-ghost" onClick={() => startTour(2)}>↺ Repetir</button>
                <button className="ur-btn-ghost" onClick={() => startTour(3)}>Capítulo 3 · Cuando la puerta no abre →</button>
              </div>
            </div>
          )}
          {mode === "tour" && ended && ch === 3 && (
            <div className="ur-end">
              <img src="/brand/vx-icon-color.svg" alt="" />
              <div className="ur-end-k">Capítulo 3 completo</div>
              <h2>Si algo no cuadra, no abre.</h2>
              <p>Una foto no pasa, un rostro desconocido tampoco. El celador decide con su autorización y cada apertura queda registrada con su motivo.</p>
              <div className="ur-cta-row ur-center">
                <a className="ur-btn" href={contact} target="_blank" rel="noopener noreferrer">Agendar demo de URBAN</a>
                <button className="ur-btn-ghost" onClick={() => startTour(3)}>↺ Repetir</button>
                <button className="ur-btn-ghost" onClick={() => startTour(4)}>Capítulo 4 · Invitados, sin códigos →</button>
              </div>
            </div>
          )}
          {mode === "tour" && ended && ch === 4 && (
            <div className="ur-end">
              <img src="/brand/vx-icon-color.svg" alt="" />
              <div className="ur-end-k">Capítulo 4 completo</div>
              <h2>Sin códigos que compartir.</h2>
              <p>María invita desde la app, Carlos verifica en persona y autoriza, y ella recibe un aviso cuando su invitado entra y cuando sale.</p>
              <div className="ur-cta-row ur-center">
                <a className="ur-btn" href={contact} target="_blank" rel="noopener noreferrer">Agendar demo de URBAN</a>
                <button className="ur-btn-ghost" onClick={() => startTour(4)}>↺ Repetir</button>
                <button className="ur-btn-ghost" disabled>Capítulo 5 · Próximamente</button>
              </div>
            </div>
          )}

          {mode === "tour" && (
            <div className="ur-bar">
              <div className="ur-steps">
                {TT.STEPS.map((s, i) => {
                  const first = TT.BEATS.find((b) => b.step === i)!;
                  return (
                    <button key={s} className={`${i === beat.step ? "on" : ""} ${i < beat.step ? "done" : ""}`} onClick={() => seek(first.t0)}>
                      <i>{i + 1}</i>
                      <span>{s}</span>
                    </button>
                  );
                })}
              </div>
              <div className="ur-ctrl">
                <button onClick={() => (ended ? startTour(ch) : setPlaying((p) => !p))} aria-label={playing ? "Pausar" : "Reproducir"}>
                  {ended ? "↺" : playing ? "❚❚" : "▶"}
                </button>
                <div
                  className="ur-prog"
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    seek(((e.clientX - r.left) / r.width) * TT.END);
                  }}
                >
                  <div ref={progRef} style={{ width: `${(t / TT.END) * 100}%` }} />
                </div>
                <span className="ur-time">{fmt(t)} / {fmt(TT.END)}</span>
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
                <button className="ur-btn ur-btn-sm" onClick={() => startTour(c.n as Ch)}>▶ Ver ahora</button>
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
