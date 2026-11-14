/**
 * URBAN · Capítulo 4 «Invitados, sin códigos».
 * Determinista en `t` (segundos): `?ch=4&tour=1&t=NN&pause=1`.
 *
 * Fuente (código real de URBAN):
 *  - mobile/lib/features/visitors/invitations_screen.dart (Invitaciones · Activas/Historial/Mis visitantes,
 *    estado «Activa» / «Adentro»), new_invitation_screen.dart (5 pasos, sin foto; snackbar
 *    «Invitación generada»), qr_screen.dart («Estado de la invitación»: timeline sin QR ni PIN).
 *  - web/src/app/(guardstation)/guardstation/access/page.tsx («Ingresos»), exits/page.tsx («Salidas»),
 *    components/guard/PendingInvitationsList.tsx, InvitationDetailView.tsx, AuthorizeEntryButton.tsx
 *    («Permitir ingreso» → «¿Permitir ingreso?» → POST /visitors/invitations/:id/manual-verification;
 *    «Permitir salida» → POST /register-exit).
 *  - backend/src/modules/visitors/visitors.service.ts `authorizeManualVerification` / `registerExit`
 *    (entryMethod INVITATION, status USED con maxUses 1). Desde el fix `fix/visitor-relay-encoding`
 *    ambos accionan el relé del Access_Point (VisitorDoorService → DoorControllerPort, el mismo del
 *    acceso facial / «Abrir» manual) ANTES de registrar: si el relé no confirma → 503
 *    «No se pudo abrir la puerta…» y no se registra; `door:opened` solo si abrió) y
 *    services/visitors-notifier.service.ts (push FCM «Tu invitado ingresó» /
 *    «Tu invitado salió», hora HH:mm h23 en la zona del conjunto).
 */

import { P, clamp, ss, type Pose, type Shot } from "./tour";

export type Beat = { id: string; t0: number; t1: number; step: number; title: string; text: string };

export const STEPS4 = ["Invita desde la app", "Enviada a portería", "Carlos verifica", "Push a María", "Salida registrada"];

export const BEATS4: Beat[] = [
  { id: "intro", t0: 0, t1: 5, step: 0, title: "Invitados, sin códigos", text: "María espera a Andrés López. No le manda un QR ni un PIN: avisa a la portería desde la app." },
  { id: "invite", t0: 5, t1: 16, step: 0, title: "«Nueva Invitación»", text: "Nombre completo, documento opcional y razón «Invitado». Sin foto del visitante: la identidad la valida el celador en portería." },
  { id: "sent", t0: 16, t1: 23.5, step: 1, title: "Enviada a los celadores en turno", text: "Queda activa 30 minutos y aparece en «Ingresos». María sigue el estado en vivo, sin ningún código." },
  { id: "arrive", t0: 23.5, t1: 30, step: 2, title: "Andrés llega a portería", text: "No muestra nada en el celular: dice su nombre y a quién visita. Carlos lo encuentra en «Ingresos»." },
  { id: "detail", t0: 30, t1: 37.4, step: 2, title: "Carlos coteja los datos", text: "Nombre, documento, quién lo invitó y la ventana horaria. Si algo no coincide, puede «Denegar entrada» con un motivo." },
  { id: "allow", t0: 37.4, t1: 40.6, step: 2, title: "«Permitir ingreso»", text: "«Vas a abrir la puerta y registrar la entrada del visitante». Carlos confirma." },
  { id: "pass", t0: 40.6, t1: 47.5, step: 2, title: "El relé abre el torniquete", text: "El backend acciona el relé del punto y solo si confirma registra la entrada «Por invitación», a nombre de Carlos. Si no abre, no se registra." },
  { id: "pushIn", t0: 47.5, t1: 53.5, step: 3, title: "«Tu invitado ingresó»", text: "Push al celular de María (FCM, no WhatsApp). En su app: «Visitante adentro · Autorizó Carlos Mendoza»." },
  { id: "exit", t0: 53.5, t1: 60, step: 4, title: "Más tarde: «Permitir salida»", text: "Andrés se va. Carlos lo busca en «Salidas» y confirma: el relé abre la salida y la invitación pasa al historial." },
  { id: "pushOut", t0: 60, t1: 66, step: 4, title: "«Tu invitado salió»", text: "Otro push con la hora y quién registró la salida. Todo queda en el historial de María y en la bitácora." },
];
export const TOUR_END4 = 66;

export function beatAt4(t: number): number {
  for (let i = BEATS4.length - 1; i >= 0; i--) if (t >= BEATS4[i].t0) return i;
  return 0;
}

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/* ---------- Tiempos ---------- */
export const T_GEN = 15.6; // POST /visitors/invitations (16:52)
export const T_ROW = 30.2; // Carlos abre el detalle
export const T_ALLOW = 37.7; // pulsa «Permitir ingreso»
export const T_CONFIRM = 40.3; // «Sí, permitir ingreso»
export const T_ENTRY = 41.0; // access creado · 17:00
export const T_PUSH_IN = 48.0;
export const T_EXIT_ROW = 55.0;
export const T_EXIT_BTN = 56.0;
export const T_EXIT_CONFIRM = 57.5;
export const T_EXIT = 58.0; // salida registrada · 19:24
export const T_RELAY_IN = 40.9; // VisitorDoorService → door.open (ingreso)
export const T_RELAY_OUT = 57.85; // VisitorDoorService → door.open (salida)

/* ---------- Relé del punto (mismo efecto que el capítulo 2) ---------- */
export function relayAt4(t: number) {
  for (const T of [T_RELAY_IN, T_RELAY_OUT]) {
    if (t >= T && t < T + 3.4) {
      return { on: 1, click: t < T + 0.7 ? (t - T) / 0.7 : -1, signal: t < T + 1.6 ? (t - T) / 1.6 : -1 };
    }
  }
  return { on: 0, click: -1, signal: -1 };
}
export const T_PUSH_OUT = 60.6;

export const DATE4 = "2026-11-21";
export const DATE_GUARD4 = "sábado, 21 de nov de 2026";
export const DATE_LONG4 = "sáb, 21 de nov de 2026";
export const WIN4 = { start: "16:52", end: "17:22" };
export const ENTRY_HM = "17:00";
export const ENTRY_12 = "05:00 p. m.";
export const EXIT_HM = "19:24";
export const ANDRES = { name: "Andrés López", doc: "1020456789", initials: "AL" };
export const MARIA4 = { phone: "300 555 0142", userId: "4f1c9a2e", tower: "A", apto: "501", floor: "5" };

const p2 = (n: number) => String(n).padStart(2, "0");
function fmt(sec: number) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const h12 = h % 12 || 12;
  const ap = h < 12 ? "a. m." : "p. m.";
  return { hm: `${p2(h)}:${p2(m)}`, h12pad: `${p2(h12)}:${p2(m)}:${p2(x)} ${ap}`, sec: s };
}
/** Reloj del conjunto: 16:52 al generar; 17:00 al entrar; salto a la noche para la salida. */
export function clock4(t: number) {
  if (t < 24) return fmt(16 * 3600 + 52 * 60 + 10 + (t - T_GEN) * 2);
  if (t < 53.5) return fmt(17 * 3600 + 0 * 60 + 6 + (t - T_ENTRY));
  return fmt(19 * 3600 + 24 * 60 + 2 + (t - T_EXIT));
}
/** «Expira en mm:ss» de la fila (fin de la ventana 17:22). */
export function expiresIn(t: number) {
  const left = Math.max(0, 17 * 3600 + 22 * 60 - clock4(t).sec);
  return `${p2(Math.floor(left / 60))}:${p2(left % 60)}`;
}

/* ---------- App de María (overlay) ---------- */
export type PhoneView4 =
  | { s: "list"; mode: "empty" | "active" | "inside"; press: boolean; snack: number; t: number }
  | { s: "form"; name: string; doc: string; focus: "name" | "doc" | null; scroll: number; press: boolean; loading: boolean }
  | { s: "status"; stage: "wait" | "inside" | "out"; notif: number };

function typed(full: string, t0: number, t1: number, t: number) {
  const n = Math.round(clamp((t - t0) / (t1 - t0)) * full.length);
  return full.slice(0, n);
}
export function phoneAt4(t: number): PhoneView4 | null {
  if (t >= 4.5 && t < 6.6) return { s: "list", mode: "empty", press: t > 6.1, snack: 0, t };
  if (t >= 6.6 && t < T_GEN)
    return {
      s: "form",
      name: typed(ANDRES.name, 7.4, 9.0, t),
      doc: typed(ANDRES.doc, 9.6, 11.0, t),
      focus: t > 7.1 && t < 9.3 ? "name" : t >= 9.3 && t < 11.4 ? "doc" : null,
      scroll: ss(11.8, 13.4, t),
      press: t > 14.6 && t < 15.0,
      loading: t >= 15.0,
    };
  if (t >= T_GEN && t < 18.5) return { s: "list", mode: "active", press: t > 18.0, snack: t < 18.4 ? 1 : 0, t };
  if (t >= 18.5 && t < 23.5) return { s: "status", stage: "wait", notif: 0 };
  if (t >= 47.5 && t < 53.5) return { s: "status", stage: t >= 49.2 ? "inside" : "wait", notif: ss(T_PUSH_IN, T_PUSH_IN + 0.4, t) * (1 - ss(51.6, 52.0, t)) };
  if (t >= 60.2 && t < TOUR_END4 + 1) return { s: "status", stage: t >= T_PUSH_OUT ? "out" : "inside", notif: ss(T_PUSH_OUT, T_PUSH_OUT + 0.4, t) * (1 - ss(64.6, 65.0, t)) };
  return null;
}

/* ---------- Centro de control (overlay) ---------- */
export type GuardView4 =
  | { page: "access"; sel: boolean; press: number; dialog: boolean; confirm: boolean; busy: boolean; done: boolean; t: number }
  | { page: "exits"; sel: boolean; press: number; dialog: boolean; confirm: boolean; busy: boolean; done: boolean; t: number };
export function guardAt4(t: number): GuardView4 | null {
  if (t >= 27 && t < 40.65)
    return {
      page: "access",
      sel: t >= T_ROW && t < T_ENTRY,
      press: t > T_ROW - 0.35 && t < T_ROW ? 1 : t > T_ALLOW - 0.3 && t < T_ALLOW ? 2 : 0,
      dialog: t >= T_ALLOW + 0.2 && t < T_ENTRY,
      confirm: t > T_CONFIRM - 0.3 && t < T_CONFIRM + 0.1,
      busy: t >= T_CONFIRM && t < T_ENTRY,
      done: t >= T_ENTRY,
      t,
    };
  if (t >= 53.8 && t < 57.75)
    return {
      page: "exits",
      sel: t >= T_EXIT_ROW && t < T_EXIT,
      press: t > T_EXIT_ROW - 0.35 && t < T_EXIT_ROW ? 1 : t > T_EXIT_BTN - 0.3 && t < T_EXIT_BTN ? 2 : 0,
      dialog: t >= T_EXIT_BTN + 0.15 && t < T_EXIT,
      confirm: t > T_EXIT_CONFIRM - 0.3 && t < T_EXIT_CONFIRM + 0.1,
      busy: t >= T_EXIT_CONFIRM && t < T_EXIT,
      done: t >= T_EXIT,
      t,
    };
  return null;
}

/* ---------- Caminos ---------- */
export type WP = { x: number; z: number; t: number };
export function along(path: WP[], t: number) {
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
export function angLerp(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
export const base = (x: number, z: number, yaw: number): Pose => ({ x, z, yaw, walk: 0, phase: 0, phone: 0, selfie: 0, headYaw: 0, headPitch: 0, blink: 0, sit: 0, type: 0, wave: 0 });
export const FAR: Pose = base(-1000, -1000, 0);
export const blinkAt = (t: number, s: number) => ((t + s) % 3.9 < 0.12 ? 1 : 0);
export function walker(path: WP[], t: number, stillYaw: (t: number) => number) {
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

const WINDOW = { x: 0.3, z: 12.75 };
const NEAR_MARIA = { x: -8.0, z: -4.7 };
/* Entrada: llega por el andén, habla en la ventana de la caseta, pasa y va hacia la Torre A. */
const IN_PATH: WP[] = [
  { x: 9.5, z: 13.95, t: 21.0 },
  { x: 2.2, z: 13.4, t: 25.4 },
  { x: WINDOW.x, z: WINDOW.z, t: 26.6 },
  { x: WINDOW.x, z: WINDOW.z, t: 42.6 },
  { x: -2.88, z: 12.35, t: 44.2 },
  { x: -2.88, z: 10.4, t: 46.2 },
  { x: -3.0, z: 6.0, t: 48.6 },
  { x: -3.1, z: 0.6, t: 51.4 },
  { x: NEAR_MARIA.x, z: NEAR_MARIA.z, t: 53.4 },
];
/* Salida (más tarde): vuelve al torniquete por dentro, espera la salida y se va por el andén. */
const OUT_PATH: WP[] = [
  { x: -3.0, z: 7.0, t: 53.5 },
  { x: -2.95, z: 10.35, t: 56.0 },
  { x: -2.95, z: 10.35, t: 58.3 },
  { x: -2.88, z: 12.6, t: 59.9 },
  { x: -5.0, z: 13.95, t: 61.0 },
  { x: -16, z: 13.95, t: 67.5 },
];
export function andresPose4(t: number): Pose {
  if (t < 20) return FAR;
  if (t < 53.5) {
    const p = walker(IN_PATH, t, (tt) => (tt < 45 ? Math.PI + 0.12 : Math.atan2(P.maria[0] - NEAR_MARIA.x, P.maria[1] - NEAR_MARIA.z)));
    if (t > 26.6 && t < 42.6) p.headYaw = 0.12 * Math.sin(t * 1.3);
    if (t > 52.6) p.wave = ss(52.6, 53.0, t);
    p.blink = blinkAt(t, 1.1);
    return p;
  }
  const p = walker(OUT_PATH, t, () => 0.15);
  if (t > 56 && t < 58.3) p.headYaw = 0.5; // mira a la caseta
  p.blink = blinkAt(t, 0.6);
  return p;
}
export function turnstileAt4(t: number) {
  if (t < 53.5) {
    const z = along(IN_PATH, t).z;
    const spin = t > 43 ? ss(11.95, 11.05, z) * ((Math.PI * 2) / 3) : 0;
    return { spin, unlocked: t >= T_RELAY_IN + 0.25 && t < 46.4 };
  }
  const z = along(OUT_PATH, t).z;
  const spin = -ss(11.05, 11.95, z) * ((Math.PI * 2) / 3);
  return { spin, unlocked: t >= T_RELAY_OUT + 0.25 && t < 60.4 };
}
export function mariaPose4(t: number): Pose {
  const [mx, mz] = P.maria;
  const p = base(mx, mz, P.mariaYaw);
  const on = (a: number, b: number) => ss(a, a + 0.8, t) * (1 - ss(b - 0.8, b, t));
  p.phone = Math.max(on(3.6, 24.4), on(47.4, 53.0), on(59.8, 70));
  p.headPitch = 0.22 * p.phone;
  if (t > 52.2 && t < 54) {
    p.yaw = angLerp(P.mariaYaw, Math.atan2(NEAR_MARIA.x - mx, NEAR_MARIA.z - mz), ss(52.2, 52.9, t));
    p.wave = ss(52.8, 53.2, t);
  }
  p.blink = blinkAt(t, 0.4);
  return p;
}
export function carlosPose4(t: number): Pose {
  const p = base(P.carlos[0], P.carlos[1], 0);
  p.sit = 1;
  const talk = ss(26.4, 27.2, t) * (1 - ss(42.6, 43.4, t));
  const mon = ss(29.6, 30.2, t) * (1 - ss(41.2, 41.8, t));
  const out = ss(55.2, 55.8, t) * (1 - ss(59.6, 60.2, t));
  p.headYaw = 0.3 * Math.sin(t * 0.23) * (1 - talk) * (1 - out) + talk * -0.62 * (1 - mon) + out * -1.0 * (1 - mon);
  p.headPitch = 0.12 + 0.14 * mon - 0.05 * talk * (1 - mon);
  p.type = (0.5 + 0.3 * Math.sin(t * 0.7)) * (1 - talk) * (1 - out) + ((t > 37.4 && t < 37.8) || (t > 40.0 && t < 40.4) || (t > 55.7 && t < 56.1) || (t > 57.2 && t < 57.6) ? 1 : 0);
  p.blink = blinkAt(t, 1.7);
  return p;
}

/* ---------- Cámara ---------- */
export function cameraAt4(t: number, mobile: boolean): Shot {
  const [mx, mz] = P.maria;
  const phoneA = mobile ? { ax: 0.5, ay: 0.36 } : { ax: 0.36, ay: 0.5 };
  const gA = mobile ? { ax: 0.5, ay: 0.25 } : { ax: 0.5, ay: 0.5 };
  const dm = mobile ? 1.6 : 1;
  const mid = (a: Shot, b: Shot, k: number): Shot => ({
    p: [lerp(a.p[0], b.p[0], k), lerp(a.p[1], b.p[1], k), lerp(a.p[2], b.p[2], k)],
    q: [lerp(a.q[0], b.q[0], k), lerp(a.q[1], b.q[1], k), lerp(a.q[2], b.q[2], k)],
    ax: lerp(a.ax, b.ax, k),
    ay: lerp(a.ay, b.ay, k),
  });
  const Y = P.mariaYaw;
  const around = (d: number, a: number, h: number): [number, number, number] => [mx + d * Math.sin(Y + a), h, mz + d * Math.cos(Y + a)];
  const an = andresPose4(t);
  const aerial: Shot = { p: [30, 24, 46], q: [-4, 2, 2], ax: 0.5, ay: 0.5 };
  const toMaria: Shot = { p: [mx + 9, 6.5, mz + 9], q: [mx - 1, 1.8, mz - 1], ax: 0.5, ay: 0.5 };
  const medium: Shot = { p: around(3.4 * dm, 0.42, 1.75), q: [mx, 1.25, mz], ...phoneA };
  const medium2: Shot = { p: around(2.8 * dm, 0.3, 1.65), q: [mx, 1.3, mz], ...phoneA };
  const street: Shot = { p: [-1.2, 2.0, 13.6 + 4.4 * dm], q: [an.x, 1.3, an.z], ...gA };
  const booth: Shot = { p: [3.45, 2.05, 9.25], q: [0.9, 1.4, 12.5], ax: 0.5, ay: mobile ? 0.3 : 0.5 };
  const gateOpen: Shot = { p: [0.9, 2.4, 13.6 + 4.6 * dm], q: [-2.2, 1.2, 12.0], ...gA };
  const follow: Shot = { p: [-0.2, 2.6, 4.2], q: [an.x, 1.2, an.z], ...gA };
  const meet: Shot = { p: around(5.2 * dm, 0.95, 2.1), q: [mx + 0.6, 1.3, mz + 0.4], ...phoneA };
  const inside: Shot = { p: [0.4, 2.5, 13.6 + 4.9 * dm], q: [-3.4, 1.2, 11.6], ...gA };
  const endB: Shot = { p: [-12, 14, 34], q: [-3, 2, 8], ax: 0.5, ay: mobile ? 0.3 : 0.5 };

  if (t < 5) return mid(aerial, toMaria, ss(0, 5, t));
  if (t < 7) return mid(toMaria, medium, ss(5, 7, t));
  if (t < 23.5) return mid(medium, medium2, ss(7, 23.5, t));
  if (t < 27) return street;
  if (t < 40.65) return mid(booth, { ...booth, p: [3.3, 2.0, 9.5] }, ss(27, 40.65, t));
  if (t < 46.6) return gateOpen;
  if (t < 47.5) return follow;
  if (t < 53.5) return meet;
  if (t < 61.5) return inside;
  return mid(inside, endB, ss(61.5, 66, t));
}
