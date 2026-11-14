/**
 * URBAN · Capítulo 3 «Cuando la puerta no abre».
 * Determinista en `t` (segundos): `?ch=3&tour=1&t=NN&pause=1`.
 *
 * Fuente (código real de URBAN):
 *  - backend/.../access-control/access-control.service.ts `decide()` (orden fail-secure: identidad →
 *    liveness → reto HIGH → consentimiento → autorización → horario), `manualOpen()` (nuevo evento
 *    GRANTED + MANUAL, actorId del celador, `door.open` del punto), `evaluateFaceAndActuate` (solo
 *    acciona la puerta si GRANTED).
 *  - web/src/app/kiosk/page.tsx (fase DENIED, IdentityPanel, CheckRow, HOLD_MS 6 s).
 *  - web/src/components/access/FaceAccessFeed.tsx (filas, «DENEGADO», botón «Abrir» / «Abriendo…»,
 *    sin confirmación ni campo de motivo). Para el rol GUARD `GET /access/subjects` es solo ADMIN, así
 *    que el feed muestra «Residente» en lugar del nombre cuando hay sujeto.
 */

import { P, clamp, ss, type Pose, type Shot } from "./tour";

export type Beat = { id: string; t0: number; t1: number; step: number; title: string; text: string };

export const STEPS3 = ["Una foto no pasa", "Rostro desconocido", "Carlos lo ve", "Apertura manual", "Falla segura"];

export const BEATS3: Beat[] = [
  { id: "intro", t0: 0, t1: 6, step: 0, title: "Falla segura", text: "Si algo no cuadra, el torniquete no se mueve. Cada intento queda registrado con su motivo." },
  { id: "spoof", t0: 6, t1: 11.8, step: 0, title: "Alguien muestra una foto", text: "Una persona acerca al kiosko un celular con la foto de María. El rostro coincide… pero no es una persona real." },
  { id: "spoofNo", t0: 11.8, t1: 18, step: 0, title: "Posible suplantación", text: "La prueba de vida pasiva marca «Sospecha». URBAN revisa el anti-spoofing antes que la autorización: ACCESO DENEGADO." },
  { id: "unknown", t0: 18, t1: 24.3, step: 1, title: "Llega Andrés López", text: "Andrés viene de visita. No está enrolado en el conjunto, así que el kiosko no tiene con quién compararlo." },
  { id: "unknownNo", t0: 24.3, t1: 31, step: 1, title: "Persona desconocida", text: "Rostro real, pero por debajo del umbral de identidad. ACCESO DENEGADO y el torniquete sigue en rojo." },
  { id: "feed", t0: 31, t1: 37.5, step: 2, title: "Carlos lo ve en vivo", text: "Cada denegación llega al centro de control con su motivo, y trae un botón «Abrir»." },
  { id: "manual", t0: 37.5, t1: 43, step: 3, title: "El celador decide", text: "Carlos verifica a Andrés en persona y pulsa «Abrir». La apertura queda como un evento nuevo con el usuario del celador." },
  { id: "pass", t0: 43, t1: 51, step: 3, title: "El relé abre, con registro", text: "El backend acciona el mismo relé del punto. En el feed: «Apertura manual del celador · puerta abierta»." },
  { id: "end", t0: 51, t1: 58, step: 4, title: "Nada se abre por defecto", text: "Otros motivos reales: «Sin autorización en este punto», «Fuera de horario permitido», «Sin consentimiento vigente». Si el relé no confirma, el kiosko muestra «Seam lógico (sin relé)»." },
];
export const TOUR_END3 = 58;

export function beatAt3(t: number): number {
  for (let i = BEATS3.length - 1; i >= 0; i--) if (t >= BEATS3[i].t0) return i;
  return 0;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/* ---------- Tiempos ---------- */
export const T_SPOOF = 11.8; // decisión DENIED · LIVENESS_FAILED
export const T_UNK = 24.3; // decisión DENIED · UNKNOWN_SUBJECT
export const T_PRESS = 40.5; // Carlos pulsa «Abrir»
export const T_RELAY3 = 40.9; // manualOpen → door.open
export const T_MANUAL = 41.3; // el feed recibe el evento MANUAL

const BASE_SEC = 18 * 3600 + 57 * 60 + 59; // 18:57:59 en T_SPOOF
export function clock3(t: number) {
  const s = Math.floor(BASE_SEC + (t - T_SPOOF));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h12 = h % 12 || 12;
  const ap = h < 12 ? "a. m." : "p. m.";
  return { h24: `${p2(h)}:${p2(m)}:${p2(x)}`, h12pad: `${p2(h12)}:${p2(m)}:${p2(x)} ${ap}`, h12: `${h12}:${p2(m)}:${p2(x)} ${ap}` };
}
export const DATE_KIOSK3 = "domingo, 15 de noviembre";
export const DATE_GUARD3 = "domingo, 15 de nov de 2026";

/* ---------- Kiosko (overlay) ---------- */
export type DenyCase = "spoof" | "unknown";
export type KioskView3 = { phase: "SCANNING" | "DENIED"; who: DenyCase; face: number };
export function kioskAt3(t: number): KioskView3 | null {
  if (t >= 7.6 && t < 17.6) return { phase: t >= T_SPOOF ? "DENIED" : "SCANNING", who: "spoof", face: ss(9.4, 10.6, t) };
  if (t >= 21.2 && t < 29.6) return { phase: t >= T_UNK ? "DENIED" : "SCANNING", who: "unknown", face: ss(21.6, 23.2, t) };
  return null;
}
/** Pantalla física del kiosko (con HOLD_MS de 6 s tras perder el rostro). */
export function kioskScreen3(t: number): "SCANNING" | "SPOOF" | "UNKNOWN" {
  if (t >= T_SPOOF && t < 16.8 + 6) return "SPOOF";
  if (t >= T_UNK) return "UNKNOWN";
  return "SCANNING";
}

/* ---------- Centro de control (overlay) ---------- */
export type GuardView3 = { press: boolean; busy: boolean; manual: boolean; fresh: number };
export function guardAt3(t: number): GuardView3 | null {
  if (t < 33 || t >= 43) return null;
  return { press: t >= T_PRESS - 0.25 && t < T_PRESS, busy: t >= T_PRESS && t < T_MANUAL, manual: t >= T_MANUAL, fresh: t >= T_MANUAL ? 1 - ss(T_MANUAL, T_MANUAL + 3, t) : 1 - ss(33.5, 36.5, t) };
}

/* ---------- Relé y torniquete ---------- */
export function relayAt3(t: number) {
  const on = t >= T_RELAY3 && t < T_RELAY3 + 3.6 ? 1 : 0;
  const click = t >= T_RELAY3 && t < T_RELAY3 + 0.7 ? (t - T_RELAY3) / 0.7 : -1;
  const signal = t >= T_RELAY3 && t < T_RELAY3 + 1.6 ? (t - T_RELAY3) / 1.6 : -1;
  return { on, click, signal };
}

/* ---------- Caminos ---------- */
type WP = { x: number; z: number; t: number };
function along(path: WP[], t: number) {
  if (t <= path[0].t) return { x: path[0].x, z: path[0].z, moving: false, yaw: Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z), d: 0 };
  let d = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (t < b.t) {
      const k = (t - a.t) / (b.t - a.t);
      return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), moving: L > 0.01, yaw: L > 0.01 ? Math.atan2(b.x - a.x, b.z - a.z) : NaN, d: d + L * k };
    }
    d += L;
  }
  const E = path[path.length - 1];
  return { x: E.x, z: E.z, moving: false, yaw: NaN, d };
}
function angLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
const base = (x: number, z: number, yaw: number): Pose => ({ x, z, yaw, walk: 0, phase: 0, phone: 0, selfie: 0, headYaw: 0, headPitch: 0, blink: 0, sit: 0, type: 0, wave: 0 });
const FAR: Pose = base(-1000, -1000, 0);
const blinkAt = (t: number, s: number) => ((t + s) % 3.9 < 0.12 ? 1 : 0);

const SPOT = { x: -3.05, z: 12.95 };
export const KIOSK_YAW3 = Math.atan2(P.kiosk[0] - 0.95 - SPOT.x, P.kiosk[1] - SPOT.z);
const WINDOW = { x: 0.3, z: 12.75 };

function walker(path: WP[], t: number, stillYaw: (t: number) => number) {
  const s = 0.35;
  const yawS = (tt: number) => {
    const a = along(path, tt);
    return a.moving ? a.yaw : stillYaw(tt);
  };
  const a = along(path, t);
  const y = angLerp(angLerp(yawS(t - s), yawS(t + s), 0.5), yawS(t), 0.5);
  const p = base(a.x, a.z, y);
  const sp = (along(path, t + 0.25).d - along(path, t - 0.25).d) / 0.5;
  p.walk = clamp(sp / 1.2);
  p.phase = a.d * 2.35;
  return p;
}

/* Persona sin nombre que intenta pasar con una foto de María en el celular. */
const SPOOF_PATH: WP[] = [
  { x: -12, z: 13.95, t: 4 },
  { x: -4.6, z: 13.95, t: 9.0 },
  { x: SPOT.x, z: SPOT.z + 0.1, t: 10.2 },
  { x: SPOT.x, z: SPOT.z + 0.1, t: 16.8 },
  { x: -4.6, z: 13.95, t: 18.0 },
  { x: -14, z: 13.95, t: 25 },
];
export function spooferPose(t: number): Pose {
  if (t > 25.5) return FAR;
  const p = walker(SPOOF_PATH, t, () => KIOSK_YAW3);
  p.selfie = t > 10.1 && t < 16.7 ? clamp(Math.min((t - 10.1) / 0.6, (16.7 - t) / 0.5)) : 0;
  p.headPitch = 0.08;
  p.blink = blinkAt(t, 0.3);
  return p;
}
/** Celular con la foto (mira hacia el kiosko) delante de la cara del impostor. */
export function spoofPhoneAt(t: number): { x: number; y: number; z: number; yaw: number; v: number } | null {
  const sp = spooferPose(t);
  if (sp.selfie < 0.6) return null;
  const f = 0.36;
  return { x: sp.x + Math.sin(KIOSK_YAW3) * f, y: 1.5, z: sp.z + Math.cos(KIOSK_YAW3) * f, yaw: KIOSK_YAW3, v: sp.selfie };
}

/* Andrés López (visitante, no enrolado). */
const ANDRES_PATH: WP[] = [
  { x: 3.5, z: 13.95, t: 18.4 },
  { x: SPOT.x, z: SPOT.z, t: 23.0 },
  { x: SPOT.x, z: SPOT.z, t: 28.6 },
  { x: WINDOW.x, z: WINDOW.z, t: 31.0 },
  { x: WINDOW.x, z: WINDOW.z, t: 42.2 },
  { x: -2.88, z: 12.35, t: 44.6 },
  { x: -2.88, z: 10.4, t: 46.6 },
  { x: -3.0, z: 6.0, t: 50.0 },
  { x: -3.1, z: 0.6, t: 54.2 },
  { x: 3.5, z: -2.2, t: 59.5 },
];
export function andresPose(t: number): Pose {
  if (t < 17) return FAR;
  const p = walker(ANDRES_PATH, t, (tt) => (tt < 28.6 ? KIOSK_YAW3 : Math.PI + 0.12));
  if (t > 23 && t < 28.6) p.headPitch = 0.1;
  if (t > 28 && t < 28.6) p.headYaw = 0.5 * ss(28, 28.5, t); // mira el torniquete en rojo
  if (t > 31 && t < 42.2) p.headYaw = 0.12 * Math.sin(t * 1.3);
  p.blink = t > 22 && t < 25 ? 0 : blinkAt(t, 1.1);
  return p;
}

export function turnstileAt3(t: number) {
  const z = along(ANDRES_PATH, t).z;
  const spin = t > 43 ? ss(11.95, 11.05, z) * ((Math.PI * 2) / 3) : 0;
  return { spin, unlocked: t >= T_MANUAL && t < 46.0 };
}

export function carlosPose3(t: number): Pose {
  const p = base(P.carlos[0], P.carlos[1], 0);
  p.sit = 1;
  const talk = ss(31, 31.8, t) * (1 - ss(42.4, 43.2, t));
  const mon = ss(38.6, 39.2, t) * (1 - ss(41.6, 42.1, t));
  p.headYaw = (0.3 * Math.sin(t * 0.23)) * (1 - talk) + talk * (-0.62 * (1 - mon));
  p.headPitch = 0.12 + 0.14 * mon - 0.05 * talk * (1 - mon);
  p.type = (0.5 + 0.3 * Math.sin(t * 0.7)) * (1 - talk) + (t > 40.1 && t < 40.6 ? 1 : 0);
  p.blink = blinkAt(t, 1.7);
  return p;
}

/* ---------- Cámara ---------- */
export function cameraAt3(t: number, mobile: boolean): Shot {
  const kA = mobile ? { ax: 0.5, ay: 0.3 } : { ax: 0.24, ay: 0.46 };
  const gA = mobile ? { ax: 0.5, ay: 0.25 } : { ax: 0.5, ay: 0.5 };
  const dm = mobile ? 1.5 : 1;
  const mid = (a: Shot, b: Shot, k: number): Shot => ({
    p: [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k), lerp(a.p[2], b.p[2], k)],
    q: [lerp(a.q[0], b.q[0], k), lerp(a.q[1], b.q[1], k), lerp(a.q[2], b.q[2], k)],
    ax: lerp(a.ax, b.ax, k),
    ay: lerp(a.ay, b.ay, k),
  });
  const an = andresPose(t);
  const aerial: Shot = { p: [24, 20, 44], q: [-2, 2, 11], ax: 0.5, ay: 0.5 };
  const wide: Shot = { p: [1.5, 3.0, 13.6 + 7.5 * dm], q: [-3.0, 1.3, 12.2], ax: 0.5, ay: mobile ? 0.42 : 0.5 };
  const shoulder: Shot = { p: [-1.6, 1.95, 13.6 + 2.2 * dm], q: [-3.55, 1.25, 12.15], ...kA };
  const fa = KIOSK_YAW3 + 0.62;
  const fd = 2.3 * dm;
  const face: Shot = { p: [SPOT.x + Math.sin(fa) * fd, 1.78 + 0.1 * (dm - 1), SPOT.z + Math.cos(fa) * fd], q: [SPOT.x, 1.45, SPOT.z], ...kA };
  const gate: Shot = { p: [0.8, 2.5, 13.6 + 5 * dm], q: [-2.7, 1.2, 12.0], ...kA };
  const locked: Shot = { p: [-1.9, 1.55, 12.0 + 1.3 * dm], q: [-3.35, 1.0, 11.5], ...gA };
  const toWin: Shot = { p: [3.8, 2.0, 13.6 + 3.4 * dm], q: [an.x, 1.3, an.z], ...gA };
  const booth: Shot = { p: [3.45, 2.05, 9.25], q: [0.9, 1.4, 12.5], ax: 0.5, ay: mobile ? 0.3 : 0.5 };
  const gateOpen: Shot = { p: [0.9, 2.4, 13.6 + 4.6 * dm], q: [-2.2, 1.2, 12.0], ...gA };
  const side: Shot = { p: [-1.25, 1.85, 11.5 - 3.4 * dm], q: [-3.0, 1.0, 11.7], ...gA };
  const endA: Shot = { p: [-0.6, 2.6, 4.6], q: [an.x, 1.2, an.z], ...gA };
  const endB: Shot = { p: [8, 15, 30], q: [-2, 2, 6], ax: 0.5, ay: 0.5 };

  if (t < 5.5) return mid(aerial, wide, ss(0, 5.5, t));
  if (t < 9.4) return mid(wide, shoulder, ss(5.5, 9.4, t));
  if (t < 11.8) return face;
  if (t < 17.6) return gate;
  if (t < 19.3) return locked;
  if (t < 21.2) return { p: [-2.6, 2.2, 13.6 + 5.4 * dm], q: [an.x, 1.3, an.z], ...gA };
  if (t < 24.3) return face;
  if (t < 28.8) return gate;
  if (t < 31.4) return toWin;
  if (t < 43) return mid(booth, { ...booth, p: [3.3, 2.0, 9.5] }, ss(31.4, 43, t));
  if (t < 46.6) return gateOpen;
  if (t < 51) return mid(side, endA, ss(48.5, 51, t));
  return mid(endA, endB, ss(51, 58, t));
}
