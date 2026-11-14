"use client";

/**
 * Pantallas reales de URBAN del Capítulo 3 (denegaciones y apertura manual).
 * - Kiosko: web/src/app/kiosk/page.tsx — PHASE_THEME.DENIED, IdentityPanel (nombre «Desconocido» si no
 *   hay sujeto), CheckRow (XCircle rojo cuando falla), sello «ACCESO DENEGADO» + reasonLabel.
 * - Celador: FaceAccessFeed.tsx — fila DENIED con ShieldAlert, «DENEGADO» y botón «Abrir» (DoorOpen),
 *   «Abriendo…» mientras responde; el evento manual entra arriba como CONCEDIDO.
 */

import { DEMO } from "../../lib/urban/tour";
import { DATE_GUARD3, DATE_KIOSK3, T_SPOOF, T_UNK, T_MANUAL, clock3, type GuardView3, type KioskView3 } from "../../lib/urban/tour3";
import { GNAV, L } from "./Screens2";

const KP = "Peatonal principal";
const TH = {
  SCANNING: { border: "#38bdf8", scrim: "linear-gradient(transparent, rgba(0,0,0,0.85))", fg: "#7dd3fc", glow: "rgba(56,189,248,0.25)", title: "Acérquese a la cámara", subtitle: "Mire al frente. Buscando un rostro…" },
  DENIED: { border: "#ef4444", scrim: "linear-gradient(transparent, rgba(60,8,8,0.92))", fg: "#f87171", glow: "rgba(239,68,68,0.3)", title: "Acceso denegado", subtitle: "No se concede el acceso." },
};

const I3 = {
  shieldAlert: ({ s = 24, c = "currentColor" }: { s?: number; c?: string }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  xCircle: ({ s = 18, c = "currentColor" }: { s?: number; c?: string }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  ),
  door: ({ s = 14, c = "currentColor" }: { s?: number; c?: string }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01M13 4.56v16.157a.5.5 0 0 1-.646.479l-4.708-1.39A2 2 0 0 1 6.3 17.89V5.62a2 2 0 0 1 1.341-1.888l4.708-1.39A.5.5 0 0 1 13 2.82z" />
    </svg>
  ),
};

/** Rostro ilustrado genérico (colores por persona). */
function Face({ skin, hair, shirt, hood = false }: { skin: string; hair: string; shirt: string; hood?: boolean }) {
  return (
    <svg viewBox="0 0 220 280" aria-hidden style={{ width: "100%", height: "auto", display: "block" }}>
      <path d="M20 280c6-56 44-80 90-80s84 24 90 80z" fill={shirt} />
      {hood && <path d="M40 200c0-110 30-170 70-170s70 60 70 170c-20-30-40-40-70-40s-50 10-70 40z" fill={shirt} />}
      <rect x="92" y="170" width="36" height="40" rx="14" fill={skin} />
      <ellipse cx="110" cy="118" rx="62" ry="78" fill={skin} />
      {!hood && <path d="M48 104c0-48 26-70 62-70s62 22 62 70c-10-24-30-36-62-36s-52 12-62 36z" fill={hair} />}
      <ellipse cx="86" cy="120" rx="8" ry="6" fill="#1a1410" />
      <ellipse cx="134" cy="120" rx="8" ry="6" fill="#1a1410" />
      <path d="M74 104q12-6 24 0M122 104q12-6 24 0" stroke={hair} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M110 128q-4 18 -2 24" stroke="rgba(0,0,0,0.25)" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M96 168q14 6 28 0" stroke="rgba(90,40,30,0.7)" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  );
}
const MARIA = { skin: "#c99572", hair: "#2b1a12", shirt: "#e2725b" };
const ANDRES = { skin: "#b98663", hair: "#1f1712", shirt: "#2f6f4e" };

/** Video del punto: andén y reja; persona/celular acercándose. */
function Feed({ v }: { v: KioskView3 }) {
  const w = 12 + 30 * v.face;
  return (
    <div className="uk-feed">
      <svg className="uk-feed-bg" viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="uk3Sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#273250" />
            <stop offset="0.55" stopColor="#4a4b66" />
            <stop offset="1" stopColor="#5d5a5f" />
          </linearGradient>
        </defs>
        <rect width="160" height="90" fill="url(#uk3Sky)" />
        <rect y="52" width="160" height="38" fill="#7d7a76" />
        <rect y="70" width="160" height="2" fill="#a29d95" />
        <rect y="72" width="160" height="18" fill="#2b2e35" />
        {Array.from({ length: 26 }).map((_, i) => <rect key={i} x={i * 6.4} y="30" width="0.6" height="22" fill="#20242c" />)}
        <rect y="29" width="160" height="1.2" fill="#20242c" />
        <rect y="42" width="160" height="1" fill="#20242c" />
        <rect y="48" width="160" height="5" fill="#b9b2a6" />
      </svg>
      {v.face > 0.01 && v.who === "unknown" && (
        <div className="uk-feed-face" style={{ width: `${w}%`, opacity: Math.min(1, v.face * 3) }}>
          <Face {...ANDRES} />
        </div>
      )}
      {v.face > 0.01 && v.who === "spoof" && (
        <>
          <div className="uk-feed-face" style={{ width: `${w * 1.05}%`, opacity: Math.min(1, v.face * 3), filter: "brightness(.55)" }}>
            <Face skin="#8a6a55" hair="#1c1c1c" shirt="#374151" hood />
          </div>
          <div className="uk3-phone" style={{ width: `${8 + 16 * v.face}%`, opacity: Math.min(1, v.face * 3) }}>
            <div className="uk3-phone-scr"><Face {...MARIA} /></div>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  const c = ok ? "#34d399" : "#f87171";
  return (
    <div className="uk-row">
      {ok ? <L.check2 c={c} /> : <I3.xCircle c={c} />}
      <span className="uk-row-l">{label}</span>
      <span className="uk-row-d" style={{ color: c }}>{detail}</span>
    </div>
  );
}

const CASE = {
  spoof: { name: DEMO.maria, initials: "MR", role: "Propietario", apto: "A-501", reason: "Posible suplantación (liveness)", match: 0.64, live: 0.18, verdict: "Sospecha", at: T_SPOOF, evt: "9b41e07c" },
  unknown: { name: "Desconocido", initials: "D", role: null as string | null, apto: null as string | null, reason: "Persona desconocida", match: 0.31, live: 0.94, verdict: "Rostro real", at: T_UNK, evt: "c27d5a19" },
};

export function KioskUI3({ v, t, compact }: { v: KioskView3; t: number; compact: boolean }) {
  const th = TH[v.phase];
  const denied = v.phase === "DENIED";
  const c = CASE[v.who];
  return (
    <div className={`uk-win ${compact ? "is-m" : ""}`} style={{ ["--glow" as any]: th.glow }}>
      <header className="uk-head">
        <div className="uk-logo"><L.scanFace s={24} c="#38bdf8" /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>URBAN <span>· Control de Acceso</span></h1>
          <p>{KP} · <span style={{ color: "#34d399" }}>● SISTEMA EN VIVO</span></p>
        </div>
        <div className="uk-clock">
          <b>{clock3(t).h24}</b>
          <span>{DATE_KIOSK3}</span>
        </div>
        <span className="uk-stop">Detener</span>
        <span className="uk-out"><L.logOut /></span>
      </header>
      <div className="uk-body">
        <div className="uk-grid">
          <div className="uk-visor" style={{ borderColor: th.border, boxShadow: `0 0 60px -10px ${th.glow}, inset 0 0 60px rgba(0,0,0,0.6)` }}>
            <Feed v={v} />
            <div className="uk-hud">
              {["tl", "tr", "bl", "br"].map((k) => <span key={k} className={`uk-c uk-${k}`} style={{ borderColor: th.border }} />)}
            </div>
            {denied && (
              <div className="uk-reticle" style={v.who === "spoof" ? { left: "41.4%", width: "17.2%", bottom: "38%", height: "36%" } : { left: "37.4%", width: "25.2%", bottom: "27.8%", height: "54.3%" }}>
                {["tl", "tr", "bl", "br"].map((k) => <span key={k} className={`uk-rc uk-${k}`} style={{ borderColor: th.border }} />)}
              </div>
            )}
            {!denied && <div className="uk-scanwrap"><div className="uk-scanline" /></div>}
            <div className="uk-scrim" style={{ background: th.scrim }}>
              {denied ? <I3.shieldAlert s={30} c={th.fg} /> : <L.scanFace s={30} c={th.fg} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="uk-scrim-t" style={{ color: th.fg }}>{th.title}</p>
                <p className="uk-scrim-s">{denied ? c.reason : th.subtitle}</p>
              </div>
              <span className="uk-rec">● REC</span>
            </div>
          </div>
          {denied ? (
            <div className="uk-card uk3-deny" key={`card-${v.who}`} style={{ borderColor: th.border }}>
              <div className="uk-id">
                <div className="uk-av" style={{ borderColor: th.border, color: th.fg }}>{c.initials}</div>
                <div style={{ minWidth: 0 }}>
                  <p className="uk-name">{c.name}</p>
                  {(c.role || c.apto) && (
                    <div className="uk-tags">
                      {c.role && <span className="uk-role">{c.role}</span>}
                      {c.apto && <span className="uk-apto">Apto {c.apto}</span>}
                    </div>
                  )}
                </div>
              </div>
              <div className="uk-stamp uk3-stamp">
                <I3.shieldAlert s={28} c={th.fg} />
                <div>
                  <p style={{ color: th.fg }}>ACCESO DENEGADO</p>
                  <span>{c.reason}</span>
                </div>
              </div>
              <div className="uk-rows">
                <Row ok={c.match >= 0.5} label="Identidad biométrica (1:N)" detail={`${Math.round(c.match * 100)}% · umbral 50%`} />
                <Row ok={c.live >= 0.7} label="Prueba de vida · anti-spoofing" detail={`${c.verdict} · ${Math.round(c.live * 100)}%`} />
                <Row ok={false} label="Autorización en el punto" detail="—" />
                <Row ok={false} label="Apertura de puerta" detail="—" />
              </div>
              <div className="uk-meta">
                <span><L.clock /> {clock3(c.at).h24}</span>
                <span style={{ textAlign: "right" }}>{KP}</span>
                <span className="uk-evt">evt {c.evt}</span>
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
type FeedRow = { id: string; name: string; reason: string; door: boolean; ok: boolean; at: number };
export function GuardPanel3({ v, t, compact }: { v: GuardView3; t: number; compact: boolean }) {
  const rows: FeedRow[] = [
    ...(v.manual ? [{ id: "m", name: "Persona desconocida", reason: "Apertura manual del celador", door: true, ok: true, at: T_MANUAL }] : []),
    { id: "u", name: "Persona desconocida", reason: "Persona desconocida", door: false, ok: false, at: T_UNK },
    { id: "s", name: "Residente", reason: "Posible suplantación (liveness)", door: false, ok: false, at: T_SPOOF },
  ];
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
              <div className="uw-muted" style={{ fontSize: 11 }}>Turno Tarde · {DATE_GUARD3}</div>
            </div>
            {!compact && (
              <div className="ug-clock">
                <b>{clock3(t).h12pad}</b>
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
              {rows.map((r, i) => (
                <li key={r.id} className={`ug-ev ${r.ok ? "" : "is-deny"} ${i === 0 && v.fresh > 0.05 ? "is-new" : ""}`} style={{ ["--f" as any]: i === 0 ? v.fresh : 0, ["--fc" as any]: r.ok ? "34,197,94" : "239,68,68" }}>
                  <span className="ug-ev-ic">{r.ok ? <L.shieldCheck s={20} c="#22C55E" /> : <I3.shieldAlert s={20} c="#EF4444" />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="ug-ev-n">{r.name}</p>
                    <p className="ug-ev-d">{r.reason}{r.door ? " · puerta abierta" : ""} · {clock3(r.at).h12}</p>
                  </div>
                  <span className="ug-ev-b" style={{ color: r.ok ? "#22C55E" : "#EF4444" }}>{r.ok ? "CONCEDIDO" : "DENEGADO"}</span>
                  {!r.ok && (
                    <span className={`ug-open ${r.id === "u" && v.press ? "is-press" : ""}`} style={{ opacity: r.id === "u" && v.busy ? 0.6 : 1 }}>
                      <I3.door /> {r.id === "u" && v.busy ? "Abriendo…" : "Abrir"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
