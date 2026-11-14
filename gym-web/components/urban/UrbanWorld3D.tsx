"use client";

/**
 * Conjunto residencial URBAN en 3D: calle, portería con caseta acristalada, torniquete peatonal
 * con kiosko facial y relé, portón vehicular, tres torres, jardín, oficina de administración.
 * Geometría estática instanciada (pocas llamadas de dibujo), sin sombras reales, DPR adaptativo.
 */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import Person, { type Look } from "./Person";
import { P, cameraAt, carlosPose, dianaPose, mariaPose } from "../../lib/urban/tour";

export type UrbanClock = { t: number; touring: boolean; mobile: boolean; mode: "hero" | "explore" | "tour" };

/* ---------- Geometría estática ---------- */
type Box = { p: [number, number, number]; s: [number, number, number]; c: string; r?: number };
type Cyl = { p: [number, number, number]; rad: number; h: number; c: string };
type Blob = { p: [number, number, number]; s: number; c: string };

function hash(i: number) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildStatic() {
  const boxes: Box[] = [];
  const glow: Box[] = [];
  const cyls: Cyl[] = [];
  const blobs: Blob[] = [];
  const B = (p: Box["p"], s: Box["s"], c: string, r = 0) => boxes.push({ p, s, c, r });
  const Gl = (p: Box["p"], s: Box["s"], c: string, r = 0) => glow.push({ p, s, c, r });

  /* Calle y andén */
  B([0, -0.02, 19.5], [160, 0.04, 9], "#23272f");
  for (let x = -76; x < 78; x += 6) B([x, 0.005, 19.5], [3, 0.01, 0.16], "#d6d3c4");
  B([0, 0.06, 13.3], [160, 0.12, 3.6], "#8d8a85");
  B([0, 0.06, 15.15], [160, 0.14, 0.2], "#b9b5ad");
  /* Entrada vehicular (rampa) */
  B([10.5, 0.07, 13.3], [9.4, 0.13, 3.62], "#5d5e63");

  /* Cerramiento frontal: muro bajo + reja */
  const fence = (x0: number, x1: number) => {
    const L = x1 - x0;
    B([(x0 + x1) / 2, 0.3, 11.5], [L, 0.6, 0.35], "#c9c2b6");
    B([(x0 + x1) / 2, 2.15, 11.5], [L, 0.06, 0.06], "#2a2f38");
    B([(x0 + x1) / 2, 1.0, 11.5], [L, 0.06, 0.06], "#2a2f38");
    for (let x = x0 + 0.2; x < x1; x += 0.22) B([x, 1.4, 11.5], [0.025, 1.6, 0.025], "#2a2f38");
    for (let x = x0; x <= x1 + 0.01; x += 4) B([x, 1.15, 11.5], [0.32, 2.3, 0.32], "#b3aa9c");
  };
  fence(-44, -4.4);
  fence(15.6, 44);
  // laterales y fondo
  for (const sx of [-44, 44]) {
    B([sx, 0.3, -14], [0.35, 0.6, 51], "#c9c2b6");
    B([sx, 2.15, -14], [0.06, 0.06, 51], "#2a2f38");
    for (let z = -39; z < 11.5; z += 0.6) B([sx, 1.4, z], [0.025, 1.6, 0.025], "#2a2f38");
  }
  B([0, 0.3, -39.5], [88, 0.6, 0.35], "#c9c2b6");
  /* Setos interiores */
  for (const [x0, x1] of [[-43, -6], [16, 43]]) B([(x0 + x1) / 2, 0.45, 10.6], [x1 - x0, 0.9, 0.9], "#2f5a34");

  /* Piso interior: césped por zonas, caminos */
  B([0, 0.01, -14], [87, 0.02, 51], "#355e38");
  // camino peatonal torniquete → plaza → Torre A
  B([-3, 0.03, 4.5], [3, 0.04, 14], "#cfc6b6");
  B([-8.5, 0.03, -2.2], [14, 0.04, 3], "#cfc6b6");
  B([-15, 0.03, -6.2], [3.6, 0.04, 6], "#cfc6b6");
  // plaza
  B([-6, 0.035, -2.2], [9, 0.05, 9], "#d8d0c2");
  B([-6, 0.25, -2.2], [3.2, 0.5, 3.2], "#9aa3ad");
  B([-6, 0.52, -2.2], [2.7, 0.06, 2.7], "#2b6c8f");
  Gl([-6, 0.56, -2.2], [2.5, 0.02, 2.5], "#3aa0d8");
  // caminos hacia Torre B y oficina
  B([6, 0.03, -2.2], [15, 0.04, 2.6], "#cfc6b6");
  B([12, 0.03, -8.2], [3, 0.04, 9.5], "#cfc6b6");
  B([17.8, 0.03, 0.6], [5.5, 0.04, 2.4], "#cfc6b6");
  // vía vehicular interna + parqueadero
  B([10.5, 0.025, 7], [8, 0.03, 9], "#3f4148");
  B([26, 0.025, -4], [24, 0.03, 12], "#3f4148");
  for (let i = 0; i < 7; i++) B([17 + i * 3, 0.045, -4], [0.1, 0.01, 4.6], "#e5e1d6");

  /* Bancas del jardín */
  for (const [x, z, r] of [[-10.2, -4.4, 0], [-1.8, -4.4, 0], [-10, 1.2, Math.PI]] as const) {
    B([x, 0.45, z], [1.6, 0.08, 0.45], "#8a6a4f", r);
    B([x, 0.72, z - 0.2 * Math.cos(r)], [1.6, 0.4, 0.06], "#8a6a4f", r);
    B([x - 0.65, 0.22, z], [0.08, 0.44, 0.4], "#2a2f38", r);
    B([x + 0.65, 0.22, z], [0.08, 0.44, 0.4], "#2a2f38", r);
  }

  /* Torres */
  const tower = (cx: number, cz: number, w: number, d: number, floors: number, seed: number) => {
    const H = floors * 3 + 1.2;
    B([cx, H / 2, cz], [w, H, d], "#e4ddd2");
    // franjas de losa
    for (let f = 1; f <= floors; f++) B([cx, f * 3 + 0.6, cz], [w + 0.14, 0.22, d + 0.14], "#bdb3a4");
    // columna de acento
    B([cx - w / 2 + 0.6, H / 2 + 0.6, cz + d / 2 + 0.06], [1.2, H + 1.2, 0.3], "#5b6472");
    B([cx + w / 2 - 0.6, H / 2 + 0.6, cz + d / 2 + 0.06], [1.2, H + 1.2, 0.3], "#5b6472");
    // remate
    B([cx, H + 0.45, cz], [w + 0.3, 0.9, d + 0.3], "#c6bcae");
    B([cx + 1.5, H + 1.6, cz - 1], [3, 1.4, 2.4], "#9aa2ac");
    // ventanas + balcones
    let k = seed * 1000;
    const cols = Math.floor((w - 2.6) / 2.1);
    const x0 = cx - ((cols - 1) * 2.1) / 2;
    for (let f = 1; f < floors; f++) {
      const y = f * 3 + 2.0;
      for (let i = 0; i < cols; i++) {
        const x = x0 + i * 2.1;
        const lit = hash(k++) < 0.5;
        const warm = hash(k++) < 0.7 ? "#ffd49a" : "#fff1d6";
        // frente
        (lit ? Gl : B)([x, y, cz + d / 2 + 0.03], [1.5, 1.75, 0.05], lit ? warm : "#1f2b3e");
        // atrás
        (hash(k++) < 0.45 ? Gl : B)([x, y, cz - d / 2 - 0.03], [1.5, 1.75, 0.05], hash(k) < 0.45 ? warm : "#1f2b3e");
        // balcones (frente, cada dos columnas)
        if (i % 2 === 0) {
          B([x + 1.05, y - 1.25, cz + d / 2 + 0.75], [3.6, 0.14, 1.4], "#d2c9bb");
          B([x + 1.05, y - 0.72, cz + d / 2 + 1.42], [3.6, 0.9, 0.05], "#8fa8bd");
          B([x + 1.05, y - 0.25, cz + d / 2 + 1.42], [3.6, 0.05, 0.08], "#2a2f38");
        }
      }
      const rows = Math.floor((d - 2) / 2.2);
      for (let j = 0; j < rows; j++) {
        const z = cz - ((rows - 1) * 2.2) / 2 + j * 2.2;
        for (const sx of [-1, 1]) {
          const lit = hash(k++) < 0.42;
          (lit ? Gl : B)([cx + sx * (w / 2 + 0.03), y, z], [0.05, 1.75, 1.4], lit ? "#ffd49a" : "#1f2b3e");
        }
      }
    }
    // lobby acristalado
    Gl([cx, 1.5, cz + d / 2 + 0.04], [5.2, 2.6, 0.05], "#ffe2b0");
    B([cx, 3.25, cz + d / 2 + 1.4], [7, 0.25, 2.8], "#3a4150");
    Gl([cx, 3.1, cz + d / 2 + 1.4], [6.6, 0.04, 2.4], "#fff3dc");
    B([cx - 3.2, 1.6, cz + d / 2 + 2.6], [0.22, 3.2, 0.22], "#3a4150");
    B([cx + 3.2, 1.6, cz + d / 2 + 2.6], [0.22, 3.2, 0.22], "#3a4150");
    return H;
  };
  tower(-15, -15.5, 14, 11, 12, 1);
  tower(12.5, -19.5, 13, 10, 14, 2);
  tower(-1.5, -33, 15, 8, 10, 3);

  /* Oficina de administración */
  const [ox, oz] = P.office;
  B([ox, 1.8, oz - 1.6], [8, 3.6, 0.3], "#e4ddd2");
  B([ox - 3.85, 1.8, oz], [0.3, 3.6, 3.5], "#e4ddd2");
  B([ox + 3.85, 1.8, oz], [0.3, 3.6, 3.5], "#e4ddd2");
  B([ox, 3.75, oz + 0.2], [8.4, 0.3, 4.2], "#3a4150");
  B([ox, 0.05, oz], [7.6, 0.1, 3.4], "#b8b0a3");
  Gl([ox, 3.55, oz], [5, 0.04, 0.3], "#fff3dc");
  // escritorio, monitor, silla, estantería
  B([ox, 0.74, P.monitor[2] - 0.05], [1.8, 0.05, 0.8], "#6b4f3a");
  B([ox - 0.82, 0.36, P.monitor[2] - 0.05], [0.06, 0.72, 0.74], "#2a2f38");
  B([ox + 0.82, 0.36, P.monitor[2] - 0.05], [0.06, 0.72, 0.74], "#2a2f38");
  B([ox, 1.05, P.monitor[2] - 0.2], [0.08, 0.5, 0.05], "#1f2430");
  B([ox, 0.79, P.monitor[2] - 0.2], [0.35, 0.03, 0.22], "#1f2430");
  B([ox, 1.12, P.monitor[2] - 0.15], [0.98, 0.6, 0.04], "#111827");
  B([P.diana[0], 0.48, P.diana[1] + 0.05], [0.5, 0.08, 0.5], "#1f2430");
  B([P.diana[0], 0.8, P.diana[1] + 0.3], [0.5, 0.6, 0.06], "#1f2430");
  B([P.diana[0], 0.24, P.diana[1] + 0.05], [0.06, 0.44, 0.06], "#2a2f38");
  B([ox - 2.6, 1.0, oz - 1.3], [1.6, 2.0, 0.4], "#8a6a4f");
  for (let i = 0; i < 4; i++) B([ox - 2.6, 0.35 + i * 0.45, oz - 1.12], [1.5, 0.04, 0.02], "#c7b9a3");
  B([ox + 2.7, 0.45, oz - 0.8], [0.5, 0.9, 0.5], "#a85b3c");

  /* Portería */
  // marquesina
  B([-0.2, 3.85, 10.6], [13.2, 0.3, 5.6], "#262c38");
  B([-0.2, 3.7, 13.38], [13.2, 0.9, 0.18], "#1b202a");
  Gl([-0.2, 3.27, 13.45], [13.2, 0.05, 0.05], "#3B82F6");
  for (const x of [-6.5, 6.1]) {
    B([x, 1.85, 13.0], [0.32, 3.7, 0.32], "#262c38");
    B([x, 1.85, 8.2], [0.32, 3.7, 0.32], "#262c38");
  }
  Gl([-3, 3.69, 11.5], [1.6, 0.03, 1.6], "#fff4de");
  Gl([2, 3.69, 10.2], [3.6, 0.03, 2.4], "#fff4de");
  // caseta
  const [bx, bz] = P.booth;
  B([bx, 0.55, bz + 1.65], [5.6, 1.1, 0.12], "#cfc8bd");
  B([bx, 0.55, bz - 1.65], [5.6, 1.1, 0.12], "#cfc8bd");
  B([bx - 2.74, 0.55, bz], [0.12, 1.1, 3.4], "#cfc8bd");
  B([bx + 2.74, 0.55, bz], [0.12, 1.1, 3.4], "#cfc8bd");
  B([bx, 3.3, bz], [5.8, 0.25, 3.6], "#3a4150");
  for (const [x, z] of [[-0.75, 8.55], [4.75, 8.55], [-0.75, 11.85], [4.75, 11.85]]) B([x, 2.2, z], [0.12, 2.2, 0.12], "#2a2f38");
  B([bx, 0.08, bz], [5.4, 0.04, 3.2], "#9c958a");
  // escritorio del celador y monitores (miran hacia él, de espaldas a la calle)
  B([bx, 0.8, bz + 1.15], [3.4, 0.06, 0.7], "#6b4f3a");
  B([bx - 1.6, 0.42, bz + 1.15], [0.06, 0.76, 0.66], "#2a2f38");
  B([bx + 1.6, 0.42, bz + 1.15], [0.06, 0.76, 0.66], "#2a2f38");
  B([bx, 0.48, bz + 0.55], [0.5, 0.07, 0.5], "#1f2430");
  B([bx, 0.8, bz + 0.3], [0.5, 0.6, 0.06], "#1f2430");
  B([bx, 0.25, bz + 0.55], [0.06, 0.45, 0.06], "#2a2f38");
  for (const x of [-0.75, 0.75]) {
    B([bx + x, 1.0, bz + 1.36], [0.07, 0.4, 0.05], "#1f2430");
    B([bx + x, 1.36, bz + 1.38], [1.25, 0.74, 0.05], "#111827");
  }
  // relé de la puerta en el pilar del torniquete, cableado al gabinete
  B([-1.6, 1.45, 11.74], [0.22, 0.3, 0.1], "#9aa3ad");
  B([-1.6, 0.75, 11.71], [0.04, 1.1, 0.04], "#1f2430");
  B([-1.9, 0.03, 11.71], [0.65, 0.03, 0.06], "#1f2430");

  // torniquete peatonal (trípode) y paneles
  const [tx, tz] = P.turnstile;
  B([tx - 0.78, 0.5, tz], [0.3, 1.0, 0.95], "#c5ccd6");
  B([tx - 0.78, 1.02, tz], [0.34, 0.05, 1.0], "#2a2f38");
  B([tx + 0.78, 0.5, tz], [0.3, 1.0, 0.95], "#c5ccd6");
  B([tx + 0.78, 1.02, tz], [0.34, 0.05, 1.0], "#2a2f38");
  B([tx - 1.35, 1.1, tz], [0.25, 2.2, 0.35], "#262c38");
  B([tx + 1.4, 1.1, tz], [0.25, 2.2, 0.35], "#262c38");
  // kiosko
  const [kx, kz] = P.kiosk;
  cyls.push({ p: [kx - 0.95, 0.6, kz], rad: 0.05, h: 1.2, c: "#2a2f38" });
  B([kx - 0.95, 0.03, kz], [0.4, 0.06, 0.4], "#2a2f38");
  B([kx - 0.95, 1.38, kz + 0.02], [0.46, 0.34, 0.06], "#0b0f17", 0);
  cyls.push({ p: [kx - 0.95, 1.65, kz + 0.02], rad: 0.025, h: 0.06, c: "#0b0f17" });

  // portón vehicular corredizo
  B([5.6, 1.3, 11.5], [0.45, 2.6, 0.45], "#262c38");
  B([15.4, 1.3, 11.5], [0.45, 2.6, 0.45], "#262c38");
  B([10.5, 0.25, 11.5], [9.4, 0.08, 0.12], "#1f2430");
  B([10.5, 2.15, 11.5], [9.4, 0.1, 0.1], "#2a2f38");
  B([10.5, 0.35, 11.5], [9.4, 0.1, 0.1], "#2a2f38");
  for (let x = 6.0; x < 15.2; x += 0.24) B([x, 1.25, 11.5], [0.06, 1.8, 0.04], "#2a2f38");
  Gl([5.6, 2.45, 11.74], [0.2, 0.08, 0.02], "#22C55E");

  // cámaras domo
  const dome = (x: number, y: number, z: number) => {
    B([x, y + 0.06, z], [0.18, 0.06, 0.18], "#e5e7eb");
    blobs.push({ p: [x, y, z], s: 0.09, c: "#111827" });
  };
  dome(-3, 3.62, 12.6);
  dome(3.5, 3.62, 12.6);
  dome(10.5, 2.75, 11.6);
  dome(-8.15, 3.3, -9.8);
  dome(5.95, 3.2, -14.2);

  /* Postes de luz */
  const lamps: [number, number][] = [[-20, 14.6], [-30, 14.6], [-40, 14.6], [22, 14.6], [32, 14.6], [42, 14.6], [-9, 6], [-12.8, -2.2], [2, -6], [9, 4], [16, -6]];
  for (const [x, z] of lamps) {
    cyls.push({ p: [x, 2.1, z], rad: 0.06, h: 4.2, c: "#2a2f38" });
    Gl([x, 4.25, z], [0.34, 0.1, 0.34], "#fff1c9");
  }

  /* Carros */
  const car = (x: number, z: number, c: string, r = 0) => {
    B([x, 0.5, z], [1.8, 0.65, 4.2], c, r);
    B([x, 1.05, z - 0.2], [1.6, 0.5, 2.2], "#1b2533", r);
    for (const dx of [-0.8, 0.8]) for (const dz of [-1.35, 1.35]) B([x + dx, 0.28, z + dz], [0.25, 0.56, 0.6], "#111", r);
  };
  car(18.5, -4, "#b91c1c");
  car(24.5, -4, "#e5e7eb");
  car(30.5, -4, "#1d4ed8");
  car(-24, 18, "#9ca3af", Math.PI / 2);

  /* Árboles */
  const trees: [number, number, number][] = [
    [-24, 4, 1.1], [-30, -2, 1.3], [-34, 6, 1], [-26, -26, 1.2], [-36, -18, 1.4], [-38, 2, 1], [-20, 8, 0.9],
    [-12, 6.5, 1], [3, 4, 0.9], [-1, -9, 1.1], [7, -9, 1], [24, 7, 1.1], [32, 6, 1.2], [38, -14, 1.3], [30, -20, 1.1],
    [26, -30, 1.2], [-14, -27, 1], [16, -32, 1.1], [-40, -32, 1.2], [40, -32, 1.1], [-17, 3, 0.8], [8, 7.5, 0.8],
    [-46, 17, 1.2], [-52, 17, 1.0], [48, 17, 1.2], [54, 17, 1.0],
  ];
  return { boxes, glow, cyls, blobs, trees, lamps };
}

const tmpO = new THREE.Object3D();
const tmpC = new THREE.Color();

function Instanced({ items, kind }: { items: Box[]; kind: "lambert" | "glow" }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    items.forEach((b, i) => {
      tmpO.position.set(b.p[0], b.p[1], b.p[2]);
      tmpO.rotation.set(0, b.r || 0, 0);
      tmpO.scale.set(b.s[0], b.s[1], b.s[2]);
      tmpO.updateMatrix();
      ref.current.setMatrixAt(i, tmpO.matrix);
      ref.current.setColorAt(i, tmpC.set(b.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      {kind === "glow" ? <meshBasicMaterial toneMapped={false} /> : <meshLambertMaterial />}
    </instancedMesh>
  );
}

function Cyls({ items }: { items: Cyl[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    items.forEach((c, i) => {
      tmpO.position.set(c.p[0], c.p[1], c.p[2]);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.set(c.rad, c.h, c.rad);
      tmpO.updateMatrix();
      ref.current.setMatrixAt(i, tmpO.matrix);
      ref.current.setColorAt(i, tmpC.set(c.c));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} frustumCulled={false}>
      <cylinderGeometry args={[1, 1, 1, 12]} />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

function Trees({ trees }: { trees: [number, number, number][] }) {
  const trunk = useRef<THREE.InstancedMesh>(null!);
  const crown = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    trees.forEach(([x, z, s], i) => {
      tmpO.position.set(x, 1.1 * s, z);
      tmpO.rotation.set(0, 0, 0);
      tmpO.scale.set(0.16 * s, 2.2 * s, 0.16 * s);
      tmpO.updateMatrix();
      trunk.current.setMatrixAt(i, tmpO.matrix);
      for (let j = 0; j < 3; j++) {
        const a = hash(i * 7 + j) * Math.PI * 2;
        tmpO.position.set(x + Math.cos(a) * 0.6 * s * (j ? 1 : 0), (2.7 + j * 0.45) * s, z + Math.sin(a) * 0.6 * s * (j ? 1 : 0));
        tmpO.rotation.set(a, a * 0.7, 0);
        const r = (j ? 1.15 : 1.55) * s;
        tmpO.scale.set(r, r * 0.9, r);
        tmpO.updateMatrix();
        crown.current.setMatrixAt(i * 3 + j, tmpO.matrix);
        crown.current.setColorAt(i * 3 + j, tmpC.set(j === 0 ? "#2e6b3a" : hash(i + j) < 0.5 ? "#3b7d45" : "#2a5e33"));
      }
    });
    trunk.current.instanceMatrix.needsUpdate = true;
    crown.current.instanceMatrix.needsUpdate = true;
    if (crown.current.instanceColor) crown.current.instanceColor.needsUpdate = true;
  }, [trees]);
  return (
    <>
      <instancedMesh ref={trunk} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1.2, 1, 8]} />
        <meshLambertMaterial color="#5a4232" />
      </instancedMesh>
      <instancedMesh ref={crown} args={[undefined, undefined, trees.length * 3]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </>
  );
}

function Domes({ blobs }: { blobs: Blob[] }) {
  return (
    <>
      {blobs.map((b, i) => (
        <mesh key={i} position={b.p}>
          <sphereGeometry args={[b.s, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
          <meshStandardMaterial color={b.c} roughness={0.15} metalness={0.4} />
        </mesh>
      ))}
    </>
  );
}

/* ---------- Texturas de letreros y pantallas ---------- */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function Signs() {
  const urban = useMemo(
    () =>
      canvasTex(1024, 160, (g) => {
        g.fillStyle = "#f8fafc";
        g.font = "800 112px Inter, system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        (g as any).letterSpacing = "28px";
        g.fillText("URBAN", 512, 84);
      }),
    [],
  );
  const mono = useMemo(
    () =>
      canvasTex(512, 768, (g) => {
        g.fillStyle = "#1b202a";
        g.fillRect(0, 0, 512, 768);
        g.fillStyle = "#3B82F6";
        g.fillRect(0, 0, 512, 10);
        g.fillStyle = "#f8fafc";
        g.textAlign = "center";
        g.font = "800 96px Inter, system-ui, sans-serif";
        (g as any).letterSpacing = "14px";
        g.fillText("URBAN", 256, 230);
        (g as any).letterSpacing = "2px";
        g.font = "600 30px Inter, system-ui, sans-serif";
        g.fillStyle = "#94a3b8";
        g.fillText("CONJUNTO RESIDENCIAL", 256, 300);
        const grad = g.createLinearGradient(110, 0, 400, 0);
        grad.addColorStop(0, "#7ef0e0");
        grad.addColorStop(0.5, "#38bdf8");
        grad.addColorStop(1, "#a855f7");
        g.fillStyle = grad;
        g.font = "800 52px Inter, system-ui, sans-serif";
        g.fillText("VISIONYX", 256, 600);
        g.fillStyle = "#94a3b8";
        g.font = "500 22px Inter, system-ui, sans-serif";
        g.fillText("Inteligencia que conecta el mundo real", 256, 650);
      }),
    [],
  );
  const tower = (label: string) =>
    canvasTex(512, 128, (g) => {
      g.fillStyle = "#f8fafc";
      g.font = "700 74px Inter, system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      (g as any).letterSpacing = "10px";
      g.fillText(label, 256, 68);
    });
  const tA = useMemo(() => tower("TORRE A"), []);
  const tB = useMemo(() => tower("TORRE B"), []);
  const tC = useMemo(() => tower("TORRE C"), []);
  const adm = useMemo(() => tower("ADMINISTRACIÓN"), []);
  const rele = useMemo(
    () =>
      canvasTex(128, 64, (g) => {
        g.fillStyle = "#e5e7eb";
        g.fillRect(0, 0, 128, 64);
        g.fillStyle = "#111827";
        g.font = "800 30px Inter, system-ui, sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText("RELÉ", 64, 34);
      }),
    [],
  );
  return (
    <group>
      <mesh position={[-0.2, 3.72, 13.48]}>
        <planeGeometry args={[5.2, 0.81]} />
        <meshBasicMaterial map={urban} transparent toneMapped={false} />
      </mesh>
      {/* monolito de la entrada */}
      <mesh position={[-8.2, 1.35, 13.3]}>
        <boxGeometry args={[1.7, 2.7, 0.4]} />
        <meshLambertMaterial color="#1b202a" />
      </mesh>
      <mesh position={[-8.2, 1.35, 13.505]}>
        <planeGeometry args={[1.7, 2.55]} />
        <meshBasicMaterial map={mono} toneMapped={false} />
      </mesh>
      <mesh position={[-15, 3.62, -15.5 + 5.5 + 2.81]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={tA} transparent toneMapped={false} />
      </mesh>
      <mesh position={[12.5, 3.62, -19.5 + 5 + 2.81]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={tB} transparent toneMapped={false} />
      </mesh>
      <mesh position={[-1.5, 3.62, -33 + 4 + 2.81]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={tC} transparent toneMapped={false} />
      </mesh>
      <mesh position={[P.office[0], 3.75, P.office[1] + 2.31]}>
        <planeGeometry args={[4, 1]} />
        <meshBasicMaterial map={adm} transparent toneMapped={false} />
      </mesh>
      <mesh position={[-1.6, 1.42, 11.795]}>
        <planeGeometry args={[0.18, 0.09]} />
        <meshBasicMaterial map={rele} toneMapped={false} />
      </mesh>
      <mesh position={[-1.6, 1.55, 11.8]}>
        <sphereGeometry args={[0.016, 8, 6]} />
        <meshBasicMaterial color="#22C55E" toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Pantalla del kiosko: textos de web/src/app/kiosk/page.tsx (fase SCANNING). */
function KioskScreen() {
  const tex = useMemo(
    () =>
      canvasTex(640, 460, (g) => {
        g.fillStyle = "#05080f";
        g.fillRect(0, 0, 640, 460);
        g.fillStyle = "#0b1220";
        g.fillRect(0, 0, 640, 76);
        g.fillStyle = "#f8fafc";
        g.font = "900 30px Inter, system-ui, sans-serif";
        g.fillText("URBAN", 24, 40);
        g.fillStyle = "rgba(255,255,255,0.4)";
        g.font = "600 30px Inter, system-ui, sans-serif";
        g.fillText("· Control de Acceso", 136, 40);
        g.font = "500 18px Inter, system-ui, sans-serif";
        g.fillStyle = "rgba(255,255,255,0.45)";
        g.fillText("Peatonal principal · ", 24, 64);
        g.fillStyle = "#34d399";
        g.fillText("● SISTEMA EN VIVO", 196, 64);
        // óvalo de cámara
        g.strokeStyle = "#38bdf8";
        g.lineWidth = 5;
        g.beginPath();
        g.ellipse(320, 210, 92, 112, 0, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#f8fafc";
        g.textAlign = "center";
        g.font = "800 34px Inter, system-ui, sans-serif";
        g.fillText("Acérquese a la cámara", 320, 384);
        g.fillStyle = "#94a3b8";
        g.font = "500 22px Inter, system-ui, sans-serif";
        g.fillText("Mire al frente. Buscando un rostro…", 320, 420);
      }),
    [],
  );
  const [kx, kz] = P.kiosk;
  return (
    <mesh position={[kx - 0.95, 1.38, kz + 0.055]}>
      <planeGeometry args={[0.42, 0.3]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}

/** Monitores de la caseta (muro de cámaras, sin texto) y monitor de la oficina. */
function Monitors() {
  const cams = useMemo(
    () =>
      canvasTex(512, 300, (g) => {
        g.fillStyle = "#020617";
        g.fillRect(0, 0, 512, 300);
        const tiles = [["#1e293b", "#334155"], ["#1f2937", "#3f4a5a"], ["#172033", "#2c3a52"], ["#1b2433", "#36465e"]];
        tiles.forEach(([a, b], i) => {
          const x = (i % 2) * 256 + 6;
          const y = Math.floor(i / 2) * 150 + 6;
          const gr = g.createLinearGradient(x, y, x, y + 138);
          gr.addColorStop(0, b);
          gr.addColorStop(1, a);
          g.fillStyle = gr;
          g.fillRect(x, y, 244, 138);
          g.fillStyle = "rgba(255,255,255,0.12)";
          g.fillRect(x + 20, y + 80 - (i % 2) * 20, 90, 50);
          g.fillRect(x + 140, y + 60, 60, 70);
          g.fillStyle = "#ef4444";
          g.beginPath();
          g.arc(x + 14, y + 14, 5, 0, Math.PI * 2);
          g.fill();
        });
      }),
    [],
  );
  const admin = useMemo(
    () =>
      canvasTex(512, 300, (g) => {
        g.fillStyle = "#0F172A";
        g.fillRect(0, 0, 512, 300);
        g.fillStyle = "#1E293B";
        g.fillRect(0, 0, 120, 300);
        for (let i = 0; i < 12; i++) {
          g.fillStyle = i === 4 ? "rgba(59,130,246,0.35)" : "rgba(148,163,184,0.18)";
          g.fillRect(12, 40 + i * 20, 96, 12);
        }
        g.fillStyle = "#1E293B";
        g.fillRect(140, 30, 350, 46);
        g.fillStyle = "#3B82F6";
        g.fillRect(140, 92, 90, 22);
        g.fillStyle = "#1E293B";
        g.fillRect(140, 130, 350, 40);
        g.fillRect(140, 180, 350, 40);
      }),
    [],
  );
  const [bx, bz] = P.booth;
  return (
    <group>
      {[-0.75, 0.75].map((x) => (
        <mesh key={x} position={[bx + x, 1.36, bz + 1.35]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.17, 0.66]} />
          <meshBasicMaterial map={cams} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[P.office[0], 1.12, P.monitor[2] - 0.125]}>
        <planeGeometry args={[0.92, 0.54]} />
        <meshBasicMaterial map={admin} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Glass() {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: "#a9cbe8", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }), []);
  const [bx, bz] = P.booth;
  const [ox, oz] = P.office;
  const [tx, tz] = P.turnstile;
  return (
    <group>
      <mesh material={m} position={[bx, 2.2, bz + 1.68]}><boxGeometry args={[5.5, 2.2, 0.03]} /></mesh>
      <mesh material={m} position={[bx, 2.2, bz - 1.68]}><boxGeometry args={[5.5, 2.2, 0.03]} /></mesh>
      <mesh material={m} position={[bx - 2.76, 2.2, bz]}><boxGeometry args={[0.03, 2.2, 3.3]} /></mesh>
      <mesh material={m} position={[bx + 2.76, 2.2, bz]}><boxGeometry args={[0.03, 2.2, 3.3]} /></mesh>
      <mesh material={m} position={[ox, 1.8, oz + 1.72]}><boxGeometry args={[7.4, 3.4, 0.03]} /></mesh>
      <mesh material={m} position={[tx + 1.1, 0.95, tz]}><boxGeometry args={[0.45, 1.5, 0.03]} /></mesh>
    </group>
  );
}

/** Brazos del torniquete (en el capítulo 1 queda en reposo; gira en el capítulo 2 con el relé). */
function TurnstileArms() {
  const [tx, tz] = P.turnstile;
  return (
    <group position={[tx - 0.6, 0.95, tz]} rotation={[0, 0, 0]}>
      {[0, 1, 2].map((i) => (
        <group key={i} rotation={[(i * Math.PI * 2) / 3, 0, 0]}>
          <mesh position={[0.32, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.022, 0.022, 0.62, 10]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.25} metalness={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.04, 0.06, 0.3]} />
        <meshBasicMaterial color="#22C55E" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Sky() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(260, 32, 16);
    const pos = g.attributes.position;
    const cols: number[] = [];
    const top = new THREE.Color("#0b1530");
    const mid = new THREE.Color("#3a4a78");
    const hor = new THREE.Color("#e48f62");
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 260;
      const x = pos.getX(i) / 260;
      const warm = 0.55 + 0.45 * Math.max(0, -x);
      if (y < 0.02) c.copy(hor).lerp(new THREE.Color("#2a2f45"), Math.min(1, -y * 4));
      else if (y < 0.25) c.copy(hor).lerp(mid, y / 0.25).lerp(mid, 1 - warm);
      else c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    return g;
  }, []);
  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} toneMapped={false} />
    </mesh>
  );
}

/* ---------- Cámara ---------- */
function CameraRig({ clock }: { clock: UrbanClock }) {
  const { camera, size } = useThree();
  const cur = useRef({ ax: 0.5, ay: 0.5, init: false });
  const tgt = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (clock.mode === "tour") {
      const s = cameraAt(clock.t, clock.mobile);
      cam.position.set(s.p[0], s.p[1], s.p[2]);
      tgt.set(s.q[0], s.q[1], s.q[2]);
      cam.lookAt(tgt);
      const k = cur.current.init ? 1 - Math.exp(-dt * 4) : 1;
      cur.current.ax += (s.ax - cur.current.ax) * k;
      cur.current.ay += (s.ay - cur.current.ay) * k;
      cur.current.init = true;
    } else if (clock.mode === "hero") {
      const a = state.clock.elapsedTime * 0.05 + 0.75;
      cam.position.set(Math.sin(a) * 62, 30, Math.cos(a) * 62 - 6);
      tgt.set(0, 4, -8);
      cam.lookAt(tgt);
      cur.current.ax = 0.5;
      cur.current.ay = 0.5;
    } else {
      cur.current.ax += (0.5 - cur.current.ax) * 0.1;
      cur.current.ay += (0.5 - cur.current.ay) * 0.1;
    }
    const fov = clock.mobile ? (clock.mode === "tour" ? 52 : 50) : 34;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
    }
    const w = size.width;
    const h = size.height;
    const ox = (0.5 - cur.current.ax) * w;
    const oy = (0.5 - cur.current.ay) * h;
    if (Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5) cam.setViewOffset(w, h, ox, oy, w, h);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  });
  return null;
}

function ClockDriver({ clock }: { clock: UrbanClock }) {
  useFrame((state) => {
    const w = window as any;
    w.__urT = clock.mode === "tour" ? clock.t : state.clock.elapsedTime;
  }, -10);
  return null;
}

const LOOKS: Record<string, Look> = {
  maria: { female: true, skin: "#c99572", hair: "#2b1a12", top: "#e2725b", legs: "#2f3d5c", shoes: "#f1f5f9", hairStyle: "pony" },
  carlos: { female: false, skin: "#9a6b4f", hair: "#1a1410", top: "#1e3a5f", legs: "#111827", shoes: "#111827", hairStyle: "cap", build: 0.55, badge: "#f59e0b" },
  diana: { female: true, skin: "#e0b18f", hair: "#5a3a22", top: "#334155", sleeves: "#334155", legs: "#4b5563", shoes: "#1f2937", hairStyle: "bun" },
};

function Scene({ clock, explore }: { clock: UrbanClock; explore: boolean }) {
  const S = useMemo(() => buildStatic(), []);
  const maria = useMemo(() => (t: number) => mariaPose(t, clock.touring), [clock]);
  const [lx, lz] = P.lobbyA;
  return (
    <>
      <ClockDriver clock={clock} />
      <Sky />
      <fog attach="fog" args={["#4a4f6e", 70, 240]} />
      <hemisphereLight args={["#b4c2e8", "#40362b", 1.0]} />
      <directionalLight position={[-60, 28, 30]} intensity={1.35} color="#ffc08a" />
      <directionalLight position={[40, 30, 25]} intensity={0.75} color="#c9d6ff" />
      <pointLight position={[-1.5, 3.4, 11]} intensity={14} distance={12} decay={1.6} color="#ffe0b0" />
      <pointLight position={[lx, 3, lz + 2.5]} intensity={10} distance={10} decay={1.6} color="#ffe0b0" />
      <pointLight position={[P.office[0], 3.2, P.office[1]]} intensity={10} distance={9} decay={1.6} color="#fff0d8" />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[520, 520]} />
        <meshLambertMaterial color="#2c4a30" />
      </mesh>
      <Instanced items={S.boxes} kind="lambert" />
      <Instanced items={S.glow} kind="glow" />
      <Cyls items={S.cyls} />
      <Trees trees={S.trees} />
      <Domes blobs={S.blobs} />
      <Signs />
      <KioskScreen />
      <Monitors />
      <TurnstileArms />
      <Glass />
      <Person look={LOOKS.maria} pose={maria} />
      <Person look={LOOKS.carlos} pose={carlosPose} />
      <Person look={LOOKS.diana} pose={dianaPose} />
      <CameraRig clock={clock} />
      {explore && (
        <OrbitControls
          makeDefault
          target={[0, 3, -4]}
          enablePan={false}
          minDistance={10}
          maxDistance={110}
          maxPolarAngle={1.42}
          enableDamping
          dampingFactor={0.08}
        />
      )}
    </>
  );
}

export default function UrbanWorld3D({ clock, active, explore, capture }: { clock: UrbanClock; active: boolean; explore: boolean; capture?: boolean }) {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const d = window.devicePixelRatio || 1;
    setDpr(capture ? Math.min(2, d) : Math.min(clock.mobile ? 1.5 : 1.75, d));
  }, [capture, clock.mobile]);
  return (
    <Canvas
      dpr={dpr}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 34, near: 0.1, far: 600, position: [46, 34, 52] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
      }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false, preserveDrawingBuffer: !!capture }}
      style={{ touchAction: explore ? "none" : "pan-y" }}
    >
      {!capture && <PerformanceMonitor onDecline={() => setDpr(1)} />}
      <Scene clock={clock} explore={explore} />
    </Canvas>
  );
}
