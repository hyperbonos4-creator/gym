"use client";

/**
 * Socios del gemelo: figuras humanas con la misma construcción que la protagonista (Human.tsx):
 * cadera, rodilla, hombro y codo articulados. Mujeres y hombres distintos (proporciones, peinado,
 * tono de piel, ropa). Cada quien hace un ejercicio real con su equipo: sentadilla en rack, press
 * de banca, jalón en polea, curl o press con mancuernas, trote en cinta, bicicleta, kettlebell swing,
 * salto al cajón, cuerdas y movilidad. Tempo y fase distintos por persona (nadie va sincronizado).
 * Rendimiento: geometrías y materiales compartidos, sin sombras reales; ~20 figuras como máximo.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAX_MEMBERS, type GemeloSim, type Member, type Station } from "../../lib/gemelo/sim";
import type { WorldCtrl } from "../../lib/gemelo/ctrl";
import { curlElbow } from "../../lib/gemelo/curl";

const HIP = 0.93;
const THIGH = 0.44;
const SHIN = 0.43;
const UARM = 0.29;
const FARM = 0.26;
const FOOT_Y = 0.035;

function fdt(dt: number): number {
  const w = typeof window !== "undefined" ? (window as any) : null;
  return w && typeof w.__gmFixedDt === "number" ? w.__gmFixedDt : dt;
}

/* ---------- recursos compartidos ---------- */
let GEO: Record<string, THREE.BufferGeometry> | null = null;
function geo() {
  if (GEO) return GEO;
  GEO = {
    thigh: new THREE.CapsuleGeometry(0.075, THIGH - 0.1, 4, 10).translate(0, -THIGH / 2, 0),
    shin: new THREE.CapsuleGeometry(0.06, SHIN - 0.08, 4, 10).translate(0, -SHIN / 2, 0),
    uarm: new THREE.CapsuleGeometry(0.05, UARM - 0.08, 4, 8).translate(0, -UARM / 2, 0),
    farm: new THREE.CapsuleGeometry(0.042, FARM - 0.08, 4, 8).translate(0, -FARM / 2, 0),
    hand: new THREE.SphereGeometry(0.045, 10, 8),
    torso: new THREE.CapsuleGeometry(0.15, 0.3, 6, 14),
    hips: new THREE.CapsuleGeometry(0.135, 0.06, 4, 12).rotateZ(Math.PI / 2),
    neck: new THREE.CylinderGeometry(0.045, 0.05, 0.09, 10),
    head: new THREE.SphereGeometry(0.105, 18, 14),
    cap: new THREE.SphereGeometry(0.112, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    capShort: new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
    pony: new THREE.CapsuleGeometry(0.04, 0.16, 4, 8),
    bun: new THREE.SphereGeometry(0.055, 12, 10),
    long: new THREE.CapsuleGeometry(0.085, 0.2, 4, 10),
    beard: new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.3),
    shoe: new THREE.BoxGeometry(0.1, 0.075, 0.25),
    shadow: new THREE.CircleGeometry(0.36, 18).rotateX(-Math.PI / 2),
    bar: new THREE.CylinderGeometry(0.014, 0.014, 1.75, 8).rotateZ(Math.PI / 2),
    plate: new THREE.CylinderGeometry(0.21, 0.21, 0.05, 20).rotateZ(Math.PI / 2),
    plateS: new THREE.CylinderGeometry(0.14, 0.14, 0.035, 16).rotateZ(Math.PI / 2),
    dbBar: new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8).rotateZ(Math.PI / 2),
    dbHead: new THREE.CylinderGeometry(0.052, 0.052, 0.055, 6).rotateZ(Math.PI / 2),
    kb: new THREE.SphereGeometry(0.09, 14, 10),
    kbHandle: new THREE.TorusGeometry(0.05, 0.013, 6, 12, Math.PI),
    seg: new THREE.CylinderGeometry(0.022, 0.022, 1, 6).translate(0, 0.5, 0),
    cable: new THREE.CylinderGeometry(0.006, 0.006, 1, 4).translate(0, 0.5, 0),
    lat: new THREE.CylinderGeometry(0.016, 0.016, 1.1, 8).rotateZ(Math.PI / 2),
  };
  return GEO;
}
const MATS = new Map<string, THREE.MeshStandardMaterial>();
function mat(c: string, rough = 0.6, metal = 0) {
  const k = `${c}|${rough}|${metal}`;
  let m = MATS.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    MATS.set(k, m);
  }
  return m;
}
let SHADOW_MAT: THREE.MeshBasicMaterial | null = null;
const IRON = () => mat("#2b3442", 0.4, 0.7);
const STEEL = () => mat("#cbd5e1", 0.3, 0.8);
const PLATE = () => mat("#111827", 0.55, 0.2);

const SHOES = ["#f1f5f9", "#111827", "#f1f5f9", "#38BDF8", "#f1f5f9"];

/* ---------- figura ---------- */
type Rig = {
  sig: string;
  root: THREE.Group;
  body: THREE.Group;
  pelvis: THREE.Group;
  chest: THREE.Group;
  head: THREE.Group;
  th: [THREE.Group, THREE.Group];
  kn: [THREE.Group, THREE.Group];
  sh: [THREE.Group, THREE.Group];
  el: [THREE.Group, THREE.Group];
  hand: [THREE.Group, THREE.Group];
  shX: number;
  sc: number;
  barbell: THREE.Group;
  db: [THREE.Group, THREE.Group];
  kb: THREE.Group;
  lat: THREE.Group;
  cable: THREE.Mesh;
  ropes: THREE.Mesh[][];
};

function sigOf(m: Member) {
  return `${m.female}|${m.hairStyle}|${m.hair}|${m.shirt}|${m.pants}|${m.skin}|${m.build.toFixed(2)}|${m.shorts}|${m.id}`;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, p?: [number, number, number], s?: [number, number, number], r?: [number, number, number]) {
  const o = new THREE.Mesh(g, m);
  if (p) o.position.set(p[0], p[1], p[2]);
  if (s) o.scale.set(s[0], s[1], s[2]);
  if (r) o.rotation.set(r[0], r[1], r[2]);
  parent.add(o);
  return o;
}

function buildRig(m: Member): Rig {
  const G = geo();
  const f = m.female;
  const b = m.build;
  const skin = mat(m.skin, 0.62);
  const hair = mat(m.hair, 0.55);
  const top = mat(m.shirt, 0.55);
  const legsM = mat(m.pants, 0.7);
  const shoe = mat(SHOES[m.id % SHOES.length], 0.5);
  const sleeveless = f ? b > 0.45 : b > 0.8;
  const sc = f ? 0.93 + b * 0.05 : 0.99 + b * 0.06;
  const shX = f ? 0.172 : 0.205 + b * 0.025;
  const armT = f ? 0.9 : 1.08 + b * 0.14;
  const legT = f ? 1.04 : 1.06 + b * 0.1;

  const root = new THREE.Group();
  root.scale.setScalar(sc);
  if (!SHADOW_MAT) SHADOW_MAT = new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.38, depthWrite: false });
  mesh(G.shadow, SHADOW_MAT, root, [0, 0.012, 0]);
  const body = new THREE.Group();
  root.add(body);
  const pelvis = new THREE.Group();
  pelvis.position.y = HIP;
  body.add(pelvis);
  mesh(G.hips, legsM, pelvis, [0, 0, 0], f ? [1.12, 1, 0.82] : [1.02, 1, 0.76]);
  const th: THREE.Group[] = [];
  const kn: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const t = new THREE.Group();
    t.position.set(side * (f ? 0.1 : 0.095), -0.02, 0);
    pelvis.add(t);
    mesh(G.thigh, legsM, t, undefined, [legT, 1, legT]);
    const k = new THREE.Group();
    k.position.y = -THIGH;
    t.add(k);
    mesh(G.shin, m.shorts ? skin : legsM, k, undefined, [legT * 0.98, 1, legT * 0.98]);
    const foot = new THREE.Group();
    foot.position.set(0, -SHIN - 0.02, 0.045);
    k.add(foot);
    mesh(G.shoe, shoe, foot);
    th.push(t);
    kn.push(k);
  }
  const chest = new THREE.Group();
  chest.position.y = 0.06;
  pelvis.add(chest);
  mesh(G.torso, top, chest, [0, 0.27, 0], f ? [1.04, 0.98, 0.74] : [1.24 + b * 0.1, 1.03, 0.8 + b * 0.05]);
  mesh(G.neck, skin, chest, [0, 0.53, 0], f ? [0.9, 1, 0.9] : [1.12, 1, 1.12]);
  const head = new THREE.Group();
  head.position.y = 0.58;
  chest.add(head);
  mesh(G.head, skin, head, [0, 0.1, 0.005], f ? [0.9, 1.06, 0.96] : [0.95, 1.08, 1]);
  const hs = m.hairStyle;
  if (f) {
    mesh(G.cap, hair, head, [0, 0.115, -0.005], undefined, [-0.25, 0, 0]);
    if (hs === 0) mesh(G.pony, hair, head, [0, 0.07, -0.13], undefined, [0.45, 0, 0]);
    else if (hs === 1) mesh(G.bun, hair, head, [0, 0.21, -0.07]);
    else mesh(G.long, hair, head, [0, 0.0, -0.075], [1.15, 1, 0.45]);
  } else {
    if (hs === 0) mesh(G.capShort, hair, head, [0, 0.125, -0.005], undefined, [-0.18, 0, 0]);
    else if (hs === 1) mesh(G.capShort, hair, head, [0, 0.118, -0.002], [0.97, 0.9, 0.97], [-0.3, 0, 0]);
    else {
      mesh(G.capShort, hair, head, [0, 0.125, -0.005], undefined, [-0.18, 0, 0]);
      mesh(G.beard, hair, head, [0, 0.085, 0.012], [0.93, 1.1, 0.98]);
    }
  }
  const sh: THREE.Group[] = [];
  const el: THREE.Group[] = [];
  const hand: THREE.Group[] = [];
  const db: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const s = new THREE.Group();
    s.position.set(side * shX, 0.44, 0);
    chest.add(s);
    mesh(G.uarm, sleeveless ? skin : top, s, undefined, [armT, 1, armT]);
    const e = new THREE.Group();
    e.position.y = -UARM;
    s.add(e);
    mesh(G.farm, skin, e, undefined, [armT, 1, armT]);
    mesh(G.hand, skin, e, [0, -FARM - 0.02, 0]);
    const h = new THREE.Group();
    h.position.set(0, -FARM - 0.03, 0);
    e.add(h);
    const d = new THREE.Group();
    mesh(G.dbBar, IRON(), d);
    mesh(G.dbHead, PLATE(), d, [-0.1, 0, 0]);
    mesh(G.dbHead, PLATE(), d, [0.1, 0, 0]);
    d.visible = false;
    h.add(d);
    sh.push(s);
    el.push(e);
    hand.push(h);
    db.push(d);
  }
  // barra olímpica con discos
  const barbell = new THREE.Group();
  mesh(G.bar, STEEL(), barbell);
  for (const sx of [-1, 1]) {
    mesh(G.plate, PLATE(), barbell, [sx * 0.66, 0, 0]);
    mesh(G.plateS, mat(sx > 0 ? "#1d4ed8" : "#1d4ed8", 0.5, 0.2), barbell, [sx * 0.71, 0, 0]);
    mesh(G.dbHead, IRON(), barbell, [sx * 0.75, 0, 0], [0.5, 0.45, 0.45]);
  }
  barbell.visible = false;
  root.add(barbell);
  const kb = new THREE.Group();
  mesh(G.kb, IRON(), kb, [0, -0.1, 0]);
  mesh(G.kbHandle, IRON(), kb, [0, -0.02, 0]);
  kb.visible = false;
  root.add(kb);
  const lat = new THREE.Group();
  mesh(G.lat, STEEL(), lat);
  lat.visible = false;
  root.add(lat);
  const cable = mesh(G.cable, mat("#94a3b8", 0.4, 0.6), root);
  cable.visible = false;
  const ropes: THREE.Mesh[][] = [];
  const ropeM = mat("#1e293b", 0.8);
  for (let r = 0; r < 2; r++) {
    const arr: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
      const sg = mesh(G.seg, ropeM, root);
      sg.visible = false;
      arr.push(sg);
    }
    ropes.push(arr);
  }
  return {
    sig: sigOf(m),
    root, body, pelvis, chest, head,
    th: th as [THREE.Group, THREE.Group],
    kn: kn as [THREE.Group, THREE.Group],
    sh: sh as [THREE.Group, THREE.Group],
    el: el as [THREE.Group, THREE.Group],
    hand: hand as [THREE.Group, THREE.Group],
    shX, sc, barbell,
    db: db as [THREE.Group, THREE.Group],
    kb, lat, cable, ropes,
  };
}

/* ---------- utilidades de pose ---------- */
const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const V3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const ss = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** IK de dos segmentos en el plano sagital del padre. `knee`: rodilla adelante; si no, codo atrás. */
function ik(joint: THREE.Group, mid: THREE.Group, ty: number, tz: number, L1: number, L2: number, knee: boolean) {
  const dy = ty - joint.position.y;
  const dz = tz - joint.position.z;
  const d = clamp(Math.hypot(dy, dz), 0.06, L1 + L2 - 0.002);
  const phi = Math.atan2(-dz, -dy);
  const dl = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const ep = Math.acos(clamp((L2 * L2 + d * d - L1 * L1) / (2 * L2 * d), -1, 1));
  if (knee) {
    joint.rotation.x = phi - dl;
    mid.rotation.x = dl + ep;
  } else {
    joint.rotation.x = phi + dl;
    mid.rotation.x = -(dl + ep);
  }
}
/** Punto en el marco de `root` → marco local de `parent` (matrices al día). */
function toLocal(r: Rig, parent: THREE.Object3D, x: number, y: number, z: number, out: THREE.Vector3) {
  out.set(x, y, z);
  r.root.localToWorld(out);
  return parent.worldToLocal(out);
}
function armTo(r: Rig, side: 0 | 1, x: number, y: number, z: number) {
  r.root.updateMatrixWorld(true);
  const p = toLocal(r, r.chest, x, y, z, V1);
  ik(r.sh[side], r.el[side], p.y, p.z, UARM, FARM + 0.03, false);
}
function legTo(r: Rig, side: 0 | 1, x: number, y: number, z: number) {
  r.root.updateMatrixWorld(true);
  const p = toLocal(r, r.pelvis, x, y, z, V1);
  ik(r.th[side], r.kn[side], p.y, p.z, THIGH, SHIN + 0.02, true);
}
function handPos(r: Rig, side: 0 | 1, out: THREE.Vector3) {
  r.root.updateMatrixWorld(true);
  r.hand[side].getWorldPosition(out);
  return r.root.worldToLocal(out);
}
function placeSeg(o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  V3.subVectors(b, a);
  const len = V3.length();
  o.position.copy(a);
  o.scale.set(1, Math.max(0.001, len), 1);
  o.quaternion.setFromUnitVectors(UP, V3.multiplyScalar(1 / Math.max(1e-5, len)));
}

function reset(r: Rig) {
  r.body.position.set(0, 0, 0);
  r.body.rotation.set(0, 0, 0);
  r.pelvis.position.set(0, HIP, 0);
  r.pelvis.rotation.set(0, 0, 0);
  r.chest.rotation.set(0.03, 0, 0);
  r.head.rotation.set(0, 0, 0);
  for (const s of [0, 1] as const) {
    const sg = s ? 1 : -1;
    r.th[s].rotation.set(0, 0, -sg * 0.02);
    r.kn[s].rotation.set(0.05, 0, 0);
    r.sh[s].rotation.set(0.02, 0, sg * 0.08);
    r.el[s].rotation.set(-0.15, 0, 0);
    r.db[s].visible = false;
  }
  r.barbell.visible = false;
  r.kb.visible = false;
  r.lat.visible = false;
  r.cable.visible = false;
  for (const rr of r.ropes) for (const sg of rr) sg.visible = false;
}

function walk(r: Rig, w: number) {
  const sw = Math.sin(w);
  const cw = Math.cos(w);
  r.th[0].rotation.x = -0.44 * sw;
  r.th[1].rotation.x = 0.44 * sw;
  r.kn[0].rotation.x = 0.08 + 0.75 * Math.pow(Math.max(0, cw), 1.6) + 0.12 * Math.max(0, -sw);
  r.kn[1].rotation.x = 0.08 + 0.75 * Math.pow(Math.max(0, -cw), 1.6) + 0.12 * Math.max(0, sw);
  r.sh[0].rotation.x = 0.34 * sw;
  r.sh[1].rotation.x = -0.34 * sw;
  r.el[0].rotation.x = -0.3 - 0.18 * Math.max(0, -sw);
  r.el[1].rotation.x = -0.3 - 0.18 * Math.max(0, sw);
  r.pelvis.position.y = HIP - 0.02 + 0.025 * Math.abs(cw);
  r.pelvis.rotation.y = -0.05 * sw;
  r.chest.rotation.set(0.06, 0.08 * sw, 0);
}

function idle(r: Rig, t: number) {
  const br = Math.sin(t * 1.6) * 0.012;
  r.chest.rotation.x = 0.02 + br;
}

/* ---------- ejercicios (t en segundos reales, k = tempo) ---------- */
function squat(r: Rig, t: number) {
  const c = t % 3.6;
  const s = c < 1.5 ? ss(c, 0, 1.5) : c < 1.75 ? 1 : 1 - ss(c, 1.75, 2.9);
  r.pelvis.position.set(0, HIP - 0.44 * s, -0.2 * s);
  r.chest.rotation.x = 0.06 + 0.5 * s;
  r.head.rotation.x = -0.35 * s;
  r.th[0].rotation.z = 0.14;
  r.th[1].rotation.z = -0.14;
  legTo(r, 0, -0.14, FOOT_Y, 0.05);
  legTo(r, 1, 0.14, FOOT_Y, 0.05);
  // barra apoyada en la espalda alta, manos abiertas sobre la barra
  r.root.updateMatrixWorld(true);
  V2.set(0, 0.47, -0.12);
  r.chest.localToWorld(V2);
  r.root.worldToLocal(V2);
  r.barbell.visible = true;
  r.barbell.position.copy(V2);
  r.barbell.rotation.set(0, 0, 0);
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.sh[sd].rotation.set(0.25, 0, sg * 1.28);
    r.el[sd].rotation.x = -1.95;
  }
}

function bench(r: Rig, t: number) {
  const c = t % 3.4;
  // baja 1,5 s · pausa · empuja 1 s · arriba
  const e = c < 1.5 ? 1 - ss(c, 0, 1.5) : c < 1.7 ? 0 : c < 2.7 ? ss(c, 1.7, 2.7) : 1;
  const benchTop = 0.31 / r.sc;
  r.body.rotation.x = -Math.PI / 2;
  r.body.position.set(0, benchTop + 0.11, 1.17);
  r.chest.rotation.x = 0;
  r.head.rotation.x = 0.1;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.th[sd].rotation.set(0.25, 0, -sg * 0.5);
    r.kn[sd].rotation.x = Math.PI / 2 - 0.15;
  }
  const by = benchTop + 0.17 + e * 0.42;
  const bz = -0.18;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.sh[sd].rotation.z = sg * 0.42;
    armTo(r, sd, sg * 0.3, by, bz);
  }
  r.barbell.visible = true;
  r.barbell.rotation.set(0, 0, 0);
  r.barbell.position.set(0, by, bz);
}

function pulldown(r: Rig, t: number) {
  const c = t % 3.2;
  const s = c < 1.1 ? ss(c, 0, 1.1) : c < 1.4 ? 1 : 1 - ss(c, 1.4, 2.8);
  const seat = 0.5 / r.sc;
  r.pelvis.position.set(0, seat + 0.07, -0.02);
  r.chest.rotation.x = -0.1 - 0.12 * s;
  r.head.rotation.x = -0.15;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.th[sd].rotation.z = -sg * 0.08;
    legTo(r, sd, sg * 0.13, FOOT_Y, 0.46);
  }
  const by = lerp(1.88, 1.22, s) / r.sc;
  const bz = lerp(0.1, 0.16, s);
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.sh[sd].rotation.z = sg * lerp(0.42, 0.62, s);
    armTo(r, sd, sg * 0.36, by, bz);
  }
  r.lat.visible = true;
  r.lat.position.set(0, by, bz);
  r.cable.visible = true;
  V2.set(0, by + 0.02, bz);
  V3.set(0, 2.38 / r.sc, 0.24);
  placeSeg(r.cable, V2, V3);
}

function dumbbells(r: Rig, t: number, press: boolean) {
  for (const sd of [0, 1] as const) r.db[sd].visible = true;
  if (!press) {
    const flex = curlElbow(t);
    for (const sd of [0, 1] as const) {
      const sg = sd ? 1 : -1;
      r.sh[sd].rotation.set(-0.1 - flex * 0.05, 0, sg * 0.14);
      r.el[sd].rotation.x = -0.12 - flex;
    }
    r.pelvis.position.y = HIP - 0.02;
    return;
  }
  const c = t % 3.0;
  const s = c < 1.0 ? ss(c, 0, 1.0) : c < 1.3 ? 1 : 1 - ss(c, 1.3, 2.6);
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.sh[sd].rotation.z = sg * lerp(0.75, 0.3, s);
    armTo(r, sd, sg * 0.26, lerp(1.5, 1.98, s), lerp(0.1, 0.04, s));
  }
}

function run(r: Rig, t: number) {
  r.root.position.y += 0.22;
  const w = t * Math.PI * 2 * 1.45;
  const sw = Math.sin(w);
  const cw = Math.cos(w);
  r.th[0].rotation.x = -0.62 * sw;
  r.th[1].rotation.x = 0.62 * sw;
  r.kn[0].rotation.x = 0.2 + 1.35 * Math.pow(Math.max(0, cw), 1.3) + 0.25 * Math.max(0, sw);
  r.kn[1].rotation.x = 0.2 + 1.35 * Math.pow(Math.max(0, -cw), 1.3) + 0.25 * Math.max(0, -sw);
  r.sh[0].rotation.x = 0.55 * sw;
  r.sh[1].rotation.x = -0.55 * sw;
  r.el[0].rotation.x = -1.45;
  r.el[1].rotation.x = -1.45;
  r.pelvis.position.y = HIP - 0.05 + 0.05 * Math.abs(cw);
  r.pelvis.rotation.y = -0.07 * sw;
  r.chest.rotation.set(0.14, 0.1 * sw, 0);
}

function bike(r: Rig, t: number) {
  const w = t * Math.PI * 2 * 1.2;
  r.pelvis.position.set(0, 0.93 / r.sc, -0.3);
  r.chest.rotation.x = 0.6;
  r.head.rotation.x = -0.45;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    const a = w + sd * Math.PI;
    r.th[sd].rotation.z = 0;
    legTo(r, sd, sg * 0.11, 0.42 / r.sc + Math.sin(a) * 0.17, 0.12 + Math.cos(a) * 0.17);
    r.sh[sd].rotation.z = sg * 0.1;
    armTo(r, sd, sg * 0.25, 1.14 / r.sc, 0.5);
  }
}

function swing(r: Rig, t: number) {
  const c = (t % 1.6) / 1.6;
  const s = (1 - Math.cos(c * Math.PI * 2)) / 2; // 0 abajo, 1 arriba
  const hinge = 1 - s;
  r.pelvis.position.set(0, HIP - 0.1 * hinge - 0.02, -0.16 * hinge);
  r.chest.rotation.x = 0.05 + 0.95 * hinge;
  r.head.rotation.x = -0.55 * hinge;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.th[sd].rotation.z = sg * -0.2;
    legTo(r, sd, sg * 0.21, FOOT_Y, 0.06);
    r.sh[sd].rotation.set(lerp(0.4, -1.45, s) - r.chest.rotation.x, 0, -sg * 0.3);
    r.el[sd].rotation.x = -0.05;
  }
  const h = handPos(r, 1, V2);
  const h2 = handPos(r, 0, V3);
  r.kb.visible = true;
  r.kb.position.set((h.x + h2.x) / 2, (h.y + h2.y) / 2, (h.z + h2.z) / 2);
  r.kb.rotation.set(-r.sh[1].rotation.x - r.chest.rotation.x, 0, 0);
}

function boxJump(r: Rig, t: number) {
  const c = t % 4.4;
  const boxH = 0.6 / r.sc;
  let by = 0, bz = -0.15, depth = 0, tuck = 0, arms = 0.05;
  if (c < 0.5) {
    depth = 0;
  } else if (c < 0.95) {
    const k = ss(c, 0.5, 0.95);
    depth = 0.55 * k;
    arms = lerp(0.05, 0.9, k);
  } else if (c < 1.4) {
    const k = (c - 0.95) / 0.45;
    bz = lerp(-0.15, 0.72, k);
    by = lerp(0, boxH, k) + Math.sin(k * Math.PI) * 0.32;
    tuck = Math.sin(k * Math.PI);
    depth = lerp(0.2, 0.35, k);
    arms = lerp(0.9, -2.0, Math.min(1, k * 1.6));
  } else if (c < 2.2) {
    bz = 0.72;
    by = boxH;
    const k = ss(c, 1.4, 2.2);
    depth = lerp(0.45, 0, k);
    arms = lerp(-1.6, 0.05, k);
  } else if (c < 2.7) {
    bz = 0.72;
    by = boxH;
  } else if (c < 3.5) {
    const k = ss(c, 2.7, 3.5);
    bz = lerp(0.72, -0.15, k);
    by = lerp(boxH, 0, k);
    depth = Math.sin(k * Math.PI) * 0.18;
  }
  r.body.position.set(0, by, bz);
  r.pelvis.position.set(0, HIP - depth * 0.45, -depth * 0.12);
  r.chest.rotation.x = 0.05 + depth * 0.55;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.th[sd].rotation.z = sg * -0.1;
    legTo(r, sd, sg * 0.13, FOOT_Y + tuck * 0.4, 0.05 + tuck * 0.12 + bz);
    r.sh[sd].rotation.set(arms - r.chest.rotation.x * 0.3, 0, sg * 0.1);
    r.el[sd].rotation.x = -0.35;
  }
}

function ropes(r: Rig, t: number) {
  const w = t * Math.PI * 2 * 1.6;
  r.pelvis.position.set(0, HIP - 0.2, -0.08);
  r.chest.rotation.x = 0.32;
  r.head.rotation.x = -0.25;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.th[sd].rotation.z = sg * -0.18;
    legTo(r, sd, sg * 0.22, FOOT_Y, 0.06);
  }
  const hy = (sd: number) => 0.92 + 0.16 * Math.sin(w + sd * Math.PI);
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.sh[sd].rotation.z = sg * 0.12;
    armTo(r, sd, sg * 0.2, hy(sd) / r.sc, 0.46);
  }
  const ax = 0.16, ay = 0.22 / r.sc, az = 2.55 / r.sc;
  for (const sd of [0, 1] as const) {
    const h = handPos(r, sd, V2.set(0, 0, 0)).clone();
    const segs = r.ropes[sd];
    let prev = h;
    for (let i = 0; i < segs.length; i++) {
      const u = (i + 1) / segs.length;
      const x = lerp(h.x, (sd ? 1 : -1) * ax, u);
      const z = lerp(h.z, az, u);
      const yLine = lerp(h.y, ay, u) - Math.sin(u * Math.PI) * 0.12;
      const y = yLine + 0.16 * (1 - u) * Math.sin(w + sd * Math.PI - u * 7) - (1 - u) * 0.16 * Math.sin(w + sd * Math.PI);
      const p = new THREE.Vector3(x, y, z);
      segs[i].visible = true;
      placeSeg(segs[i], prev, p);
      prev = p;
    }
  }
}

function stretch(r: Rig, t: number) {
  const c = t % 10;
  const fold = c < 4 ? ss(c, 0, 1.2) : c < 5 ? 1 - ss(c, 4, 5) : 0;
  const reach = c >= 5 && c < 9.5 ? ss(c, 5, 6) * (1 - ss(c, 8.6, 9.5)) : 0;
  const side = Math.sin((c - 5) * 1.1) * reach;
  r.pelvis.position.set(0, HIP - 0.01, -0.12 * fold);
  r.chest.rotation.set(0.03 + 1.25 * fold, 0, 0.28 * side);
  r.head.rotation.x = 0.2 * fold;
  for (const sd of [0, 1] as const) {
    const sg = sd ? 1 : -1;
    r.th[sd].rotation.set(-0.1 * fold, 0, -sg * 0.05);
    r.kn[sd].rotation.x = 0.04;
    r.sh[sd].rotation.set(lerp(-1.2 * fold, -3.0, reach), 0, sg * lerp(0.1, 0.2, reach));
    r.el[sd].rotation.x = -0.1;
  }
}

function standStaff(r: Rig, t: number) {
  idle(r, t);
  for (const sd of [0, 1] as const) {
    r.sh[sd].rotation.x = -0.5;
    r.el[sd].rotation.x = -0.9;
  }
}

/* ---------- objetos de estaciones sin uso (barras en ganchos, cuerdas en el piso) ---------- */
function useRestProps(L: { stations: Station[] }) {
  return useMemo(() => {
    const G = geo();
    const g = new THREE.Group();
    const items: { s: number; o: THREE.Object3D }[] = [];
    L.stations.forEach((s, i) => {
      const o = new THREE.Group();
      o.position.set(s.x, 0, s.z);
      o.rotation.y = s.rot;
      const bar = () => {
        const b = new THREE.Group();
        mesh(G.bar, STEEL(), b);
        for (const sx of [-1, 1]) {
          mesh(G.plate, PLATE(), b, [sx * 0.66, 0, 0]);
          mesh(G.plateS, mat("#1d4ed8", 0.5, 0.2), b, [sx * 0.71, 0, 0]);
        }
        return b;
      };
      if (s.kind === "rack") {
        const b = bar();
        b.position.set(0, 1.42, -0.12);
        o.add(b);
      } else if (s.kind === "banco") {
        const b = bar();
        b.position.set(0, 1.05, -0.62);
        o.add(b);
      } else if (s.kind === "polea") {
        mesh(G.lat, STEEL(), o, [0, 1.95, 0.22]);
        const c = mesh(G.cable, mat("#94a3b8", 0.4, 0.6), o, [0, 1.95, 0.22]);
        c.scale.y = 0.43;
      } else if (s.kind === "cuerdas") {
        for (const sx of [-1, 1]) {
          const a = mesh(G.seg, mat("#1e293b", 0.8), o);
          placeSeg(a, new THREE.Vector3(sx * 0.18, 0.03, 0.55), new THREE.Vector3(sx * 0.16, 0.05, 2.5));
        }
      } else if (s.kind === "kettle") {
        const k = new THREE.Group();
        mesh(G.kb, IRON(), k, [0, 0.09, 0]);
        mesh(G.kbHandle, IRON(), k, [0, 0.17, 0]);
        k.position.set(0, 0, 0.35);
        o.add(k);
      } else return;
      g.add(o);
      items.push({ s: i, o });
    });
    return { g, items };
  }, [L]);
}

/* ---------- componente ---------- */
export function Crowd({ sim, ctrl, onPick }: { sim: GemeloSim; ctrl: WorldCtrl; onPick: (id: number) => void }) {
  const holder = useRef<THREE.Group>(null!);
  const rigs = useRef<(Rig | null)[]>(Array.from({ length: MAX_MEMBERS }, () => null));
  const hits = useRef<(THREE.Mesh | null)[]>([]);
  const ring = useRef<THREE.Mesh>(null!);
  const clock = useRef(0);
  const L = sim.layout;
  const rest = useRestProps(L);

  useFrame((state, dt) => {
    clock.current += fdt(dt);
    const T = clock.current;
    const ms = sim.members;
    const cam = state.camera.position;
    const tp = ctrl.tour.phase;
    for (let i = 0; i < MAX_MEMBERS; i++) {
      const m = ms[i];
      let r = rigs.current[i];
      const hit = hits.current[i];
      if (!m) {
        if (r) r.root.visible = false;
        if (hit) hit.visible = false;
        continue;
      }
      if (!r || r.sig !== sigOf(m)) {
        if (r) holder.current.remove(r.root);
        r = buildRig(m);
        rigs.current[i] = r;
        holder.current.add(r.root);
      }
      const camD = Math.hypot(m.x - cam.x, 1.0 - cam.y, m.z - cam.z);
      const clearSet = ctrl.preset === "tour" && (tp === "to_gate" || tp === "gate") && (m.phase === "fila" || m.phase === "validando" || m.phase === "llegando") && m.z > 7.5 && m.z < 14;
      let blocks = false;
      if (ctrl.preset === "tour" && ctrl.tour.active && tp !== "form" && tp !== "phone" && tp !== "app" && tp !== "food" && tp !== "coach") {
        const vx = ctrl.tour.x - cam.x, vz = ctrl.tour.z - cam.z;
        const L2 = vx * vx + vz * vz;
        if (L2 > 0.01) {
          const u = ((m.x - cam.x) * vx + (m.z - cam.z) * vz) / L2;
          if (u > 0 && u < 0.92) {
            const dx = cam.x + vx * u - m.x, dz = cam.z + vz * u - m.z;
            blocks = dx * dx + dz * dz < 0.75 * 0.75;
          }
        }
      }
      const hide = m.phase === "fuera" || (ctrl.preset === "tour" && camD < 2.7) || clearSet || blocks;
      r.root.visible = !hide;
      if (hit) {
        hit.visible = !hide;
        if (hide) hit.position.set(0, -100, 0);
      }
      if (hide) continue;
      reset(r);
      const st = m.station >= 0 ? L.stations[m.station] : null;
      const training = m.phase === "entrenando";
      let h = m.h;
      let px = m.x, pz = m.z;
      if (training && st && st.kind === "mancuernas") {
        // de frente a la sala, con el soporte de mancuernas detrás
        h = st.rot + Math.PI;
        px = st.x - Math.sin(st.rot) * 0.25;
        pz = st.z - Math.cos(st.rot) * 0.25;
      }
      r.root.position.set(px, 0, pz);
      r.root.rotation.set(0, h, 0);
      const tt = T * (0.88 + ((m.id * 37) % 25) / 100) + m.id * 1.37;
      if (training) {
        switch (st ? st.kind : "estira") {
          case "rack": squat(r, tt); break;
          case "banco": bench(r, tt); break;
          case "polea": pulldown(r, tt); break;
          case "mancuernas": dumbbells(r, tt, m.id % 2 === 0); break;
          case "cinta": run(r, tt); break;
          case "bici": bike(r, tt); break;
          case "kettle": swing(r, tt); break;
          case "cajon": boxJump(r, tt); break;
          case "cuerdas": ropes(r, tt); break;
          default: stretch(r, tt);
        }
      } else if (m.phase === "staff") {
        standStaff(r, T);
      } else if (m.moving) {
        walk(r, m.anim);
      } else idle(r, T + m.id);
      if (hit) {
        hit.position.set(m.x, 1.0, m.z);
      }
    }
    // barras/cuerdas en reposo solo donde nadie está entrenando
    for (const it of rest.items) {
      const occ = L.stations[it.s].occ;
      const om = occ >= 0 ? ms[occ] : null;
      it.o.visible = !(om && om.phase === "entrenando" && rigs.current[occ]?.root.visible);
    }
    const sel = ctrl.selected >= 0 ? ms[ctrl.selected] : null;
    if (sel && sel.phase !== "fuera") {
      ring.current.visible = true;
      ring.current.position.set(sel.x, 0.04, sel.z);
      const s = 1 + Math.sin(state.clock.elapsedTime * 5) * 0.08;
      ring.current.scale.set(s, s, s);
    } else ring.current.visible = false;
  });

  return (
    <group>
      <group ref={holder} />
      <primitive object={rest.g} />
      {Array.from({ length: MAX_MEMBERS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            hits.current[i] = el;
          }}
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            (ctrl as any).pickSeq = ((ctrl as any).pickSeq || 0) + 1;
            onPick(i);
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "")}
        >
          <boxGeometry args={[0.8, 2.0, 0.8]} />
          <meshBasicMaterial colorWrite={false} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.55, 0.72, 32]} />
        <meshBasicMaterial color="#A3E635" toneMapped={false} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}
