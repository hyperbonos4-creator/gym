/**
 * URBAN · Capítulo 1 «Verificación de identidad».
 * Línea de tiempo determinista: todo (cámara, personajes y pantallas) es función de `t` (segundos),
 * así el recorrido se puede pausar, adelantar o capturar en cualquier instante.
 *
 * Textos de pantalla copiados del código real de URBAN (mobile/lib/features/onboarding/*,
 * auth/login_screen.dart, home/home_screen.dart, web/src/components/admin/access/*,
 * backend/.../template-renderer.ts). Ver /workspace/urban/AUDITORIA-3D-URBAN.md.
 */

export type V3 = [number, number, number];

/* ---------- Escenario (metros). Calle en +z, torres al fondo (-z). ---------- */
export const P = {
  lobbyA: [-14.5, -8.4] as [number, number],
  maria: [-9, -5.6] as [number, number],
  mariaYaw: 1.15,
  kiosk: [-3, 12.25] as [number, number],
  turnstile: [-3, 11.5] as [number, number],
  booth: [2, 10.2] as [number, number],
  carlos: [2, 10.75] as [number, number],
  office: [21, 1] as [number, number],
  diana: [21, 0.35] as [number, number],
  monitor: [21, 1.05, -0.35] as V3,
};

/** Reto de liveness del demo. El servidor real sortea el orden de IZQUIERDA/DERECHA/PARPADEO
 *  y SIEMPRE cierra con FRENTE (backend/src/modules/onboarding/liveness-challenge.ts). */
export type LiveAction = "LOOK_LEFT" | "LOOK_RIGHT" | "LOOK_CENTER" | "BLINK";
export const CHALLENGE: LiveAction[] = ["LOOK_RIGHT", "BLINK", "LOOK_LEFT", "LOOK_CENTER"];
export const INSTRUCTION: Record<LiveAction, string> = {
  LOOK_LEFT: "Gira la cabeza a tu IZQUIERDA",
  LOOK_RIGHT: "Gira la cabeza a tu DERECHA",
  LOOK_CENTER: "Mira de FRENTE a la cámara",
  BLINK: "PARPADEA (cierra y abre los ojos)",
};

export const DEMO = {
  maria: "María Restrepo",
  mariaFirst: "María",
  email: "maria.restrepo@correo.co",
  apto: "A-501",
  carlos: "Carlos Mendoza",
  diana: "Diana Torres",
  dianaEmail: "diana.torres@urban.co",
};

/* ---------- Beats ---------- */
export type Beat = { id: string; t0: number; t1: number; step: number; title: string; text: string };

export const STEPS = [
  "Inicia sesión",
  "Autoriza sus datos",
  "Foto del documento",
  "Prueba de vida",
  "Envía a revisión",
  "La administración aprueba",
  "Aviso por WhatsApp",
  "Acceso facial activo",
];

export const BEATS: Beat[] = [
  { id: "intro", t0: 0, t1: 7, step: 0, title: "Conjunto URBAN", text: "María Restrepo vive en la Torre A, apto 501. Hoy activa su acceso facial desde su propio celular." },
  { id: "login", t0: 7, t1: 15, step: 0, title: "Entra con su correo", text: "La app URBAN pide correo electrónico y contraseña. Sin verificación, no pasa de aquí." },
  { id: "consent", t0: 15, t1: 23, step: 1, title: "Primero, su autorización", text: "Antes de tocar su rostro, la app le pide autorizar el tratamiento de datos según la Ley 1581." },
  { id: "doc", t0: 23, t1: 34, step: 2, title: "Foto del documento", text: "Frente y reverso de su documento, dentro del marco. La app revisa la calidad antes de enviarla." },
  { id: "face", t0: 34, t1: 37, step: 3, title: "Ahora, su rostro", text: "Nada de fotos sueltas: un reto en vivo que se pide al servidor." },
  { id: "live", t0: 37, t1: 60.5, step: 3, title: "Prueba de vida en vivo", text: "El servidor sortea el orden de los movimientos y siempre termina mirando de frente. Una foto o una pantalla no lo superan." },
  { id: "submit", t0: 60.5, t1: 68, step: 4, title: "A revisión", text: "Con todo capturado, María envía su verificación. Su acceso queda en revisión." },
  { id: "admin", t0: 68, t1: 84, step: 5, title: "Una persona aprueba", text: "Diana Torres, la administradora, revisa documento, rostro y prueba de vida lado a lado. Aprueba y activa." },
  { id: "wa", t0: 84, t1: 92, step: 6, title: "Aviso por WhatsApp", text: "El WhatsApp del conjunto le avisa a María que su acceso facial ya está activo." },
  { id: "done", t0: 92, t1: 98, step: 7, title: "¡Acceso facial activo!", text: "La app se desbloquea. Desde ahora entra al conjunto con su rostro." },
  { id: "home", t0: 98, t1: 107, step: 7, title: "Listo para entrar", text: "En el inicio ve quién está en turno en portería. El siguiente capítulo: su rostro abre la puerta." },
];
export const TOUR_END = 107;

export function beatAt(t: number): number {
  for (let i = BEATS.length - 1; i >= 0; i--) if (t >= BEATS[i].t0) return i;
  return 0;
}

/* ---------- Utilidades ---------- */
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ss = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/* ---------- Pantallas del celular ---------- */
export type PhoneView =
  | { s: "login"; email: string; pass: number; press: boolean; loading: boolean }
  | { s: "consent"; checked: boolean; press: boolean; loading: boolean }
  | { s: "action"; kind: "doc" | "face" | "submit"; press: boolean; loading: boolean }
  | { s: "kyc"; side: 0 | 1; review: boolean; flash: number; press: boolean }
  | { s: "live"; stage: "init" | "ready" | "detect" | "ok" | "upload"; idx: number; count: number; progress: number; hold: boolean }
  | { s: "info"; kind: "wait" | "done"; press: boolean }
  | { s: "wa"; k: number }
  | { s: "home" };

/** Tiempos del reto: 3 s de cuenta regresiva (como `_runGetReady`), detección, 0,6 s de «¡Perfecto!». */
const LIVE_T0 = 37.8;
const LIVE_STEP = 5.4; // 3 + 1.8 + 0.6
const LIVE_UPLOAD = LIVE_T0 + LIVE_STEP * 4; // 59.4

export function liveAt(t: number): { stage: "init" | "ready" | "detect" | "ok" | "upload"; idx: number; count: number; progress: number; hold: boolean; local: number } {
  if (t < LIVE_T0) return { stage: "init", idx: 0, count: 3, progress: 0, hold: false, local: 0 };
  if (t >= LIVE_UPLOAD) return { stage: "upload", idx: 3, count: 1, progress: 1, hold: false, local: t - LIVE_UPLOAD };
  const idx = Math.floor((t - LIVE_T0) / LIVE_STEP);
  const l = t - LIVE_T0 - idx * LIVE_STEP;
  if (l < 3) return { stage: "ready", idx, count: 3 - Math.floor(l), progress: 0, hold: false, local: l };
  if (l < 4.8) {
    const p = clamp((l - 3.2) / 1.3);
    return { stage: "detect", idx, count: 1, progress: p, hold: p > 0.55, local: l };
  }
  return { stage: "ok", idx, count: 1, progress: 1, hold: false, local: l };
}

export function phoneAt(t: number): PhoneView | null {
  if (t < 7.6) return null;
  if (t < 15) {
    const email = DEMO.email.slice(0, Math.floor(clamp((t - 8.4) / 2.2) * DEMO.email.length));
    const pass = Math.floor(clamp((t - 11) / 1) * 10);
    return { s: "login", email, pass, press: t > 12.6 && t < 12.9, loading: t >= 12.9 };
  }
  if (t < 23) return { s: "consent", checked: t > 19, press: t > 21 && t < 21.3, loading: t >= 21.3 };
  if (t < 25) return { s: "action", kind: "doc", press: t > 24.4 && t < 24.7, loading: t >= 24.7 };
  if (t < 33.6) {
    const side: 0 | 1 = t < 29.4 ? 0 : 1;
    const base = side === 0 ? 25 : 29.4;
    const l = t - base;
    return { s: "kyc", side, review: l > 2.6, flash: clamp(1 - Math.abs(l - 2.4) / 0.25), press: l > 3.8 };
  }
  if (t < 34) return { s: "action", kind: "doc", press: false, loading: true };
  if (t < 37) return { s: "action", kind: "face", press: t > 35.9 && t < 36.2, loading: t >= 36.2 };
  if (t < 61.2) {
    const L = liveAt(t);
    return { s: "live", stage: L.stage, idx: L.idx, count: L.count, progress: L.progress, hold: L.hold };
  }
  if (t < 64.6) return { s: "action", kind: "submit", press: t > 63.4 && t < 63.7, loading: t >= 63.7 };
  if (t < 68) return { s: "info", kind: "wait", press: false };
  if (t < 84.2) return null; // la cámara está en la oficina de administración
  if (t < 84.4) return { s: "info", kind: "wait", press: false };
  if (t < 92.4) return { s: "wa", k: t - 84.4 };
  if (t < 94) return { s: "info", kind: "wait", press: t > 93 && t < 93.4 };
  if (t < 98.4) return { s: "info", kind: "done", press: t > 97.2 && t < 97.6 };
  return { s: "home" };
}

/** Panel de administración (pestaña Aprobaciones del «Control de acceso facial»). */
export type AdminView = { s: "list" | "modal" | "busy" | "empty"; press: boolean; k: number };
export function adminAt(t: number): AdminView | null {
  if (t < 70 || t >= 84.2) return null;
  const k = t - 70;
  if (t < 74) return { s: "list", press: t > 73.4, k };
  if (t < 80) return { s: "modal", press: t > 79.6, k };
  if (t < 81.4) return { s: "busy", press: false, k };
  return { s: "empty", press: false, k };
}

/* ---------- Personajes ---------- */
export type Pose = {
  x: number;
  z: number;
  yaw: number;
  walk: number;
  phase: number;
  phone: number;
  selfie: number;
  headYaw: number;
  headPitch: number;
  blink: number;
  sit: number;
  type: number;
  wave: number;
};
const base = (x: number, z: number, yaw: number): Pose => ({ x, z, yaw, walk: 0, phase: 0, phone: 0, selfie: 0, headYaw: 0, headPitch: 0, blink: 0, sit: 0, type: 0, wave: 0 });

/** Parpadeo natural cada pocos segundos. */
function idleBlink(t: number, seed: number) {
  const c = (t + seed) % 3.7;
  return c < 0.12 ? 1 : 0;
}

export function mariaPose(t: number, touring: boolean): Pose {
  const [mx, mz] = P.maria;
  if (!touring) {
    const p = base(mx, mz, P.mariaYaw);
    p.phone = 1;
    p.headPitch = 0.22;
    p.blink = idleBlink(t, 0.4);
    return p;
  }
  // Sale del lobby de la Torre A y camina hasta el jardín.
  const [lx, lz] = P.lobbyA;
  const k = ss(1.2, 6.4, t);
  const x = lerp(lx, mx, k);
  const z = lerp(lz, mz, k);
  const walkYaw = Math.atan2(mx - lx, mz - lz);
  const p = base(x, z, lerp(walkYaw, P.mariaYaw, ss(6.0, 7.2, t)));
  const dist = Math.hypot(mx - lx, mz - lz) * k;
  p.walk = t > 1.2 && t < 6.6 ? clamp(Math.min((t - 1.2) / 0.5, (6.6 - t) / 0.5)) : 0;
  p.phase = dist * 2.35;
  p.phone = ss(6.2, 7.2, t);
  p.headPitch = 0.22 * p.phone;
  p.blink = idleBlink(t, 0.4);
  // Prueba de vida: sube el celular frente a la cara y sigue las indicaciones.
  const selfie = t > 36 && t < 60 ? clamp(Math.min((t - 36) / 0.9, (60 - t) / 0.8)) : 0;
  p.selfie = selfie;
  if (selfie > 0) p.headPitch = lerp(p.headPitch, 0, selfie);
  if (t >= LIVE_T0 && t < LIVE_UPLOAD) {
    const L = liveAt(t);
    const a = CHALLENGE[L.idx];
    const on = L.stage === "detect" ? ss(3.0, 3.6, L.local) : L.stage === "ok" ? 1 - ss(5.0, 5.4, L.local) : 0;
    if (a === "LOOK_LEFT") p.headYaw = 0.55 * on;
    if (a === "LOOK_RIGHT") p.headYaw = -0.55 * on;
    if (a === "BLINK") p.blink = L.stage === "detect" && L.local > 3.4 && L.local < 3.75 ? 1 : 0;
  }
  // Al final guarda el celular y mira hacia la portería.
  p.phone = Math.max(selfie, p.phone * (1 - ss(103, 104.5, t)));
  if (t > 103) p.yaw = lerp(P.mariaYaw, 0.55, ss(103, 105, t));
  return p;
}

export function carlosPose(t: number): Pose {
  const p = base(P.carlos[0], P.carlos[1], 0);
  p.sit = 1;
  p.type = 0.6 + 0.4 * Math.sin(t * 0.7);
  p.headYaw = 0.35 * Math.sin(t * 0.23) + 0.15 * Math.sin(t * 0.71);
  p.headPitch = 0.12;
  p.blink = idleBlink(t, 1.7);
  return p;
}

export function dianaPose(t: number): Pose {
  const p = base(P.diana[0], P.diana[1], Math.PI);
  p.sit = 1;
  p.type = t > 70 && t < 84 ? 1 : 0.4 + 0.3 * Math.sin(t * 0.9);
  p.headYaw = t > 70 && t < 84 ? 0.05 * Math.sin(t * 2) : 0.25 * Math.sin(t * 0.31);
  p.headPitch = 0.1;
  p.blink = idleBlink(t, 2.3);
  return p;
}

/* ---------- Cámara ---------- */
export type Shot = { p: V3; q: V3; ax: number; ay: number };

/** Ancla en pantalla: dónde debe quedar el sujeto según la superposición (celular a la derecha,
 *  o en la mitad inferior en móvil). ax/ay en fracción de pantalla. */
function shotAt(t: number, mobile: boolean): Shot {
  const [mx, mz] = P.maria;
  const phoneA = mobile ? { ax: 0.5, ay: 0.36 } : { ax: 0.36, ay: 0.5 };
  const dm = mobile ? 1.8 : 1;
  const mid = (a: Shot, b: Shot, k: number): Shot => ({
    p: [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k), lerp(a.p[2], b.p[2], k)],
    q: [lerp(a.q[0], b.q[0], k), lerp(a.q[1], b.q[1], k), lerp(a.q[2], b.q[2], k)],
    ax: lerp(a.ax, b.ax, k),
    ay: lerp(a.ay, b.ay, k),
  });
  const aerial: Shot = { p: [46, 34, 52], q: [0, 5, -6], ax: 0.5, ay: 0.5 };
  const Y = P.mariaYaw;
  const around = (d: number, a: number, h: number): V3 => [mx + d * Math.sin(Y + a), h, mz + d * Math.cos(Y + a)];
  const fx = Math.sin(Y);
  const fz = Math.cos(Y);
  const toMaria: Shot = { p: [mx + 9, 6.5, mz + 9], q: [mx - 1, 1.8, mz - 1], ax: 0.5, ay: 0.5 };
  const medium: Shot = { p: around(3.6 * dm, 0.42, 1.75), q: [mx, 1.22, mz], ...phoneA };
  const medium2: Shot = { p: around(2.9 * dm, 0.3, 1.65), q: [mx, 1.28, mz], ...phoneA };
  const close: Shot = { p: around(1.35 * dm, 0.85, 1.62), q: [mx + 0.12 * fx, 1.5, mz + 0.12 * fz], ...phoneA };
  const officeW: Shot = { p: [P.office[0] + 3.2, 2.4, P.office[1] + 6.5], q: [P.office[0], 1.3, P.office[1]], ax: 0.5, ay: 0.5 };
  const officeC: Shot = { p: [P.office[0] + 1.1, 1.75, P.office[1] + 2.6], q: [P.monitor[0], 1.15, P.monitor[2]], ax: 0.5, ay: mobile ? 0.15 : 0.5 };
  const endA: Shot = { p: [mx - 4, 4.5, mz + 9], q: [-6, 2.5, 6], ax: 0.5, ay: mobile ? 0.25 : 0.5 };
  const endB: Shot = { p: [-10, 14, 34], q: [-1, 2, 8], ax: 0.5, ay: mobile ? 0.3 : 0.5 };

  if (t < 7) return mid(aerial, toMaria, ss(0, 7, t));
  if (t < 9) return mid(toMaria, medium, ss(7, 9, t));
  if (t < 34) return mid(medium, medium2, ss(9, 34, t));
  if (t < 37.5) return mid(medium2, close, ss(34.5, 37.5, t));
  if (t < 60.5) return close;
  if (t < 68) return mid(close, medium, ss(60.5, 62.5, t));
  if (t < 71) return mid(officeW, officeC, ss(68, 71, t));
  if (t < 84) return officeC;
  if (t < 98) return medium2;
  if (t < 102) return mid(medium2, endA, ss(98, 102, t));
  return mid(endA, endB, ss(102, 107, t));
}

/** Corte seco en los cambios de lugar (oficina ↔ María); el resto, transiciones suaves. */
export function cameraAt(t: number, mobile: boolean): Shot {
  return shotAt(t, mobile);
}
