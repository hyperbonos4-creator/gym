"use client";

/**
 * Réplicas de las pantallas reales de URBAN del Capítulo 2.
 * - Kiosko de puerta: web/src/app/kiosk/page.tsx (cabecera, visor con HudCorners/FaceReticle/scanline,
 *   franja inferior con PHASE_THEME, IdentityPanel y CheckRow, pie de tecnologías).
 * - Centro de control del celador: (guardstation)/layout.tsx, GuardSidebar.tsx, GuardHeader.tsx,
 *   guardstation/face-access/page.tsx, components/access/FaceAccessFeed.tsx.
 * El video de la cámara del punto se representa con una ilustración (en el producto es MJPEG en vivo).
 */

import type { ReactNode } from "react";
import { DEMO } from "../../lib/urban/tour";
import { DATE_GUARD, DATE_KIOSK, GRANT_TIME, KIOSK, clockAt, type GuardView, type KioskView } from "../../lib/urban/tour2";
import { FaceArt } from "./Screens";

/* ---------- Iconos estilo Lucide ---------- */
const sv = (s: number, c: string, children: ReactNode, sw = 2) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
type IP = { s?: number; c?: string };
export const L = {
  scanFace: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" /></>),
  shieldCheck: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>),
  check2: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></>),
  clock: ({ s = 12, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>),
  logOut: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>),
  logIn: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></>),
  wifi: ({ s = 13, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0" /></>),
  siren: ({ s = 15, c = "currentColor" }: IP) => sv(s, c, <><path d="M7 18v-6a5 5 0 1 1 10 0v6M5 21a1 1 0 0 1-1-1v-1a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1zM21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.93 4.93l.71.71" /></>),
  video: ({ s = 14, c = "currentColor" }: IP) => sv(s, c, <><path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.44L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" /></>),
  bell: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><path d="M10.27 21a2 2 0 0 0 3.46 0M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" /></>),
  user: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  building: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" /></>),
  grid: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>),
  userPlus: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>),
  megaphone: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="m3 11 18-5v12L3 14v-3zM11.6 16.8a3 3 0 1 1-5.8-1.6" /></>),
  users: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  pkg: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8" /></>),
  cal: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
  alert: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01" /></>),
  phone: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92" />),
  chat: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />),
  search: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><circle cx="10" cy="7" r="4" /><path d="M10.3 15H7a4 4 0 0 0-4 4v2M15 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0M18.5 18.5 21 21" /></>),
  cog: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>),
  list: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01" /></>),
};

/* =================== KIOSKO · URBAN · Control de Acceso =================== */
const THEME = {
  SCANNING: { border: "#38bdf8", scrim: "linear-gradient(transparent, rgba(0,0,0,0.85))", fg: "#7dd3fc", glow: "rgba(56,189,248,0.25)", title: "Acérquese a la cámara", subtitle: "Mire al frente. Buscando un rostro…" },
  GRANTED: { border: "#22c55e", scrim: "linear-gradient(transparent, rgba(2,44,20,0.92))", fg: "#4ade80", glow: "rgba(34,197,94,0.3)", title: "Acceso concedido", subtitle: "Identidad verificada y prueba de vida superada." },
};

/** Ilustración del video de la cámara del punto (andén, reja y María acercándose). */
function CameraFeed({ face }: { face: number }) {
  const w = 12 + 30 * face; // % del ancho del visor
  return (
    <div className="uk-feed">
      <svg className="uk-feed-bg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="ukSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#273250" />
            <stop offset="0.55" stopColor="#4a4b66" />
            <stop offset="1" stopColor="#5d5a5f" />
          </linearGradient>
          <radialGradient id="ukLamp" cx="0.82" cy="0.18" r="0.35">
            <stop offset="0" stopColor="rgba(255,226,170,0.55)" />
            <stop offset="1" stopColor="rgba(255,226,170,0)" />
          </radialGradient>
        </defs>
        <rect width="160" height="90" fill="url(#ukSky)" />
        <rect y="52" width="160" height="38" fill="#7d7a76" />
        <rect y="70" width="160" height="2" fill="#a29d95" />
        <rect y="72" width="160" height="18" fill="#2b2e35" />
        {Array.from({ length: 26 }).map((_, i) => <rect key={i} x={i * 6.4} y="30" width="0.6" height="22" fill="#20242c" />)}
        <rect y="29" width="160" height="1.2" fill="#20242c" />
        <rect y="42" width="160" height="1" fill="#20242c" />
        <rect y="48" width="160" height="5" fill="#b9b2a6" />
        <rect width="160" height="90" fill="url(#ukLamp)" />
      </svg>
      {face > 0.01 && (
        <div className="uk-feed-face" style={{ width: `${w}%`, opacity: Math.min(1, face * 3) }}>
          <FaceArt w={220} />
        </div>
      )}
    </div>
  );
}

function HudCorners({ color }: { color: string }) {
  return (
    <div className="uk-hud">
      {["tl", "tr", "bl", "br"].map((k) => <span key={k} className={`uk-c uk-${k}`} style={{ borderColor: color }} />)}
    </div>
  );
}

function CheckRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="uk-row">
      <L.check2 c="#34d399" />
      <span className="uk-row-l">{label}</span>
      <span className="uk-row-d">{detail}</span>
    </div>
  );
}

export function KioskUI({ v, t, compact }: { v: KioskView; t: number; compact: boolean }) {
  const th = THEME[v.phase];
  const granted = v.phase === "GRANTED";
  const now = clockAt(t).h24;
  return (
    <div className={`uk-win ${compact ? "is-m" : ""}`} style={{ ["--glow" as any]: th.glow }}>
      <header className="uk-head">
        <div className="uk-logo"><L.scanFace s={24} c="#38bdf8" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>URBAN <span>· Control de Acceso</span></h1>
          <p>{KIOSK.point} · <span style={{ color: "#34d399" }}>● SISTEMA EN VIVO</span></p>
        </div>
        <div className="uk-clock">
          <b>{now}</b>
          <span>{DATE_KIOSK}</span>
        </div>
        <span className="uk-stop">Detener</span>
        <span className="uk-out"><L.logOut /></span>
      </header>
      <div className="uk-body">
        <div className="uk-grid">
          <div className="uk-visor" style={{ borderColor: th.border, boxShadow: `0 0 60px -10px ${th.glow}, inset 0 0 60px rgba(0,0,0,0.6)` }}>
            <CameraFeed face={v.face} />
            <HudCorners color={th.border} />
            {granted && (
              <div className="uk-reticle" style={{ left: "37.4%", width: "25.2%", bottom: "27.8%", height: "54.3%" }}>
                {["tl", "tr", "bl", "br"].map((k) => <span key={k} className={`uk-rc uk-${k}`} style={{ borderColor: th.border }} />)}
              </div>
            )}
            {!granted && <div className="uk-scanwrap"><div className="uk-scanline" /></div>}
            <div className="uk-scrim" style={{ background: th.scrim }}>
              {granted ? <L.shieldCheck s={30} c={th.fg} /> : <L.scanFace s={30} c={th.fg} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="uk-scrim-t" style={{ color: th.fg }}>{granted ? `Bienvenido, ${DEMO.maria}` : th.title}</p>
                <p className="uk-scrim-s">{th.subtitle}</p>
              </div>
              <span className="uk-rec">● REC</span>
            </div>
          </div>
          {granted ? (
            <div className="uk-card" key="card" style={{ borderColor: th.border }}>
              <div className="uk-id">
                <div className="uk-av" style={{ borderColor: th.border, color: th.fg }}>MR</div>
                <div style={{ minWidth: 0 }}>
                  <p className="uk-name">{DEMO.maria}</p>
                  <div className="uk-tags">
                    <span className="uk-role">{KIOSK.role}</span>
                    <span className="uk-apto">Apto {KIOSK.apto}</span>
                  </div>
                </div>
              </div>
              <div className="uk-stamp">
                <L.shieldCheck s={28} c={th.fg} />
                <div>
                  <p style={{ color: th.fg }}>ACCESO CONCEDIDO</p>
                  <span>Identidad y prueba de vida verificadas</span>
                </div>
              </div>
              <div className="uk-rows">
                <CheckRow label="Identidad biométrica (1:N)" detail={`${Math.round(KIOSK.matchScore * 100)}% · umbral ${Math.round(KIOSK.matchThreshold * 100)}%`} />
                <CheckRow label="Prueba de vida · anti-spoofing" detail={`Rostro real · ${Math.round(KIOSK.livenessScore * 100)}%`} />
                <CheckRow label="Autorización en el punto" detail="Vigente" />
                <CheckRow label="Apertura de puerta" detail="Accionada" />
              </div>
              <div className="uk-meta">
                <span><L.clock /> {GRANT_TIME.h24}</span>
                <span style={{ textAlign: "right" }}>{KIOSK.point}</span>
                <span className="uk-evt">evt {KIOSK.evt}</span>
              </div>
            </div>
          ) : (
            <div className="uk-idle" key="idle">
              <div className="uk-pulse" style={{ color: th.fg }}><L.scanFace s={64} /></div>
              <p style={{ color: th.fg }}>{th.title}</p>
              <span>{th.subtitle}</span>
            </div>
          )}
        </div>
      </div>
      <footer className="uk-foot">Reconocimiento 1:N (ArcFace) · Anti-spoofing (MiniFASNet ensemble) · Decisión fail-secure · Video MJPEG en vivo</footer>
    </div>
  );
}

/* =================== Centro de control · Acceso facial =================== */
export const GNAV: [string, (p: IP) => JSX.Element, string?][] = [
  ["Dashboard", L.grid],
  ["Registrar visitante", L.userPlus, "ok"],
  ["Comunicados", L.megaphone],
  ["Ingresos", L.logIn],
  ["Salidas", L.logOut],
  ["Historial", L.users],
  ["Paquetería", L.pkg],
  ["Reservas", L.cal],
  ["Incidentes", L.alert, "bad"],
  ["Alertas", L.siren, "bad"],
  ["Llamadas", L.phone, "ok"],
  ["Chat", L.chat],
  ["Cámaras", L.video],
  ["Acceso facial", L.scanFace],
  ["Residentes", L.search],
  ["Supervisores", L.cog],
  ["Bitácora", L.list],
  ["Notificaciones", L.bell],
  ["Configuración", L.cog],
];

export function GuardPanel({ v, t, compact }: { v: GuardView; t: number; compact: boolean }) {
  const now = clockAt(t).h12pad;
  return (
    <div className="uw-win">
      <div className="uw-chrome">
        <i /><i /><i />
        <span className="uw-url">/guardstation/face-access</span>
      </div>
      <div className="uw-app">
        {!compact && (
          <aside className="uw-side">
            <div className="uw-side-h" style={{ height: 64 }}>
              <span className="uw-side-logo"><L.building /></span>
              <div>
                <div className="uw-b uw-sm">URBAN</div>
                <div className="uw-muted uw-xs">Centro de Control</div>
              </div>
            </div>
            <nav className="ug-nav">
              <div className="ug-nav-in">
                {GNAV.map(([l, Ic]) => (
                  <div key={l} className={`ug-nav-i ${l === "Acceso facial" ? "on" : ""}`}>
                    <Ic s={20} /> <span>{l}</span>
                  </div>
                ))}
              </div>
            </nav>
          </aside>
        )}
        <div className="uw-main">
          <header className="ug-top">
            <div>
              <div className="uw-b uw-sm">URBAN — Centro de Control</div>
              <div className="uw-muted" style={{ fontSize: 11 }}>Turno Tarde · {DATE_GUARD}</div>
            </div>
            {!compact && (
              <div className="ug-clock">
                <b>{now}</b>
                <span>Hora local</span>
              </div>
            )}
            <span style={{ flex: 1 }} />
            {!compact && <span className="ug-sos"><i /> <L.siren /> Activar alerta</span>}
            <span className="ug-live"><L.wifi s={14} /> {!compact && "En vivo"} <i /></span>
            {!compact && <span className="ug-cams"><L.video /> 0 cámaras</span>}
            <span className="uw-top-ic"><L.bell /></span>
            <span className="ug-user">
              <span className="ug-av"><L.user /></span>
              {!compact && (
                <span className="ug-user-t">
                  <b>{DEMO.carlos}</b>
                  <span>GUARD</span>
                </span>
              )}
            </span>
          </header>
          <div className="ug-content">
            <div className="uw-ph">
              <span className="uw-ph-ic"><L.scanFace s={22} /></span>
              <div>
                <h1>Acceso facial</h1>
                <p>Reconocimiento en tiempo real. Las denegaciones permiten apertura manual con tu autorización.</p>
              </div>
            </div>
            <div><span className="ug-chip"><L.wifi /> En vivo</span></div>
            <ul className="ug-list">
              <li className={`ug-ev ${v.fresh > 0.05 ? "is-new" : ""}`} style={{ ["--f" as any]: v.fresh }}>
                <span className="ug-ev-ic"><L.shieldCheck s={20} c="#22C55E" /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="ug-ev-n">Residente</p>
                  <p className="ug-ev-d">Identidad verificada · puerta abierta · {GRANT_TIME.h12}</p>
                </div>
                <span className="ug-ev-b">CONCEDIDO</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
