"use client";

/**
 * Réplicas de las pantallas reales de URBAN que aparecen en el Capítulo 1.
 * - App Flutter (tema oscuro UDS: base #0F172A, raised #1E293B, primario #3B82F6):
 *   login_screen.dart, onboarding_screen.dart, kyc_capture_screen.dart,
 *   liveness_challenge_screen.dart, home_screen.dart, main_shell.dart.
 * - Web admin: (admin)/admin/face-access/page.tsx, AdminSidebar.tsx, AdminHeader.tsx,
 *   WhatsAppConnectionPanel.tsx, KycApprovalsQueue.tsx.
 * - WhatsApp: plantilla `onboarding_approved` (template-renderer.ts).
 */

import type { ReactNode } from "react";
import { CHALLENGE, DEMO, INSTRUCTION, type AdminView, type PhoneView } from "../../lib/urban/tour";

/* ---------- Iconos (trazos simples estilo Material / Lucide) ---------- */
type IP = { s?: number; c?: string };
const sv = (s: number, c: string, children: ReactNode, fill = false) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill ? c : "none"} stroke={fill ? "none" : c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);
export const I = {
  apartment: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M14 9h5a1 1 0 0 1 1 1v11h-6M7 7h1M10 7h1M7 11h1M10 11h1M7 15h1M10 15h1M17 13h0M17 17h0" /></>),
  mail: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  lock: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>),
  eyeOff: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.2 3.8M6.2 6.2C3.9 7.9 3 12 3 12s4 6 9 6a9 9 0 0 0 4.2-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>),
  logout: ({ s = 16, c = "currentColor" }: IP) => sv(s, c, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></>),
  privacy: ({ s = 48, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="M12 8v4M12 16h0" /></>),
  badge: ({ s = 48, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M9 3h6v3H9zM7 14a2 2 0 1 1 4 0M9 12h0M14 11h4M14 14h3" /></>),
  face: ({ s = 48, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="9" /><path d="M9 10h0M15 10h0M8.5 15a4.5 4.5 0 0 0 7 0" /></>),
  verified: ({ s = 48, c = "currentColor" }: IP) => sv(s, c, <><path d="m12 2 2.4 2 3.1-.3.8 3 2.7 1.6-1.2 2.9 1.2 2.9-2.7 1.6-.8 3-3.1-.3L12 22l-2.4-2-3.1.3-.8-3L3 15.7 4.2 12.8 3 9.9l2.7-1.6.8-3 3.1.3z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  hourglass: ({ s = 64, c = "currentColor" }: IP) => sv(s, c, <><path d="M6 2h12M6 22h12M7 2v4a5 5 0 0 0 10 0V2M7 22v-4a5 5 0 0 1 10 0v4" /></>),
  shieldOk: ({ s = 64, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>),
  check: ({ s = 15, c = "currentColor" }: IP) => sv(s, c, <path d="M20 6 9 17l-5-5" />),
  checkbox: ({ s = 24, c = "currentColor", on }: IP & { on: boolean }) =>
    on
      ? sv(s, c, <><rect x="3" y="3" width="18" height="18" rx="2" fill={c} stroke={c} /><path d="m7 12 3.5 3.5L17 9" stroke="#0F172A" strokeWidth={2.6} /></>)
      : sv(s, c, <rect x="3.5" y="3.5" width="17" height="17" rx="2" />),
  info: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h0" /></>),
  checkCircle: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>),
  camera: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>),
  gallery: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m3 16 5-5 4 4 3-3 6 6" /><circle cx="15.5" cy="8.5" r="1.5" /></>),
  back: ({ s = 22, c = "currentColor" }: IP) => sv(s, c, <path d="M19 12H5M11 6l-6 6 6 6" />),
  arrowL: ({ s = 72, c = "currentColor" }: IP) => sv(s, c, <path d="M11 6 5 12l6 6M19 6l-6 6 6 6" />),
  arrowR: ({ s = 72, c = "currentColor" }: IP) => sv(s, c, <path d="m13 6 6 6-6 6M5 6l6 6-6 6" />),
  eye: ({ s = 72, c = "currentColor" }: IP) => sv(s, c, <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  focus: ({ s = 72, c = "currentColor" }: IP) => sv(s, c, <><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /><circle cx="12" cy="12" r="3" /></>),
  phone: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />),
  bell: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>),
  qr: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v0M14 20h7M20 17v3" /></>),
  campaign: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><path d="M3 10v4h4l6 4V6L7 10zM17 9a4 4 0 0 1 0 6M20 6a8 8 0 0 1 0 12" /></>),
  box: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>),
  warn: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h0" /></>),
  cal: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>),
  folder: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />),
  home: ({ s = 22, c = "currentColor" }: IP) => sv(s, c, <path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />),
  forum: ({ s = 22, c = "currentColor" }: IP) => sv(s, c, <><path d="M4 4h12v9H8l-4 3z" /><path d="M8 16v1h9l3 3V8h-4" /></>),
  person: ({ s = 22, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  scanFace: ({ s = 22, c = "currentColor" }: IP) => sv(s, c, <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M8 14s1.5 2 4 2 4-2 4-2M9 9h0M15 9h0" /></>),
  building: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h0M12 6h0M16 6h0M8 10h0M12 10h0M16 10h0M8 14h0M12 14h0M16 14h0" /></>),
  smartphone: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M11 18h2" /></>),
  refresh: ({ s = 14, c = "currentColor" }: IP) => sv(s, c, <><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>),
  x: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="M18 6 6 18M6 6l12 12" />),
  shieldQ: ({ s = 24, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" /><path d="M10 9a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.3M12 16h0" /></>),
  dash: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>),
  users: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><circle cx="9" cy="8" r="3.5" /><path d="M2 21a7 7 0 0 1 14 0M16 4a3.5 3.5 0 0 1 0 7M22 21a7 7 0 0 0-4-6.3" /></>),
  key: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 6l3 3M14 9l2 2" /></>),
  userCog: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><circle cx="10" cy="8" r="4" /><path d="M3 21a7 7 0 0 1 11-5.7M18 15v0M18 21v0" /><circle cx="18" cy="18" r="2.5" /></>),
  mega: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <path d="M3 11v3l14 5V6zM7 13v5a2 2 0 0 0 4 0v-3" />),
  pkg: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /></>),
  alert: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h0" /></>),
  video: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="2" y="6" width="14" height="12" rx="2" /><path d="m16 10 6-3v10l-6-3" /></>),
  file: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>),
  clip: ({ s = 20, c = "currentColor" }: IP) => sv(s, c, <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 2h6v4H9zM9 14l2 2 4-4" /></>),
  user: ({ s = 18, c = "currentColor" }: IP) => sv(s, c, <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
};

/* ---------- Ilustraciones (vista previa de cámara) ---------- */
export function FaceArt({ yaw = 0, blink = 0, w = 220 }: { yaw?: number; blink?: number; w?: number }) {
  const dx = -yaw * 26; // espejo de la cámara frontal: gira a su izquierda → hacia la izquierda de la pantalla
  const ey = 1 - 0.9 * blink;
  return (
    <svg viewBox="0 0 220 280" width={w} height={(w * 280) / 220} aria-hidden>
      <defs>
        <radialGradient id="urSkin" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#d9a582" />
          <stop offset="1" stopColor="#a8714f" />
        </radialGradient>
      </defs>
      <path d="M20 280c6-56 44-80 90-80s84 24 90 80z" fill="#e2725b" />
      <rect x="92" y="170" width="36" height="40" rx="14" fill="#b67d5a" />
      <ellipse cx={110 + dx * 0.25} cy="118" rx={66 - Math.abs(yaw) * 8} ry="80" fill="url(#urSkin)" />
      <path d={`M${44 + dx * 0.3} 112c0-56 28-80 66-80s66 24 66 80c-8-30-30-46-66-46s-58 16-66 46z`} fill="#2b1a12" />
      <ellipse cx={110 - dx * 1.2} cy="98" rx="70" ry="30" fill="#2b1a12" opacity="0.0" />
      <g transform={`translate(${dx},0)`}>
        <ellipse cx="86" cy="120" rx="8" ry={6 * ey} fill="#1a1410" />
        <ellipse cx="134" cy="120" rx="8" ry={6 * ey} fill="#1a1410" />
        <path d="M74 104q12-6 24 0M122 104q12-6 24 0" stroke="#2b1a12" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d={`M110 128q${-4 - yaw * 6} 18 -2 24`} stroke="#8a5a3f" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M94 168q16 9 32 0" stroke="#9b4b3e" strokeWidth="5" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function DocArt({ back = false, w = 250 }: { back?: boolean; w?: number }) {
  return (
    <svg viewBox="0 0 320 202" width={w} height={(w * 202) / 320} aria-hidden>
      <rect x="1" y="1" width="318" height="200" rx="14" fill={back ? "#dfe7ef" : "#e9eef5"} stroke="#9fb0c4" />
      {!back ? (
        <>
          <rect x="1" y="1" width="318" height="34" rx="14" fill="#f2c94c" />
          <rect x="1" y="20" width="318" height="15" fill="#f2c94c" />
          <rect x="18" y="12" width="140" height="10" rx="5" fill="#5c4a1a" opacity=".6" />
          <rect x="20" y="52" width="88" height="112" rx="8" fill="#c7d2de" />
          <circle cx="64" cy="92" r="22" fill="#a8714f" />
          <path d="M30 164c4-26 20-36 34-36s30 10 34 36z" fill="#e2725b" />
          <rect x="126" y="56" width="70" height="8" rx="4" fill="#64748b" />
          <rect x="126" y="70" width="150" height="12" rx="4" fill="#1f2937" />
          <rect x="126" y="96" width="60" height="8" rx="4" fill="#64748b" />
          <rect x="126" y="110" width="130" height="12" rx="4" fill="#1f2937" />
          <rect x="126" y="136" width="90" height="8" rx="4" fill="#64748b" />
          <rect x="126" y="150" width="110" height="12" rx="4" fill="#1f2937" />
        </>
      ) : (
        <>
          <rect x="24" y="24" width="120" height="70" rx="6" fill="#c7d2de" />
          <rect x="164" y="28" width="130" height="8" rx="4" fill="#64748b" />
          <rect x="164" y="46" width="110" height="8" rx="4" fill="#64748b" />
          <rect x="164" y="64" width="120" height="8" rx="4" fill="#64748b" />
          {Array.from({ length: 34 }).map((_, i) => (
            <rect key={i} x={24 + i * 8.2} y="120" width={i % 3 ? 3 : 5} height="56" fill="#1f2937" />
          ))}
        </>
      )}
    </svg>
  );
}

/* ---------- Componentes UDS ---------- */
export function Btn({ label, variant = "primary", icon, pressed, loading, disabled }: { label: string; variant?: "primary" | "secondary"; icon?: ReactNode; pressed?: boolean; loading?: boolean; disabled?: boolean }) {
  return (
    <div className={`ua-btn ua-btn-${variant} ${pressed ? "is-press" : ""} ${disabled ? "is-dis" : ""}`}>
      {loading ? <span className="ua-spin" /> : <>{icon}{label}</>}
    </div>
  );
}

function Input({ label, icon, value, hint, focus }: { label: string; icon: ReactNode; value: string; hint?: string; focus?: boolean }) {
  return (
    <div className="ua-field">
      <div className="ua-label">{label}</div>
      <div className={`ua-input ${focus ? "is-focus" : ""}`}>
        <span className="ua-input-ic">{icon}</span>
        <span className={value ? "ua-input-v" : "ua-input-h"}>
          {value || hint || ""}
          {focus && <i className="ua-caret" />}
        </span>
      </div>
    </div>
  );
}

export function StatusBar({ dark = true, time = "18:42" }: { dark?: boolean; time?: string }) {
  return (
    <div className={`ua-status ${dark ? "" : "is-light"}`}>
      <span>{time}</span>
      <span className="ua-status-r">
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M1 10h2V7H1zM5 10h2V5H5zM9 10h2V3H9zM13 10h2V1h-2z" fill="currentColor" /></svg>
        <svg width="22" height="11" viewBox="0 0 22 11"><rect x=".5" y=".5" width="18" height="10" rx="2.5" fill="none" stroke="currentColor" /><rect x="2" y="2" width="13" height="7" rx="1.2" fill="currentColor" /><rect x="19.5" y="3.5" width="2" height="4" rx="1" fill="currentColor" /></svg>
      </span>
    </div>
  );
}

export function AppBar({ title, back, action }: { title: string; back?: boolean; action?: ReactNode }) {
  return (
    <div className="ua-appbar">
      {back && <span className="ua-appbar-back"><I.back /></span>}
      <span className="ua-appbar-t">{title}</span>
      {action}
    </div>
  );
}

function StepIndicator({ active }: { active: number }) {
  return (
    <div className="ua-steps">
      {[0, 1, 2, 3].map((i) => {
        const on = i <= active;
        return (
          <div key={i} className="ua-step">
            <div className="ua-step-bar" style={{ background: on ? "#3B82F6" : "rgba(148,163,184,0.12)" }} />
            <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
              {i < active ? (
                <><circle cx="12" cy="12" r="11" fill="#3B82F6" /><path d="m7 12 3.5 3.5L17 9" stroke="#0F172A" strokeWidth="3" fill="none" /></>
              ) : (
                <circle cx="12" cy="12" r="10" fill={on ? "#3B82F6" : "rgba(148,163,184,0.12)"} />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function Onboarding({ active, children }: { active: number; children: ReactNode }) {
  return (
    <div className="ua-screen">
      <StatusBar />
      <AppBar title="Verificación de identidad" action={<span className="ua-appbar-act"><I.logout /> Salir</span>} />
      <div className="ua-body">
        <StepIndicator active={active} />
        <div style={{ height: 20 }} />
        {children}
      </div>
    </div>
  );
}

/* ---------- Pantallas de la app ---------- */
function Login({ v }: { v: Extract<PhoneView, { s: "login" }> }) {
  return (
    <div className="ua-screen">
      <StatusBar />
      <div className="ua-login">
        <div className="ua-logo"><I.apartment s={40} c="#3B82F6" /></div>
        <div className="ua-h-urban">URBAN</div>
        <div className="ua-sub">Inicia sesión para continuar</div>
        <div style={{ height: 32 }} />
        <Input label="Correo electrónico" icon={<I.mail />} value={v.email} hint="tu@ejemplo.com" focus={v.pass === 0 && v.email.length > 0 && !v.loading} />
        <div style={{ height: 16 }} />
        <Input label="Contraseña" icon={<I.lock />} value={"•".repeat(v.pass)} focus={v.pass > 0 && !v.loading} />
        <div className="ua-show"><I.eyeOff c="#94A3B8" /> Mostrar</div>
        <div style={{ height: 16 }} />
        <Btn label="Iniciar sesión" pressed={v.press} loading={v.loading} />
      </div>
    </div>
  );
}

function Consent({ v }: { v: Extract<PhoneView, { s: "consent" }> }) {
  return (
    <Onboarding active={0}>
      <I.privacy c="#3B82F6" />
      <div className="ua-title">Tratamiento de datos (Ley 1581)</div>
      <div className="ua-text">
        Para activar tu acceso facial necesitamos tratar tu documento de identidad y tu rostro con la única finalidad de control de acceso residencial. Tus
        imágenes se guardan cifradas, no se comparten con terceros y puedes solicitar su eliminación en cualquier momento.
      </div>
      <div className="ua-check">
        <I.checkbox on={v.checked} c={v.checked ? "#3B82F6" : "#64748B"} />
        <span>Autorizo el tratamiento de mi documento y rostro para el control de acceso, según la política de privacidad.</span>
      </div>
      <div style={{ height: 20 }} />
      <Btn label="Acepto y continúo" pressed={v.press} loading={v.loading} disabled={!v.checked} />
    </Onboarding>
  );
}

function Action({ v }: { v: Extract<PhoneView, { s: "action" }> }) {
  const cfg = {
    doc: {
      a: 1,
      icon: <I.badge c="#3B82F6" />,
      t: "Foto de tu documento",
      b: "Toma una foto del frente y el reverso de tu documento de identidad. Verificaremos que los datos coincidan contigo.",
      cta: "Capturar documento",
    },
    // El texto de esta tarjeta en el código aún describe «3 fotos»; el flujo real abre el reto de
    // liveness activo (onboarding_screen.dart:87-94), por eso aquí no se repite ese párrafo.
    face: { a: 2, icon: <I.face c="#3B82F6" />, t: "Captura de tu rostro", b: "", cta: "Iniciar captura facial" },
    submit: {
      a: 3,
      icon: <I.verified c="#3B82F6" />,
      t: "Todo listo para enviar",
      b: "Enviaremos tu verificación a la administración para su aprobación. Te avisaremos cuando tu acceso facial quede activo.",
      cta: "Enviar a revisión",
    },
  }[v.kind];
  return (
    <Onboarding active={cfg.a}>
      {cfg.icon}
      <div className="ua-title">{cfg.t}</div>
      {cfg.b && <div className="ua-text">{cfg.b}</div>}
      <div style={{ height: 20 }} />
      <Btn label={cfg.cta} pressed={v.press} loading={v.loading} />
    </Onboarding>
  );
}

function Info({ v }: { v: Extract<PhoneView, { s: "info" }> }) {
  const done = v.kind === "done";
  return (
    <Onboarding active={4}>
      <div className="ua-info">
        {done ? <I.shieldOk c="#22C55E" /> : <I.hourglass c="#3B82F6" />}
        <div className="ua-title ua-center">{done ? "¡Acceso facial activo!" : "En revisión"}</div>
        <div className="ua-text ua-center">
          {done
            ? "Tu identidad fue verificada y aprobada. Ya puedes usar la app e ingresar al conjunto con reconocimiento facial."
            : "La administración está revisando tu verificación. En cuanto la aprueben se desbloqueará tu acceso a la app. Vuelve a intentar en unos minutos."}
        </div>
        <div style={{ height: 24 }} />
        <Btn label={done ? "Entrar a la app" : v.press ? "Actualizando…" : "Actualizar estado"} variant={done ? "primary" : "secondary"} pressed={v.press} />
      </div>
    </Onboarding>
  );
}

function Kyc({ v }: { v: Extract<PhoneView, { s: "kyc" }> }) {
  const title = v.side === 0 ? "Documento — frente" : "Documento — reverso";
  const instr = v.side === 0 ? "Encuadra el FRENTE del documento dentro del marco. Buena luz, sin reflejos." : "Ahora el REVERSO del documento dentro del marco.";
  const last = v.side === 1;
  return (
    <div className="ua-screen">
      <StatusBar />
      <AppBar title={`${title}  (${v.side + 1}/2)`} back />
      {v.review ? (
        <>
          <div className="ua-preview ua-black">
            <div className="ua-shot"><DocArt back={v.side === 1} w={270} /></div>
          </div>
          <div className="ua-instr"><I.checkCircle c="#22C55E" /> <span>¿Se ve nítido y completo? Si no, repítela.  (luz {v.side ? 138 : 144}, nitidez {v.side ? "7.9" : "8.6"})</span></div>
          <div className="ua-actions">
            <Btn label={last ? "Usar foto" : "Usar y continuar"} icon={<I.check s={18} />} pressed={v.press} loading={v.press && last} />
            <div style={{ height: 12 }} />
            <Btn label="Repetir" variant="secondary" icon={<I.refresh s={18} />} />
          </div>
        </>
      ) : (
        <>
          <div className="ua-preview ua-cam">
            <div className="ua-cam-doc" style={{ transform: `rotate(${v.side ? -1.5 : 2}deg)` }}><DocArt back={v.side === 1} w={258} /></div>
            <div className="ua-guide-doc" />
            <div className="ua-flash" style={{ opacity: v.flash }} />
          </div>
          <div className="ua-instr"><I.info c="#3B82F6" /> <span>{instr}</span></div>
          <div className="ua-actions">
            <Btn label="Capturar" icon={<I.camera />} pressed={v.flash > 0.5} />
            <div style={{ height: 12 }} />
            <Btn label="Elegir de galería" variant="secondary" icon={<I.gallery />} />
          </div>
        </>
      )}
    </div>
  );
}

function Live({ v, t }: { v: Extract<PhoneView, { s: "live" }>; t: number }) {
  const a = CHALLENGE[v.idx];
  const confirmed = v.stage === "ok";
  const on = v.stage === "detect" ? Math.min(1, v.progress * 1.6) : confirmed ? 1 : 0;
  const yaw = a === "LOOK_LEFT" ? 0.9 * on : a === "LOOK_RIGHT" ? -0.9 * on : 0;
  const blink = a === "BLINK" && v.stage === "detect" && v.progress > 0.15 && v.progress < 0.45 ? 1 : (t % 3.7) < 0.12 ? 1 : 0;
  const color = `rgb(${Math.round(255 - (255 - 34) * v.progress)},${Math.round(255 - (255 - 197) * v.progress)},${Math.round(255 - (255 - 94) * v.progress)})`;
  if (v.stage === "upload") {
    return (
      <div className="ua-screen">
        <StatusBar />
        <AppBar title="Prueba de vida" back />
        <div className="ua-centerbox">
          <span className="ua-spin ua-spin-lg" />
          <div className="ua-dim" style={{ marginTop: 16, fontSize: 15 }}>Verificando…</div>
        </div>
      </div>
    );
  }
  if (v.stage === "init") {
    return (
      <div className="ua-screen">
        <StatusBar />
        <AppBar title="Prueba de vida" back />
        <div className="ua-centerbox"><span className="ua-spin ua-spin-lg" /></div>
      </div>
    );
  }
  const Dir = a === "LOOK_RIGHT" ? I.arrowR : a === "LOOK_LEFT" ? I.arrowL : a === "BLINK" ? I.eye : I.focus;
  const align = a === "LOOK_RIGHT" ? "flex-end" : a === "LOOK_LEFT" ? "flex-start" : "center";
  return (
    <div className="ua-screen">
      <StatusBar />
      <AppBar title="Prueba de vida" back />
      <div className="ua-preview ua-selfie">
        <div className="ua-selfie-bg" />
        <div className="ua-selfie-face"><FaceArt yaw={yaw} blink={blink} w={230} /></div>
        <svg className="ua-oval" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <mask id="urOval">
              <rect width="100" height="100" fill="white" />
              <ellipse cx="50" cy="45" rx="29" ry="23" fill="black" />
            </mask>
          </defs>
          <rect width="100" height="100" fill="rgba(0,0,0,0.5)" mask="url(#urOval)" />
          <ellipse cx="50" cy="45" rx="29" ry="23" fill="none" stroke={confirmed ? "#22C55E" : "rgba(255,255,255,0.95)"} strokeWidth="0.9" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 3 }} />
        </svg>
        {v.stage === "detect" && (
          <div className="ua-dir" style={{ justifyContent: align }}>
            <div className="ua-dir-in">
              <Dir c={color} />
              <div className="ua-dir-bar"><i style={{ width: `${v.progress * 100}%`, background: color }} /></div>
            </div>
          </div>
        )}
        {v.stage === "ready" && (
          <div className="ua-ready">
            <div className="ua-ready-p">Prepárate</div>
            <div className="ua-ready-i">{INSTRUCTION[a]}</div>
            <div className="ua-ready-c">{v.count}</div>
          </div>
        )}
        {confirmed && <div className="ua-ok"><I.checkCircle s={96} c="#22C55E" /></div>}
      </div>
      <div className="ua-live-bottom">
        <div className="ua-dots">
          {CHALLENGE.map((_, i) => (
            <i key={i} style={{ width: i === v.idx ? 28 : 10, background: i <= v.idx ? "#3B82F6" : "rgba(148,163,184,0.12)" }} />
          ))}
        </div>
        <div className="ua-live-h" style={{ color: confirmed ? "#22C55E" : "#F1F5F9" }}>{confirmed ? "¡Perfecto!" : v.hold ? "Sostén la posición…" : INSTRUCTION[a]}</div>
        <div className="ua-live-s">Paso {v.idx + 1} de {CHALLENGE.length}</div>
      </div>
    </div>
  );
}

const WA_TEXT = `Hola ${DEMO.maria}, tu verificación de identidad fue aprobada. Tu acceso facial ya está activo: puedes ingresar con reconocimiento facial en los puntos habilitados.`;

function WhatsApp({ k }: { k: number }) {
  if (k < 2.6) {
    return (
      <div className="ua-screen">
        <Info v={{ s: "info", kind: "wait", press: false }} />
        <div className="ua-notif" style={{ transform: `translateY(${Math.min(0, (k - 0.35) * 260)}px)` }}>
          <div className="ua-notif-h"><span className="ua-wa-ic">✆</span> WhatsApp · ahora</div>
          <div className="ua-notif-t">Conjunto URBAN</div>
          <div className="ua-notif-b">{WA_TEXT}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="ua-screen ua-wa">
      <StatusBar />
      <div className="ua-wa-top">
        <I.back c="#e9edef" />
        <div className="ua-wa-av"><I.building s={18} c="#e9edef" /></div>
        <div>
          <div className="ua-wa-name">Conjunto URBAN</div>
          <div className="ua-wa-st">en línea</div>
        </div>
      </div>
      <div className="ua-wa-body">
        <div className="ua-wa-day">HOY</div>
        <div className="ua-wa-msg" style={{ opacity: Math.min(1, (k - 2.6) * 3) }}>
          {WA_TEXT}
          <span className="ua-wa-time">18:44</span>
        </div>
      </div>
      <div className="ua-wa-input"><span>Mensaje</span></div>
    </div>
  );
}

function Home() {
  const kpis = [
    { l: "INVITACIONES", ic: <I.qr c="#3B82F6" />, c: "#3B82F6" },
    { l: "COMUNICADOS", ic: <I.campaign c="#3B82F6" />, c: "#3B82F6" },
    { l: "PAQUETES", ic: <I.box c="#F59E0B" />, c: "#F59E0B" },
    { l: "INCIDENTES", ic: <I.warn c="#EF4444" />, c: "#EF4444" },
  ];
  return (
    <div className="ua-screen">
      <StatusBar />
      <div className="ua-home">
        <div className="ua-home-h">
          <div style={{ flex: 1 }}>
            <div className="ua-hello">Hola, {DEMO.mariaFirst}</div>
            <div className="ua-live"><i /> {DEMO.carlos} en turno</div>
          </div>
          <span className="ua-hbtn"><I.phone /></span>
          <span className="ua-hbtn"><I.bell /></span>
          <span className="ua-av">M</span>
        </div>
        <div className="ua-kpis">
          {kpis.map((k) => (
            <div key={k.l} className="ua-card ua-kpi">
              <span className="ua-kpi-ic" style={{ background: `${k.c}1f` }}>{k.ic}</span>
              <div>
                <div className="ua-kpi-l">{k.l}</div>
                <div className="ua-kpi-v">0</div>
              </div>
            </div>
          ))}
        </div>
        <div className="ua-row2">
          <div className="ua-card ua-short"><I.cal c="#3B82F6" /> Reservas</div>
          <div className="ua-card ua-short"><I.folder c="#3B82F6" /> Documentos</div>
        </div>
        <div className="ua-sect">
          <div className="ua-sect-t">Actividad reciente</div>
          <div className="ua-sect-s">Eventos en tu apartamento</div>
        </div>
      </div>
      <div className="ua-nav">
        {[
          ["Inicio", <I.home key="h" c="#F1F5F9" />],
          ["Invitaciones", <I.qr key="q" s={22} c="#94A3B8" />],
          ["Portería", <I.forum key="f" c="#94A3B8" />],
          ["Paquetes", <I.box key="b" s={22} c="#94A3B8" />],
          ["Perfil", <I.person key="p" c="#94A3B8" />],
        ].map(([l, ic], i) => (
          <div key={String(l)} className={`ua-nav-i ${i === 0 ? "on" : ""}`}>
            <span className="ua-nav-pill">{ic}</span>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhoneScreen({ v, t }: { v: PhoneView; t: number }) {
  let body: ReactNode = null;
  if (v.s === "login") body = <Login v={v} />;
  else if (v.s === "consent") body = <Consent v={v} />;
  else if (v.s === "action") body = <Action v={v} />;
  else if (v.s === "kyc") body = <Kyc v={v} />;
  else if (v.s === "live") body = <Live v={v} t={t} />;
  else if (v.s === "info") body = <Info v={v} />;
  else if (v.s === "wa") body = <WhatsApp k={v.k} />;
  else body = <Home />;
  return (
    <div className="ua-phone">
      <div className="ua-notch" />
      <div className="ua-phone-in">{body}</div>
    </div>
  );
}

/* ---------- Panel web de administración ---------- */
const NAV: [string, (p: IP) => JSX.Element][] = [
  ["Dashboard", I.dash],
  ["Torres y Aptos", I.building],
  ["Residentes", I.users],
  ["Usuarios y accesos", I.key],
  ["Acceso facial", I.scanFace],
  ["Visitantes", I.userCog],
  ["Comunicados", I.mega],
  ["Paquetes", I.pkg],
  ["Incidentes", I.alert],
  ["Cámaras", I.video],
  ["Reservas", I.cal],
  ["Documentos", I.file],
  ["Auditoría", I.clip],
];

function Badge({ label, status }: { label: string; status: string }) {
  return <span className="uw-badge">{label}: {status}</span>;
}

function Tile({ label, children, face }: { label: string; children: ReactNode; face?: boolean }) {
  return (
    <div className={`uw-tile ${face ? "is-face" : ""}`} title={label}>
      {children}
    </div>
  );
}

export function AdminPanel({ v, compact }: { v: AdminView; compact: boolean }) {
  return (
    <div className="uw-win">
      <div className="uw-chrome">
        <i /><i /><i />
        <span className="uw-url">/admin/face-access</span>
      </div>
      <div className="uw-app">
        {!compact && (
          <aside className="uw-side">
            <div className="uw-side-h">
              <span className="uw-side-logo"><I.building /></span>
              <div>
                <div className="uw-b">URBAN</div>
                <div className="uw-muted uw-xs">Administración</div>
              </div>
            </div>
            <nav className="uw-nav">
              {NAV.map(([l, Ic]) => (
                <div key={l} className={`uw-nav-i ${l === "Acceso facial" ? "on" : ""}`}>
                  <Ic s={18} /> {l}
                </div>
              ))}
            </nav>
            <div className="uw-side-f uw-muted uw-xs">{DEMO.dianaEmail}</div>
          </aside>
        )}
        <div className="uw-main">
          <header className="uw-top">
            <span className="uw-top-logo"><I.building s={18} /></span>
            <div>
              <div className="uw-b uw-sm">URBAN — Administración</div>
              <div className="uw-muted uw-xs">viernes, 13 de nov de 2026</div>
            </div>
            {!compact && (
              <div className="uw-clock">
                <b>06:43:20 p. m.</b>
                <span>Hora local</span>
              </div>
            )}
            <span style={{ flex: 1 }} />
            <span className="uw-top-ic"><I.bell s={18} /></span>
            <span className="uw-top-ic"><I.user /></span>
          </header>
          <div className="uw-content">
            <div className="uw-ph">
              <span className="uw-ph-ic"><I.scanFace /></span>
              <div>
                <h1>Control de acceso facial</h1>
                <p>Sigue el enrolamiento de cada residente, aprueba registros y configura los puntos de acceso.</p>
              </div>
            </div>
            <div className="uw-wa">
              <span className="uw-wa-ic"><I.checkCircle s={20} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4>WhatsApp del conjunto (envío automático)</h4>
                <p>Conectado. Los enlaces se envían solos.</p>
              </div>
              <span className="uw-btn-ghost"><I.refresh /> Actualizar</span>
            </div>
            <div className="uw-tabs">
              {["Padrón de enrolamiento", "Aprobaciones", "Puntos de acceso", "Enrolar manual"].map((l) => (
                <span key={l} className={`uw-tab ${l === "Aprobaciones" ? "on" : ""}`}>{l}</span>
              ))}
            </div>
            {v.s === "empty" ? (
              <div className="uw-empty"><I.shieldQ /> No hay onboarding pendientes de aprobación.</div>
            ) : (
              <div className="uw-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="uw-b uw-sm">{DEMO.maria}</div>
                  <div className="uw-muted uw-xs">{DEMO.apto}</div>
                </div>
                <Badge label="Doc" status="MATCH" />
                <Badge label="Rostro" status="MATCH" />
                <span className={`uw-btn ${v.s === "list" && v.press ? "is-press" : ""}`}>Revisar</span>
              </div>
            )}
          </div>
        </div>
        {(v.s === "modal" || v.s === "busy") && (
          <div className="uw-modal-bg">
            <div className="uw-modal">
              <div className="uw-modal-h">
                <div>
                  <h3>{DEMO.maria}</h3>
                  <p className="uw-muted uw-xs">{DEMO.apto} · Documento 1036482915</p>
                </div>
                <span className="uw-muted"><I.x /></span>
              </div>
              <div className="uw-sec">Documento</div>
              <div className="uw-tiles">
                <Tile label="doc_front"><DocArt w={118} /></Tile>
                <Tile label="doc_back"><DocArt back w={118} /></Tile>
              </div>
              <div className="uw-sec">Rostro (3 poses)</div>
              <div className="uw-tiles">
                <Tile label="face_front" face><FaceArt w={96} /></Tile>
                <Tile label="face_left" face><FaceArt w={96} yaw={0.9} /></Tile>
                <Tile label="face_right" face><FaceArt w={96} yaw={-0.9} /></Tile>
              </div>
              <div className="uw-sec">Verificaciones</div>
              <div className="uw-metrics">
                <div><span>Document_Match</span><b>MATCH (0.93)</b></div>
                <div><span>Face_Document_Match</span><b>MATCH (0.87)</b></div>
                <div><span>Liveness</span><b>0.98/0.96/0.97</b></div>
              </div>
              <div className="uw-modal-f">
                <span className="uw-btn-reject"><I.x s={15} /> Rechazar</span>
                <span className={`uw-btn-ok ${v.press ? "is-press" : ""}`} style={{ opacity: v.s === "busy" ? 0.6 : 1 }}>
                  {v.s === "busy" ? <I.shieldOk s={15} /> : <I.check />}
                  {v.s === "busy" ? "Procesando…" : "Aprobar y activar"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
