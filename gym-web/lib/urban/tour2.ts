/**
 * URBAN · Capítulo 2 «Entra con su rostro».
 * Misma regla que el capítulo 1: todo es función de `t` (segundos), así se puede pausar,
 * adelantar o capturar con `?ch=2&tour=1&t=NN&pause=1`.
 *
 * Fuente de los textos y del orden del flujo (código real de URBAN):
 *  - web/src/app/kiosk/page.tsx (PHASE_THEME, IdentityPanel, CheckRow, HOLD_MS = 6000, RECO_GAP_MS = 1000)
 *  - backend/.../access-control/kiosk-recognition.service.ts (cooldown 5 s, perfil de la cédula)
 *  - backend/.../access-control/access-control.service.ts (decide → door.open solo si GRANTED → persistAndEmit)
 *  - backend/.../access-control/door/door-controller.service.ts (RELAY = webhook HTTP; fail-secure)
 *  - web/src/components/access/FaceAccessFeed.tsx + faceAccess.types.ts (feed del celador, reasonLabel)
 */

import { P, clamp, ss, type Pose, type Shot, type V3 } from "./tour";

export const KIOSK = {
  point: "Peatonal principal",
  matchScore: 0.71,
  matchThreshold: 0.5, // default de access_point.match_threshold
  livenessScore: 0.96,
  livenessThreshold: 0.7, // default de access_point.liveness_threshold
  role: "Propietario", // residentTypeLabel('OWNER')
  apto: "A-501",
  evt: "3f9c2a7e",
};

/* ---------- Reloj del demo: sábado 14 de noviembre, 18:52:09 en el instante del acceso ---------- */
export const T_RELAY = 16.6; // el backend acciona el relé antes de responder al kiosko
export const T_GRANT = 16.9; // el kiosko recibe la decisión (GRANTED + doorActuated)
const GRANT_SEC = 18 * 3600 + 52 * 60 + 9;
export function clockAt(t: number) {
  const s = Math.floor(GRANT_SEC + (t - T_GRANT));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const p2 = (n: number) => String(n).padStart(2, "0");
  const h12 = h % 12 || 12;
  return {
    h24: `${p2(h)}:${p2(m)}:${p2(x)}`, // toLocaleTimeString('es-CO', { hour12: false })
    h12pad: `${p2(h12)}:${p2(m)}:${p2(x)} ${h < 12 ? "a. m." : "p. m."}`, // GuardHeader formatTime
    h12: `${h12}:${p2(m)}:${p2(x)} ${h < 12 ? "a. m." : "p. m."}`, // toLocaleTimeString('es-CO')
  };
}
export const DATE_KIOSK = "sábado, 14 de noviembre"; // weekday long, day numeric, month long (+ capitalize)
export const DATE_GUARD = "sábado, 14 de nov de 2026"; // GuardHeader formatDate
export const GRANT_TIME = clockAt(T_GRANT);

/* ---------- Beats ---------- */
export type Beat = { id: string; t0: number; t1: number; step: number; title: string; text: string };

export const STEPS2 = ["Llega a la portería", "El kiosko la busca", "Acceso concedido", "Pasa el torniquete", "Queda registrado", "En casa"];

export const BEATS2: Beat[] = [
  { id: "intro", t0: 0, t1: 7.5, step: 0, title: "María vuelve a casa", text: "Al día siguiente, María llega caminando a la portería. Sin llaves, sin tarjeta y sin sacar el celular." },
  { id: "kiosk", t0: 7.5, t1: 12, step: 0, title: "El kiosko de la puerta", text: "En el torniquete peatonal hay un kiosko URBAN enlazado a la cámara del punto «Peatonal principal». Está en vivo." },
  { id: "scan", t0: 12, t1: 16.2, step: 1, title: "La busca entre los residentes", text: "Reconocimiento 1:N contra los rostros enrolados y prueba de vida pasiva sobre el mismo video. No tiene que parpadear ni girar." },
  { id: "relay", t0: 16.2, t1: 20.5, step: 2, title: "Concedido: el relé abre", text: "El backend llama por HTTP al relé del punto. Solo si el relé confirma, la cédula dice «Accionada»; si falla, no se marca como abierta." },
  { id: "why", t0: 20.5, t1: 25.2, step: 2, title: "Por qué abrió", text: "Identidad sobre el umbral, rostro real, consentimiento vigente, autorización en este punto y dentro del horario. Si algo falla, no abre." },
  { id: "pass", t0: 25.2, t1: 33, step: 3, title: "Un paso, y se vuelve a cerrar", text: "El torniquete queda libre para su paso. María empuja el brazo, entra, y el torniquete vuelve a bloquearse." },
  { id: "log", t0: 33, t1: 43, step: 4, title: "Carlos lo ve en vivo", text: "El evento llega al centro de control del celador: quién entró, el motivo y si la puerta abrió. Carlos no tuvo que hacer nada." },
  { id: "home", t0: 43, t1: 51, step: 5, title: "Bienvenida a casa", text: "Cada intento queda registrado con su motivo. Próximo capítulo: qué pasa cuando la puerta no abre." },
];
export const TOUR_END2 = 51;

export function beatAt2(t: number): number {
  for (let i = BEATS2.length - 1; i >= 0; i--) if (t >= BEATS2[i].t0) return i;
  return 0;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/* ---------- Kiosko (overlay) ---------- */
export type KioskView = { phase: "SCANNING" | "GRANTED"; face: number; k: number };
export function kioskAt(t: number): KioskView | null {
  if (t < 8.6 || t >= 25.2) return null;
  // María aparece en el video del punto al acercarse (10 → 11.6 s).
  const face = ss(9.6, 11.6, t);
  return { phase: t >= T_GRANT ? "GRANTED" : "SCANNING", face, k: t - T_GRANT };
}

/** Pantalla física del kiosko en 3D: concedido mientras la ve y HOLD_MS (6 s) después. */
export function kioskScreenPhase(t: number): "SCANNING" | "GRANTED" {
  return t >= T_GRANT && t < 27.4 + 6 ? "GRANTED" : "SCANNING";
}

/* ---------- Centro de control del celador (overlay) ---------- */
export type GuardView = { k: number; fresh: number };
export function guardAt(t: number): GuardView | null {
  if (t < 34.6 || t >= 43) return null;
  return { k: t - 34.6, fresh: 1 - ss(35, 38, t) };
}

/* ---------- Relé y torniquete ---------- */
export function relayAt(t: number) {
  const on = t >= T_RELAY && t < T_RELAY + 3.4 ? 1 : 0;
  const click = t >= T_RELAY && t < T_RELAY + 0.7 ? (t - T_RELAY) / 0.7 : -1;
  const signal = t >= T_RELAY && t < T_RELAY + 1.6 ? (t - T_RELAY) / 1.6 : -1;
  return { on, click, signal };
}

/* ---------- Recorrido de María ---------- */
type WP = { x: number; z: number; t: number };
const PATH: WP[] = [
  { x: -16, z: 13.95, t: 0.4 },
  { x: -4.6, z: 13.95, t: 9.2 },
  { x: -3.05, z: 12.95, t: 11.0 },
  // espera frente al kiosko
  { x: -3.05, z: 12.95, t: 25.6 },
  { x: -2.88, z: 12.35, t: 26.3 },
  { x: -2.88, z: 10.4, t: 28.3 },
  { x: -3.0, z: 6.0, t: 31.7 },
  { x: -3.1, z: -0.4, t: 36.6 },
  { x: -11.3, z: -3.4, t: 43.3 },
  { x: -14.5, z: -7.2, t: 47.2 },
];
const KIOSK_YAW = Math.atan2(P.kiosk[0] - 0.95 - -3.05, P.kiosk[1] - 12.95); // de frente a la pantalla

function along(t: number) {
  if (t <= PATH[0].t) return { x: PATH[0].x, z: PATH[0].z, i: 0, moving: false, yaw: Math.atan2(PATH[1].x - PATH[0].x, PATH[1].z - PATH[0].z) };
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    if (t < b.t) {
      const k = (t - a.t) / (b.t - a.t);
      const moving = Math.hypot(b.x - a.x, b.z - a.z) > 0.01;
      return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), i, moving, yaw: moving ? Math.atan2(b.x - a.x, b.z - a.z) : NaN };
    }
  }
  const L = PATH[PATH.length - 1];
  return { x: L.x, z: L.z, i: PATH.length - 1, moving: false, yaw: NaN };
}

/** Distancia recorrida (para la fase del paso). */
function distAt(t: number) {
  let d = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const L = Math.hypot(b.x - a.x, b.z - a.z);
    if (t >= b.t) d += L;
    else if (t > a.t) {
      d += L * ((t - a.t) / (b.t - a.t));
      break;
    } else break;
  }
  return d;
}

function angLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

const base = (x: number, z: number, yaw: number): Pose => ({ x, z, yaw, walk: 0, phase: 0, phone: 0, selfie: 0, headYaw: 0, headPitch: 0, blink: 0, sit: 0, type: 0, wave: 0 });
function idleBlink(t: number, seed: number) {
  const c = (t + seed) % 3.7;
  return c < 0.12 ? 1 : 0;
}

/** Yaw suavizado a lo largo del camino. */
function yawAt(t: number): number {
  const s = 0.35;
  const sample = (tt: number) => {
    const a = along(tt);
    if (a.moving) return a.yaw;
    if (tt >= 11 && tt < 25.6) return KIOSK_YAW;
    if (tt >= 47.2) return Math.atan2(P.lobbyA[0] - -14.5, P.lobbyA[1] - -7.2);
    return KIOSK_YAW;
  };
  // promedio angular de tres muestras para girar sin saltos
  const a = sample(t - s);
  const b = sample(t);
  const c = sample(t + s);
  return angLerp(angLerp(a, c, 0.5), b, 0.5);
}

export function mariaPose2(t: number): Pose {
  const a = along(t);
  const p = base(a.x, a.z, yawAt(t));
  // marcha: rampa suave al arrancar/detenerse
  const walking = (t > 0.4 && t < 11) || (t > 25.6 && t < 47.2);
  const ramp = walking ? clamp(Math.min((t - (t < 11 ? 0.4 : 25.6)) / 0.45, ((t < 11 ? 11 : 47.2) - t) / 0.45)) : 0;
  p.walk = ramp;
  p.phase = distAt(t) * 2.35;
  // frente al kiosko: mira la pantalla (algo más abajo que sus ojos); sin retos de parpadeo/giro.
  if (t > 10.6 && t < 25.6) p.headPitch = 0.12 * ss(10.6, 11.6, t) * (1 - ss(25, 25.6, t));
  p.blink = t > 11 && t < 18 ? 0 : idleBlink(t, 0.9);
  return p;
}

/** Ángulo del torniquete (0 → 120°) mientras María lo empuja; color del indicador. */
export function turnstileAt(t: number) {
  const z = along(t).z;
  const spin = t > 25.6 ? ss(11.95, 11.05, z) * ((Math.PI * 2) / 3) : 0;
  const unlocked = t >= T_GRANT && t < 27.9;
  return { spin, unlocked };
}

export function carlosPose2(t: number): Pose {
  const p = base(P.carlos[0], P.carlos[1], 0);
  p.sit = 1;
  p.type = 0.5 + 0.3 * Math.sin(t * 0.7);
  // mira el monitor al llegar el evento, luego hacia el interior por donde entró María
  const atMon = ss(33.2, 34.2, t) * (1 - ss(37.6, 38.4, t));
  const back = ss(38, 39, t) * (1 - ss(41.6, 42.4, t));
  p.headYaw = (0.3 * Math.sin(t * 0.23)) * (1 - atMon) * (1 - back) - 0.75 * back;
  p.headPitch = 0.12 + 0.12 * atMon;
  p.type *= 1 - atMon;
  p.blink = idleBlink(t, 1.7);
  return p;
}

/* ---------- Cámara ---------- */
export function cameraAt2(t: number, mobile: boolean): Shot {
  const kA = mobile ? { ax: 0.5, ay: 0.3 } : { ax: 0.24, ay: 0.46 }; // con kiosko a la derecha / abajo
  const dm = mobile ? 1.5 : 1;
  const mid = (a: Shot, b: Shot, k: number): Shot => ({
    p: [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k), lerp(a.p[2], b.p[2], k)],
    q: [lerp(a.q[0], b.q[0], k), lerp(a.q[1], b.q[1], k), lerp(a.q[2], b.q[2], k)],
    ax: lerp(a.ax, b.ax, k),
    ay: lerp(a.ay, b.ay, k),
  });
  const m = mariaPose2(t);
  const aerial: Shot = { p: [-34, 22, 46], q: [-8, 2, 10], ax: 0.5, ay: 0.5 };
  const follow: Shot = { p: [m.x + 3.2 * dm, 2.3, m.z + 6.2 * dm], q: [m.x - 0.6, 1.2, m.z - 0.4], ax: 0.5, ay: mobile ? 0.42 : 0.5 };
  const shoulder: Shot = { p: [-1.6, 1.95, 13.6 + 2.2 * dm], q: [-3.55, 1.25, 12.15], ...kA };
  // desde el lado del kiosko (como la cámara del punto), por encima de la pantalla
  const fd = 2.3 * dm;
  const fa = KIOSK_YAW + 0.62; // a un lado del kiosko para no taparla con su pantalla
  const face: Shot = { p: [-3.05 + Math.sin(fa) * fd, 1.78 + 0.1 * (dm - 1), 12.95 + Math.cos(fa) * fd], q: [-3.05, 1.42, 12.95], ...kA };
  const relay: Shot = { p: [-0.75, 1.72, 11.79 + 1.75 * dm], q: [-1.75, 1.3, 11.79], ...(mobile ? { ax: 0.5, ay: 0.26 } : { ax: 0.24, ay: 0.5 }) };
  const relayIn: Shot = { ...relay, p: [-0.9, 1.66, 11.79 + 1.45 * dm] };
  const gate: Shot = { p: [0.8, 2.5, 13.6 + 5 * dm], q: [-2.7, 1.2, 12.0], ...kA };
  const side: Shot = { p: [-1.25, 1.85, 11.5 - 3.4 * dm], q: [-3.0, 1.0, 11.7], ax: 0.5, ay: mobile ? 0.45 : 0.5 };
  const sideF: Shot = { p: [-0.9, 2.3, 4.2], q: [m.x, 1.1, m.z], ax: 0.5, ay: mobile ? 0.45 : 0.5 };
  const caseta: Shot = { p: [3.05, 1.78, 9.25], q: [1.35, 1.25, 11.55], ax: 0.5, ay: mobile ? 0.3 : 0.5 };
  const casetaW: Shot = { p: [4.6, 2.3, 7.0], q: [2.0, 1.2, 10.6], ax: 0.5, ay: mobile ? 0.25 : 0.5 };
  const endA: Shot = { p: [-4.5, 4.2, 6.5], q: [m.x, 1.4, m.z], ax: 0.5, ay: mobile ? 0.35 : 0.5 };
  const endB: Shot = { p: [-2, 13, 22], q: [-9, 3, -6], ax: 0.5, ay: 0.5 };

  if (t < 7) return mid(aerial, follow, ss(0, 7, t));
  if (t < 8.6) return follow;
  if (t < 11) return mid(follow, shoulder, ss(8.6, 11, t));
  if (t < 12.2) return shoulder;
  if (t < 16.2) return mid(face, { ...face, p: [face.p[0] - 0.3 * Math.sin(fa), face.p[1] - 0.04, face.p[2] - 0.3 * Math.cos(fa)] }, ss(12.2, 16.2, t)); // corte a la cara
  if (t < 20.5) return mid(relay, relayIn, ss(16.2, 20.5, t)); // corte al relé
  if (t < 25.2) return mid(gate, { ...gate, p: [gate.p[0] - 0.6, gate.p[1], gate.p[2] - 0.8] }, ss(20.5, 25.2, t));
  if (t < 29.4) return side;
  if (t < 33) return mid(side, sideF, ss(29.4, 33, t));
  if (t < 34.6) return mid(casetaW, caseta, ss(33, 34.6, t));
  if (t < 43) return caseta;
  if (t < 47) return endA;
  return mid(endA, endB, ss(47, 51, t));
}

export const RELAY_POS: V3 = [-1.6, 1.45, 11.74];
