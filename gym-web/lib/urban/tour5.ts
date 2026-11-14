/**
 * Capítulo 5 · «Un paquete en portería».
 * Basado en el código real de URBAN:
 * - Centro de control: (guardstation)/guardstation/packages/new/page.tsx («Registrar paquete») y
 *   packages/page.tsx («Paquetería», modal «Entregar paquete»).
 * - Backend: packages.service.ts receive() → push FCM «Tienes un paquete» (estado PENDING);
 *   deliver() → DELIVERED + deliveredAt + deliveredToResidentId y push «Paquete entregado» al apartamento.
 * - App Flutter: packages_screen.dart y package_detail_screen.dart.
 * Sin WhatsApp (los avisos de paquetes son push FCM). La verificación del documento es un paso físico.
 */
import { P, clamp, ss, type Pose, type Shot } from "./tour";
import { FAR, base, blinkAt, lerp, walker, type Beat, type WP } from "./tour4";

export const STEPS5 = ["Llega la caja", "Carlos la registra", "Push a María", "Retira con su documento", "Entregado"];

export const BEATS5: Beat[] = [
  { id: "intro", t0: 0, t1: 5, step: 0, title: "Un paquete en portería", text: "Llega una caja de Servientrega para María. Carlos la registra en el Centro de Control y la app le avisa: sin llamadas ni WhatsApp." },
  { id: "arrive", t0: 5, t1: 12, step: 0, title: "Llega la transportadora", text: "El mensajero deja la caja en la ventana de la caseta. Turno Tarde, 3:41 p. m." },
  { id: "register", t0: 12, t1: 18.5, step: 1, title: "«Registrar paquete»", text: "Carlos busca a la destinataria por nombre o documento: «✓ Recibirá notificación push al registrarse el paquete.»" },
  { id: "data", t0: 18.5, t1: 24, step: 1, title: "Datos del paquete", text: "Transportadora, guía y descripción. Al registrar, el backend guarda el paquete a nombre de Carlos y avisa al apartamento." },
  { id: "push", t0: 24, t1: 29, step: 2, title: "«Tienes un paquete»", text: "Push FCM al apartamento: «Servientrega disponible en portería · Torre A · Apto 501»." },
  { id: "detail", t0: 29, t1: 34, step: 2, title: "Detalle en la app", text: "Estado «Pendiente de recoger»: «Pasa por portería con tu documento para recoger el paquete.»" },
  { id: "pickup", t0: 34, t1: 42.5, step: 3, title: "María pasa por portería", text: "Más tarde, 6:10 p. m. María muestra su documento en la caseta; Carlos lo verifica en persona." },
  { id: "deliver", t0: 42.5, t1: 48.6, step: 4, title: "«Entregar paquete»", text: "En «Paquetería» Carlos pulsa «Entregar», elige quién recibe y confirma. Queda la hora y a quién se entregó." },
  { id: "pushDel", t0: 48.6, t1: 58, step: 4, title: "«Paquete entregado»", text: "Push a todo el apartamento: «Servientrega entregado a María Restrepo · Torre A · Apto 501». En la app: «Entregado»." },
];
export const TOUR_END5 = 58;

export function beatAt5(t: number): number {
  for (let i = BEATS5.length - 1; i >= 0; i--) if (t >= BEATS5[i].t0) return i;
  return 0;
}

/* ---------- Datos demo ---------- */
export const PKG = { carrier: "Servientrega", tracking: "2611458733", desc: "Caja mediana" };
export const MARIA5 = { doc: "CC 43512876", phone: "300 555 0142", apt: "Torre A · Apto 501", floor: "Torre A · Apto 501 · Piso 5" };
export const DATE_GUARD5 = "lunes, 23 de nov de 2026";
export const RECV_DATE = "23/11/2026 15:42";
export const DELIV_DATE = "23/11/2026 18:12";

export const T_HAND = 9.6; // la caja pasa al mostrador
export const T_SELECT = 15.2; // Carlos elige a María
export const T_CHIP = 17.2; // «Servientrega»
export const T_SUBMIT = 22.0; // «Registrar paquete»
export const T_DONE = 22.6; // POST /packages → push
export const T_PUSH = 25.0;
export const T_OPEN = 28.2; // María toca el push → /packages/:id
export const T_ENTREGAR = 43.6;
export const T_CONFIRM5 = 46.0;
export const T_DELIV = 46.6; // POST /packages/:id/deliver
export const T_PUSH_DEL = 49.2;

const p2 = (n: number) => String(n).padStart(2, "0");
function fmt(sec: number) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const h12 = h % 12 || 12;
  const ap = h < 12 ? "a. m." : "p. m.";
  return { hm: `${p2(h)}:${p2(m)}`, h12pad: `${p2(h12)}:${p2(m)}:${p2(x)} ${ap}` };
}
/** Reloj: 15:41 al llegar la caja; salto a las 18:10 para el retiro. */
export function clock5(t: number) {
  if (t < 34) return fmt(15 * 3600 + 41 * 60 + 20 + t * 2);
  return fmt(18 * 3600 + 10 * 60 + 5 + (t - 34) * 12);
}

function typed(full: string, t0: number, t1: number, t: number) {
  const n = Math.round(clamp((t - t0) / (t1 - t0)) * full.length);
  return full.slice(0, n);
}

/* ---------- App de María ---------- */
export type PhoneView5 =
  | { s: "list"; press: boolean; notif: number }
  | { s: "detail"; delivered: boolean; notif: number; time: string };
export function phoneAt5(t: number): PhoneView5 | null {
  if (t >= 24 && t < T_OPEN) return { s: "list", press: t > T_OPEN - 0.35, notif: ss(T_PUSH, T_PUSH + 0.4, t) * (1 - ss(T_OPEN - 0.4, T_OPEN - 0.1, t)) };
  if (t >= T_OPEN && t < 34) return { s: "detail", delivered: false, notif: 0, time: "15:42" };
  if (t >= 48.6 && t < TOUR_END5 + 1) return { s: "detail", time: "18:12", delivered: t >= T_PUSH_DEL + 0.6, notif: ss(T_PUSH_DEL, T_PUSH_DEL + 0.4, t) * (1 - ss(54.6, 55.0, t)) };
  return null;
}

/* ---------- Centro de control ---------- */
export type GuardView5 =
  | {
      page: "new";
      q: string;
      searching: boolean;
      results: boolean;
      press: number; // 1 fila · 2 chip · 3 registrar
      selected: boolean;
      chip: boolean;
      tracking: string;
      desc: string;
      focus: "q" | "carrier" | "tracking" | "desc" | null;
      busy: boolean;
      done: boolean;
      t: number;
    }
  | { page: "list"; press: boolean; modal: boolean; confirm: boolean; busy: boolean; done: boolean; t: number };
export function guardAt5(t: number): GuardView5 | null {
  if (t >= 12 && t < 24)
    return {
      page: "new",
      q: typed("Rest", 13.0, 13.8, t),
      searching: t >= 13.8 && t < 14.3,
      results: t >= 14.3 && t < T_SELECT,
      press: t > T_SELECT - 0.35 && t < T_SELECT ? 1 : t > T_CHIP - 0.3 && t < T_CHIP ? 2 : t > T_SUBMIT - 0.3 && t < T_SUBMIT ? 3 : 0,
      selected: t >= T_SELECT,
      chip: t >= T_CHIP,
      tracking: typed(PKG.tracking, 18.0, 19.4, t),
      desc: typed(PKG.desc, 20.0, 21.0, t),
      focus: t >= 12.6 && t < T_SELECT ? "q" : t >= 16.6 && t < 17.8 ? "carrier" : t >= 17.8 && t < 19.7 ? "tracking" : t >= 19.8 && t < 21.3 ? "desc" : null,
      busy: t >= T_SUBMIT && t < T_DONE,
      done: t >= T_DONE,
      t,
    };
  if (t >= 42.5 && t < 48.6)
    return {
      page: "list",
      press: t > T_ENTREGAR - 0.3 && t < T_ENTREGAR,
      modal: t >= T_ENTREGAR + 0.15 && t < T_DELIV,
      confirm: t > T_CONFIRM5 - 0.3 && t < T_CONFIRM5 + 0.1,
      busy: t >= T_CONFIRM5 && t < T_DELIV,
      done: t >= T_DELIV,
      t,
    };
  return null;
}

/* ---------- Personas ---------- */
const WINDOW = { x: 0.3, z: 12.75 };
const PICK = { x: 3.4, z: 7.95 }; // lado interno de la caseta
const COURIER_PATH: WP[] = [
  { x: 11.5, z: 13.95, t: 4.2 },
  { x: 2.2, z: 13.45, t: 8.4 },
  { x: WINDOW.x, z: WINDOW.z, t: 9.4 },
  { x: WINDOW.x, z: WINDOW.z, t: 11.3 },
  { x: 2.4, z: 13.6, t: 12.6 },
  { x: 12, z: 13.95, t: 18.5 },
];
export function courierPose5(t: number): Pose {
  if (t < 4 || t > 18.5) return FAR;
  const p = walker(COURIER_PATH, t, () => Math.PI + 0.1);
  if (t > 9.4 && t < 11.3) p.headYaw = 0.1 * Math.sin(t * 1.4);
  p.blink = blinkAt(t, 0.6);
  return p;
}

const IN_PATH: WP[] = [
  { x: -3.0, z: 1.8, t: 34.0 },
  { x: -2.4, z: 5.4, t: 36.6 },
  { x: 0.8, z: 7.2, t: 38.6 },
  { x: PICK.x, z: PICK.z, t: 40.2 },
];
const OUT_PATH: WP[] = [
  { x: PICK.x, z: PICK.z, t: 49.4 },
  { x: 0.6, z: 6.9, t: 51.4 },
  { x: -2.5, z: 4.6, t: 54.0 },
  { x: -3.1, z: -1.0, t: 58.5 },
];
const T_ID0 = 40.4;
const T_ID1 = 42.4;
export function mariaPose5(t: number): Pose {
  const [mx, mz] = P.maria;
  if (t < 34) {
    const p = base(mx, mz, P.mariaYaw);
    p.phone = ss(23.6, 24.2, t) * (1 - ss(33.6, 34, t));
    p.headPitch = 0.3 * p.phone;
    p.blink = blinkAt(t, 0.4);
    return p;
  }
  if (t < 49.4) {
    const p = walker(IN_PATH, t, () => 0);
    p.selfie = t > T_ID0 && t < T_ID1 ? clamp(Math.min((t - T_ID0) / 0.5, (T_ID1 - t) / 0.4)) : 0;
    p.headPitch = 0.05;
    p.blink = blinkAt(t, 0.4);
    return p;
  }
  const p = walker(OUT_PATH, t, () => Math.PI);
  p.blink = blinkAt(t, 0.4);
  return p;
}

const SEAT = { x: P.carlos[0], z: P.carlos[1] };
const C_PICK = { x: PICK.x, z: 9.15 };
export function carlosPose5(t: number): Pose {
  const stand = (t > 38.4 && t < 43.6) || (t > 46.8 && t < 50.4);
  if (!stand) {
    const p = base(SEAT.x, SEAT.z, 0);
    p.sit = 1;
    const talk = ss(8.8, 9.4, t) * (1 - ss(11.2, 11.8, t));
    p.headYaw = 0.3 * Math.sin(t * 0.23) * (1 - talk) + talk * -0.62;
    p.headPitch = 0.12 - 0.05 * talk;
    p.type = (t > 12 && t < 24) || (t > 43.6 && t < 46.8) ? 0.6 + 0.3 * Math.sin(t * 0.9) : 0.35 * (1 - talk);
    p.blink = blinkAt(t, 1.7);
    return p;
  }
  const t0 = t < 44 ? 38.4 : 46.8;
  const t1 = t < 44 ? 43.6 : 50.4;
  const path: WP[] = [
    { x: SEAT.x, z: SEAT.z, t: t0 + 0.3 },
    { x: C_PICK.x, z: C_PICK.z, t: t0 + 1.6 },
    { x: C_PICK.x, z: C_PICK.z, t: t1 - 1.5 },
    { x: SEAT.x, z: SEAT.z, t: t1 - 0.25 },
  ];
  const p = walker(path, t, () => Math.PI);
  p.sit = 1 - ss(t0, t0 + 0.3, t) * (1 - ss(t1 - 0.25, t1, t));
  if (t > t0 + 1.6 && t < t1 - 1.5) p.headPitch = t < 44 ? 0.18 : 0.1;
  p.blink = blinkAt(t, 1.7);
  return p;
}

/* ---------- Props: caja y documento ---------- */
const COUNTER = { x: 0.62, y: 0.99, z: 11.2 };
const SHELF = { x: 4.05, y: 0.97, z: 9.1 };
export type Prop = { x: number; y: number; z: number; yaw: number; v: number };
const held = (p: Pose, f: number, y: number): Prop => ({ x: p.x + Math.sin(p.yaw) * f, y, z: p.z + Math.cos(p.yaw) * f, yaw: p.yaw, v: 1 });
const mix = (a: Prop, b: Prop, k: number): Prop => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) + Math.sin(k * Math.PI) * 0.12, z: lerp(a.z, b.z, k), yaw: lerp(a.yaw, b.yaw, k), v: 1 });
export function boxAt5(t: number): Prop | null {
  if (t < 4 || t > 58.5) return null;
  const counter: Prop = { ...COUNTER, yaw: 0.2, v: 1 };
  const shelf: Prop = { ...SHELF, yaw: 0, v: 1 };
  if (t < T_HAND) return held(courierPose5(t), 0.33, 1.0);
  if (t < T_HAND + 0.8) return mix(held(courierPose5(T_HAND), 0.33, 1.0), counter, ss(T_HAND, T_HAND + 0.8, t));
  if (t < 12.4) return counter;
  if (t < 13.6) return mix(counter, shelf, ss(12.4, 13.6, t));
  if (t < 47.6) return shelf;
  const hand = held(mariaPose5(Math.max(t, 48.6)), 0.3, 1.02);
  if (t < 48.6) return mix(shelf, hand, ss(47.6, 48.6, t));
  return held(mariaPose5(t), 0.3, 1.02);
}
/** Cédula que María muestra a Carlos (mano derecha extendida). */
export function idCardAt5(t: number): Prop | null {
  const m = mariaPose5(t);
  if (m.selfie < 0.5) return null;
  const f = 0.42;
  return { x: m.x + Math.sin(m.yaw) * f + Math.cos(m.yaw) * 0.08, y: 1.38, z: m.z + Math.cos(m.yaw) * f - Math.sin(m.yaw) * 0.08, yaw: m.yaw, v: m.selfie };
}

/* ---------- Cámara ---------- */
export function cameraAt5(t: number, mobile: boolean): Shot {
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
  const cp = courierPose5(t);
  const mp = mariaPose5(t);
  const aerial: Shot = { p: [30, 24, 46], q: [-2, 2, 4], ax: 0.5, ay: 0.5 };
  const street: Shot = { p: [-1.6, 2.1, 13.6 + 4.4 * dm], q: [lerp(1.2, cp.x < -100 ? 9 : Math.min(cp.x, 9), 0.5), 1.25, 12.9], ...gA };
  const booth: Shot = { p: [3.9, 2.15, 9.0], q: [0.7, 1.2, 11.6], ax: 0.5, ay: mobile ? 0.3 : 0.5 };
  const medium: Shot = { p: around(3.4 * dm, 0.42, 1.75), q: [mx, 1.25, mz], ...phoneA };
  const medium2: Shot = { p: around(2.8 * dm, 0.3, 1.65), q: [mx, 1.3, mz], ...phoneA };
  const walkIn: Shot = { p: [-4.6, 2.4, 9.6 + (mobile ? 2 : 0)], q: [mp.x, 1.2, mp.z], ...gA };
  const showId: Shot = { p: [1.4, 2.05, 10.9 + (mobile ? 1.2 : 0)], q: [3.3, 1.3, 8.0], ax: 0.5, ay: mobile ? 0.3 : 0.5 };
  const hand: Shot = { p: [6.4, 2.3, 5.2 + (mobile ? -1.5 : 0)], q: [3.0, 1.1, 8.6], ...gA };
  const follow: Shot = { p: [-6.0, 2.8, 6.8 + (mobile ? 1 : 0)], q: [mp.x, 1.1, mp.z], ...phoneA };
  const endB: Shot = { p: [-17, 14, -1], q: [-1, 1.5, 6], ax: 0.5, ay: mobile ? 0.3 : 0.5 };

  if (t < 5) return mid(aerial, street, ss(0, 5, t));
  if (t < 12) return street;
  if (t < 24) return mid(booth, { ...booth, p: [3.7, 2.1, 9.3] }, ss(12, 24, t));
  if (t < 26) return mid({ ...medium, p: around(5 * dm, 0.6, 2.2) }, medium, ss(24, 26, t));
  if (t < 34) return mid(medium, medium2, ss(26, 34, t));
  if (t < 39.4) return walkIn;
  if (t < 42.5) return showId;
  if (t < 49.4) return hand;
  if (t < 55.5) return follow;
  return mid(follow, endB, ss(55.5, 58, t));
}
