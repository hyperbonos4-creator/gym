"use client";

/**
 * Gemelo digital 3D (three.js + React Three Fiber).
 * Rendimiento: geometría estática fusionada en InstancedMesh (pocas draw calls),
 * socios instanciados por partes, sin sombras reales ni post-procesado,
 * DPR limitado y render pausado cuando la pestaña o el canvas no son visibles.
 * Todo procedural, sin assets externos.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, advance, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { MAX_MEMBERS, formatCOP, phaseLabel, type GemeloSim, type Layout, type StationKind } from "../../lib/gemelo/sim";
import type { WorldCtrl, CamPreset } from "../../lib/gemelo/ctrl";
import type { Tour } from "../../lib/gemelo/tour";
import { TOUR_PERSON } from "../../lib/gemelo/tour";
import { StudioEnv, Turnstiles } from "./Turnstiles";
import { Human } from "./Human";
import { ClientesPanel3D, PhoneOverlay, StatusToast } from "./TourPanels";
import { CoachPanel, PhoneEntreno } from "./TourPanels2";

type Box = { p: [number, number, number]; s: [number, number, number]; r: number; c: string };
type Cyl = { p: [number, number, number]; rad: number; h: number; axis: "x" | "y" | "z"; r: number; c: string };

function buildStatic(L: Layout) {
  const boxes: Box[] = [];
  const glow: Box[] = [];
  const cyls: Cyl[] = [];
  const m = L.mirror;
  const B = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string, r = 0) =>
    boxes.push({ p: [x, y, z], s: [sx, sy, sz], r, c });
  const G = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: string, r = 0) =>
    glow.push({ p: [x, y, z], s: [sx, sy, sz], r, c });
  const C = (x: number, y: number, z: number, rad: number, h: number, axis: Cyl["axis"], c: string, r = 0) =>
    cyls.push({ p: [x, y, z], rad, h, axis, r, c });

  // Calle y andén
  B(0, -0.06, 17.5, 60, 0.1, 9, "#0b1020");
  B(0, -0.02, 14.2, 44, 0.06, 2.2, "#1a2238");
  for (let i = -6; i <= 6; i++) B(i * 4, -0.0, 19.2, 1.8, 0.02, 0.18, "#5b6785");
  // Piso interior
  B(0, -0.05, 0, 36, 0.1, 26, "#0d1426");
  // Zonas
  for (const zr of L.zones) {
    const cx = (zr.x0 + zr.x1) / 2;
    const cz = (zr.z0 + zr.z1) / 2;
    const w = zr.x1 - zr.x0;
    const d = zr.z1 - zr.z0;
    const col = zr.zone === "pesas" ? "#141d36" : zr.zone === "cardio" ? "#16183a" : zr.zone === "funcional" ? "#13263a" : "#111a30";
    B(cx, 0.005, cz, w, 0.02, d, col);
    const gc = zr.zone === "pesas" ? L.accent : zr.zone === "cardio" ? L.accent2 : zr.zone === "funcional" ? "#A3E635" : "#38BDF8";
    G(cx, 0.03, zr.z0, w, 0.02, 0.06, gc);
    G(cx, 0.03, zr.z1, w, 0.02, 0.06, gc);
    G(zr.x0, 0.03, cz, 0.06, 0.02, d, gc);
    G(zr.x1, 0.03, cz, 0.06, 0.02, d, gc);
  }
  // Pasillo central guía
  for (let z = -11; z <= 6; z += 1.6) G(0, 0.03, z, 0.12, 0.02, 0.7, "#2b3a63");
  // Paredes: altas atrás e izquierda (corte isométrico), bajas adelante y derecha
  const wall = "#18213a";
  B(0, 1.6, -13.2, 36.4, 3.2, 0.4, wall);
  B(-18.2 * m, 1.6, 0, 0.4, 3.2, 26.8, wall);
  B(18.2 * m, 0.25, 0, 0.4, 0.5, 26.8, wall);
  B(-11.1, 0.25, 13.2, 14.2, 0.5, 0.4, wall);
  B(11.1, 0.25, 13.2, 14.2, 0.5, 0.4, wall);
  // Neón perimetral y ventanales
  G(0, 3.15, -13.0, 36, 0.08, 0.08, L.accent);
  G(-18.0 * m, 3.15, 0, 0.08, 0.08, 26.4, L.accent2);
  for (let i = 0; i < 8; i++) B(-14 + i * 4, 1.9, -12.98, 3.2, 1.6, 0.04, "#1d2d52");
  G(18.2 * m, 0.52, 0, 0.42, 0.04, 26.8, L.accent2);
  G(-11.1, 0.52, 13.2, 14.2, 0.04, 0.42, L.accent);
  G(11.1, 0.52, 13.2, 14.2, 0.04, 0.42, L.accent);
  // Espejos zona pesas (pared lateral)
  for (let i = 0; i < 4; i++) B(-17.95 * m, 1.6, -10 + i * 3.6, 0.04, 2.2, 3.2, "#2a3c66");
  // Recepción
  const rx = L.reception.x;
  const rz = L.reception.z;
  B(rx, 0.55, rz, 5.2, 1.1, 1.0, "#1e2a4a");
  B(rx, 1.12, rz + 0.1, 5.4, 0.06, 1.2, "#2d3d66");
  G(rx, 0.6, rz + 0.52, 5.0, 0.06, 0.02, L.accent);
  B(rx - 1.2, 1.35, rz - 0.1, 0.6, 0.4, 0.05, "#0f172a");
  G(rx - 1.2, 1.35, rz - 0.07, 0.52, 0.32, 0.01, "#7dd3fc");
  B(rx + 1.4, 1.2, rz, 0.4, 0.15, 0.3, "#0f172a"); // datáfono / POS
  // Lockers en el lobby
  for (let i = 0; i < 6; i++) {
    B((-16.6 + i * 0.75) * m * -1 * -1, 0.95, 12.6, 0.7, 1.9, 0.5, i % 2 ? "#243257" : "#1f2b4b");
  }
  // Plantas
  for (const px of [-15.5, 15.5, -5, 5]) {
    B(px, 0.3, 12.7, 0.7, 0.6, 0.7, "#2a334d");
    B(px, 0.95, 12.7, 0.5, 0.8, 0.5, "#1f7a4d");
  }
  // Torniquetes reales: ver Turnstiles.tsx (modelo PBR aparte)
  // Señal VISIONYX pared fondo (barras)
  // Equipos
  for (const s of L.stations) {
    const c = Math.cos(s.rot);
    const sn = Math.sin(s.rot);
    // local (lx, lz) -> mundo
    const W = (lx: number, lz: number): [number, number] => [s.x + lx * c + lz * sn, s.z - lx * sn + lz * c];
    const LB = (lx: number, y: number, lz: number, sx: number, sy: number, sz: number, col: string) => {
      const [x, z] = W(lx, lz);
      B(x, y, z, sx, sy, sz, col, s.rot);
    };
    const LG = (lx: number, y: number, lz: number, sx: number, sy: number, sz: number, col: string) => {
      const [x, z] = W(lx, lz);
      G(x, y, z, sx, sy, sz, col, s.rot);
    };
    const LC = (lx: number, y: number, lz: number, rad: number, h: number, axis: Cyl["axis"], col: string) => {
      const [x, z] = W(lx, lz);
      C(x, y, z, rad, h, axis, col, s.rot);
    };
    switch (s.kind as StationKind) {
      case "cinta":
        LB(0, 0.1, 0.15, 0.95, 0.2, 2.1, "#1b2440");
        LB(0, 0.21, 0.1, 0.72, 0.03, 1.8, "#070a12");
        LB(-0.42, 0.75, 0.95, 0.07, 1.1, 0.07, "#334155");
        LB(0.42, 0.75, 0.95, 0.07, 1.1, 0.07, "#334155");
        LB(0, 1.32, 0.95, 0.95, 0.32, 0.14, "#263354");
        LG(0, 1.36, 0.87, 0.62, 0.16, 0.02, L.accent2);
        break;
      case "bici":
        LB(0, 0.35, 0, 0.28, 0.5, 1.2, "#263354");
        LB(0, 0.86, -0.32, 0.32, 0.08, 0.38, "#0f172a");
        LB(0, 1.1, 0.5, 0.56, 0.06, 0.08, "#334155");
        LC(0, 0.45, 0.5, 0.32, 0.12, "x", "#475569");
        LG(0, 1.2, 0.56, 0.3, 0.12, 0.02, L.accent2);
        break;
      case "banco":
        LB(0, 0.24, 0, 0.42, 0.14, 1.35, "#2a3350");
        LB(0, 0.1, 0.45, 0.3, 0.2, 0.1, "#334155");
        LB(0, 0.1, -0.45, 0.3, 0.2, 0.1, "#334155");
        LB(-0.62, 0.7, -0.6, 0.08, 1.4, 0.08, "#475569");
        LB(0.62, 0.7, -0.6, 0.08, 1.4, 0.08, "#475569");
        LC(0, 1.25, -0.6, 0.025, 1.8, "x", "#cbd5e1");
        LC(-0.78, 1.25, -0.6, 0.22, 0.07, "x", "#111827");
        LC(0.78, 1.25, -0.6, 0.22, 0.07, "x", "#b91c1c");
        break;
      case "rack":
        for (const [lx, lz] of [[-0.75, -0.5], [0.75, -0.5], [-0.75, 0.45], [0.75, 0.45]] as const)
          LB(lx, 1.1, lz, 0.09, 2.2, 0.09, "#475569");
        LB(0, 2.2, -0.02, 1.6, 0.08, 1.05, "#334155");
        LG(0, 2.26, -0.02, 1.62, 0.02, 0.05, L.accent);
        LB(0, 0.02, 0, 1.6, 0.04, 1.3, "#1f2937");
        LC(0, 1.52, -0.1, 0.025, 2.0, "x", "#cbd5e1");
        LC(-0.92, 1.52, -0.1, 0.26, 0.08, "x", "#111827");
        LC(0.92, 1.52, -0.1, 0.26, 0.08, "x", "#1d4ed8");
        break;
      case "mancuernas":
        LB(0, 0.35, 0.85, 1.3, 0.7, 0.45, "#1f2937");
        for (let i = 0; i < 4; i++) LC(-0.45 + i * 0.3, 0.76, 0.85, 0.08, 0.26, "x", i % 2 ? "#334155" : "#475569");
        break;
      case "tapete":
        LB(0, 0.02, 0, 1.05, 0.04, 1.9, "#1e3a5f");
        LC(0.7, 0.12, 0.7, 0.13, 0.22, "y", "#f59e0b");
        break;
      case "cajon":
        LB(0, 0.3, 0.75, 0.75, 0.6, 0.75, "#9a3412");
        LG(0, 0.61, 0.75, 0.76, 0.02, 0.76, "#fb923c");
        break;
    }
  }
  return { boxes, glow, cyls };
}

/** En captura, delta fijo por cuadro (R3F puede medir tiempo real entre screenshots). */
export function fdt(dt: number): number {
  const w = typeof window !== "undefined" ? (window as any) : null;
  return w && typeof w.__gmFixedDt === "number" ? w.__gmFixedDt : dt;
}

const tmpO = new THREE.Object3D();
const tmpC = new THREE.Color();

function StaticWorld({ L }: { L: Layout }) {
  const data = useMemo(() => buildStatic(L), [L]);
  const boxRef = useRef<THREE.InstancedMesh>(null!);
  const glowRef = useRef<THREE.InstancedMesh>(null!);
  const cylRef = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    const fill = (mesh: THREE.InstancedMesh, arr: Box[]) => {
      arr.forEach((b, i) => {
        tmpO.position.set(b.p[0], b.p[1], b.p[2]);
        tmpO.rotation.set(0, b.r, 0);
        tmpO.scale.set(b.s[0], b.s[1], b.s[2]);
        tmpO.updateMatrix();
        mesh.setMatrixAt(i, tmpO.matrix);
        mesh.setColorAt(i, tmpC.set(b.c));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    };
    fill(boxRef.current, data.boxes);
    fill(glowRef.current, data.glow);
    data.cyls.forEach((c, i) => {
      tmpO.position.set(c.p[0], c.p[1], c.p[2]);
      tmpO.rotation.set(0, c.r, 0);
      tmpO.scale.set(c.rad, c.h, c.rad);
      tmpO.updateMatrix();
      if (c.axis !== "y") {
        const rot = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(c.axis === "x" ? 0 : 1, 0, c.axis === "x" ? 1 : 0), Math.PI / 2);
        const sc = new THREE.Matrix4().makeScale(c.rad, c.h, c.rad);
        const base = new THREE.Matrix4().compose(tmpO.position, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.r, 0)), new THREE.Vector3(1, 1, 1));
        tmpO.matrix.copy(base.multiply(rot).multiply(sc));
      }
      cylRef.current.setMatrixAt(i, tmpO.matrix);
      cylRef.current.setColorAt(i, tmpC.set(c.c));
    });
    cylRef.current.instanceMatrix.needsUpdate = true;
    if (cylRef.current.instanceColor) cylRef.current.instanceColor.needsUpdate = true;
    cylRef.current.computeBoundingSphere();
  }, [data]);
  return (
    <group>
      <instancedMesh ref={boxRef} args={[undefined, undefined, data.boxes.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={glowRef} args={[undefined, undefined, data.glow.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={cylRef} args={[undefined, undefined, data.cyls.length]}>
        <cylinderGeometry args={[1, 1, 1, 12]} />
        <meshLambertMaterial />
      </instancedMesh>
      <BrandSign L={L} />
    </group>
  );
}

function BrandSign({ L }: { L: Layout }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 192;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 1024, 0);
    grad.addColorStop(0, "#7ef0e0");
    grad.addColorStop(0.5, "#38bdf8");
    grad.addColorStop(1, "#a855f7");
    g.fillStyle = grad;
    g.font = "800 128px Orbitron, Inter, system-ui, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("VISIONYX", 512, 100);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return (
    <mesh position={[4 * -L.mirror, 2.55, -12.95]}>
      <planeGeometry args={[7.2, 1.35]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/* ---------- Socios instanciados por partes ---------- */

const M_base = new THREE.Matrix4();
const M_tmp = new THREE.Matrix4();
const M_rot = new THREE.Matrix4();
const V_pos = new THREE.Vector3();
const Q_rot = new THREE.Quaternion();
const E_rot = new THREE.Euler();
const V_one = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const SHADOW_ROT = new THREE.Matrix4().makeRotationX(-Math.PI / 2);

type Pose = { y: number; legL: [number, number]; legR: [number, number]; armL: [number, number]; armR: [number, number]; lean: number };

function pose(kind: string, a: number, moving: boolean, phase: string): Pose {
  const p: Pose = { y: 0, legL: [0, 0], legR: [0, 0], armL: [0, 0.06], armR: [0, -0.06], lean: 0 };
  if (phase !== "entrenando") {
    if (moving) {
      const s = Math.sin(a);
      p.legL[0] = s * 0.55;
      p.legR[0] = -s * 0.55;
      p.armL[0] = -s * 0.45;
      p.armR[0] = s * 0.45;
      p.y = Math.abs(Math.cos(a)) * 0.05;
    } else {
      p.armL[1] = 0.08 + Math.sin(a) * 0.02;
      p.armR[1] = -0.08 - Math.sin(a) * 0.02;
    }
    return p;
  }
  switch (kind) {
    case "cinta": {
      const s = Math.sin(a * 2.6);
      p.y = 0.21 + Math.abs(Math.cos(a * 2.6)) * 0.08;
      p.legL[0] = s * 0.75;
      p.legR[0] = -s * 0.75;
      p.armL[0] = -s * 0.8;
      p.armR[0] = s * 0.8;
      p.lean = 0.12;
      break;
    }
    case "bici": {
      const s = Math.sin(a * 2);
      p.y = 0.05;
      p.legL[0] = -1.0 + s * 0.45;
      p.legR[0] = -1.0 - s * 0.45;
      p.armL[0] = -1.1;
      p.armR[0] = -1.1;
      p.lean = 0.35;
      break;
    }
    case "banco": {
      const s = (1 - Math.cos(a * 1.4)) / 2;
      p.y = -0.38;
      p.legL[0] = -1.45;
      p.legR[0] = -1.45;
      p.armL[0] = -0.2 - s * 1.5;
      p.armR[0] = -0.2 - ((1 - Math.cos(a * 1.4 + 1.6)) / 2) * 1.5;
      break;
    }
    case "rack": {
      const s = (1 - Math.cos(a * 1.1)) / 2;
      p.y = -s * 0.38;
      p.legL[0] = -s * 0.9;
      p.legR[0] = -s * 0.9;
      p.legL[1] = 0.12;
      p.legR[1] = -0.12;
      p.armL = [-2.7, 0.35];
      p.armR = [-2.7, -0.35];
      p.lean = s * 0.35;
      break;
    }
    case "mancuernas": {
      const s = (1 - Math.cos(a * 1.3)) / 2;
      p.armL = [0, 0.4 + s * 2.4];
      p.armR = [0, -0.4 - s * 2.4];
      break;
    }
    case "tapete": {
      const s = (1 - Math.cos(a * 2.2)) / 2;
      p.y = Math.sin(a * 2.2) > 0 ? Math.sin(a * 2.2) * 0.12 : 0;
      p.armL = [0, 0.15 + s * 2.6];
      p.armR = [0, -0.15 - s * 2.6];
      p.legL = [0, s * 0.35];
      p.legR = [0, -s * 0.35];
      break;
    }
    case "cajon": {
      const c = (a * 0.9) % (Math.PI * 2);
      const jump = Math.max(0, Math.sin(c));
      p.y = jump * 0.75;
      p.legL[0] = -jump * 0.9;
      p.legR[0] = -jump * 0.9;
      p.armL[0] = -1.4 + jump * -1.2;
      p.armR[0] = -1.4 + jump * -1.2;
      break;
    }
    default: {
      const s = Math.sin(a * 0.8);
      p.armL = [-2.9, 0.2 + s * 0.2];
      p.armR = [-2.9, -0.2 - s * 0.2];
      p.lean = s * 0.15;
    }
  }
  return p;
}

function limb(target: THREE.Matrix4, base: THREE.Matrix4, px: number, py: number, rx: number, rz: number, len: number) {
  target.copy(base);
  M_tmp.makeTranslation(px, py, 0);
  target.multiply(M_tmp);
  E_rot.set(rx, 0, rz);
  M_rot.makeRotationFromEuler(E_rot);
  target.multiply(M_rot);
  M_tmp.makeTranslation(0, -len / 2, 0);
  target.multiply(M_tmp);
}

function Members({ sim, ctrl, onPick }: { sim: GemeloSim; ctrl: WorldCtrl; onPick: (id: number) => void }) {
  const torso = useRef<THREE.InstancedMesh>(null!);
  const head = useRef<THREE.InstancedMesh>(null!);
  const legs = useRef<THREE.InstancedMesh>(null!);
  const arms = useRef<THREE.InstancedMesh>(null!);
  const shadow = useRef<THREE.InstancedMesh>(null!);
  const hit = useRef<THREE.InstancedMesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const colorsVersion = useRef("");
  const M = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state) => {
    const ms = sim.members;
    // Colores (solo cuando cambian identidades)
    const sig = ms.map((m) => m.shirt + m.pants).join("|") + sim.version;
    if (sig !== colorsVersion.current) {
      colorsVersion.current = sig;
      ms.forEach((m, i) => {
        torso.current.setColorAt(i, tmpC.set(m.shirt));
        head.current.setColorAt(i, tmpC.set(m.skin));
        legs.current.setColorAt(i * 2, tmpC.set(m.pants));
        legs.current.setColorAt(i * 2 + 1, tmpC.set(m.pants));
        arms.current.setColorAt(i * 2, tmpC.set(m.shirt));
        arms.current.setColorAt(i * 2 + 1, tmpC.set(m.shirt));
      });
      for (const r of [torso, head, legs, arms]) if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
    }
    for (let i = 0; i < ms.length; i++) {
      const m = ms[i];
      const camD = Math.hypot(m.x - state.camera.position.x, 1.0 - state.camera.position.y, m.z - state.camera.position.z);
      const tp = ctrl.tour.phase;
      const clearSet = ctrl.preset === "tour" && (tp === "to_gate" || tp === "gate") && (m.phase === "fila" || m.phase === "validando" || m.phase === "llegando") && m.z > 7.5 && m.z < 14;
      // en el recorrido, nadie se cruza entre la cámara y la protagonista
      let blocks = false;
      if (ctrl.preset === "tour" && ctrl.tour.active && tp !== "form" && tp !== "phone" && tp !== "app" && tp !== "food" && tp !== "coach") {
        const cx = state.camera.position.x, cz = state.camera.position.z;
        const vx = ctrl.tour.x - cx, vz = ctrl.tour.z - cz;
        const L2 = vx * vx + vz * vz;
        if (L2 > 0.01) {
          const u = ((m.x - cx) * vx + (m.z - cz) * vz) / L2;
          if (u > 0 && u < 0.92) {
            const dx = cx + vx * u - m.x, dz = cz + vz * u - m.z;
            blocks = dx * dx + dz * dz < 0.75 * 0.75;
          }
        }
      }
      if (m.phase === "fuera" || (ctrl.preset === "tour" && camD < 2.7) || clearSet || blocks) {
        torso.current.setMatrixAt(i, ZERO);
        head.current.setMatrixAt(i, ZERO);
        legs.current.setMatrixAt(i * 2, ZERO);
        legs.current.setMatrixAt(i * 2 + 1, ZERO);
        arms.current.setMatrixAt(i * 2, ZERO);
        arms.current.setMatrixAt(i * 2 + 1, ZERO);
        shadow.current.setMatrixAt(i, ZERO);
        hit.current.setMatrixAt(i, ZERO);
        continue;
      }
      const P = pose(m.kind, m.anim, m.moving, m.phase);
      const st = m.station >= 0 ? sim.layout.stations[m.station] : null;
      let ox = 0;
      let oz = 0;
      if (m.phase === "entrenando" && st) {
        const lz = st.kind === "banco" ? 0.35 : st.kind === "bici" ? -0.3 : st.kind === "cajon" ? -0.1 : 0;
        ox = Math.sin(st.rot) * lz;
        oz = Math.cos(st.rot) * lz;
      }
      V_pos.set(m.x + ox, P.y, m.z + oz);
      E_rot.set(P.lean, m.h, 0, "YXZ");
      Q_rot.setFromEuler(E_rot);
      M_base.compose(V_pos, Q_rot, V_one);
      // torso
      M.copy(M_base);
      M_tmp.makeTranslation(0, 1.2, 0);
      M.multiply(M_tmp);
      M_tmp.makeScale(0.5, 0.64, 0.28);
      M.multiply(M_tmp);
      torso.current.setMatrixAt(i, M);
      M.copy(M_base);
      M_tmp.makeTranslation(0, 1.7, 0);
      M.multiply(M_tmp);
      M_tmp.makeScale(0.17, 0.19, 0.17);
      M.multiply(M_tmp);
      head.current.setMatrixAt(i, M);
      limb(M, M_base, -0.13, 0.9, P.legL[0], -P.legL[1], 0.86);
      M_tmp.makeScale(0.19, 0.86, 0.2);
      M.multiply(M_tmp);
      legs.current.setMatrixAt(i * 2, M);
      limb(M, M_base, 0.13, 0.9, P.legR[0], -P.legR[1], 0.86);
      M_tmp.makeScale(0.19, 0.86, 0.2);
      M.multiply(M_tmp);
      legs.current.setMatrixAt(i * 2 + 1, M);
      limb(M, M_base, -0.33, 1.47, P.armL[0], -P.armL[1], 0.62);
      M_tmp.makeScale(0.13, 0.62, 0.13);
      M.multiply(M_tmp);
      arms.current.setMatrixAt(i * 2, M);
      limb(M, M_base, 0.33, 1.47, P.armR[0], -P.armR[1], 0.62);
      M_tmp.makeScale(0.13, 0.62, 0.13);
      M.multiply(M_tmp);
      arms.current.setMatrixAt(i * 2 + 1, M);
      M.makeTranslation(m.x + ox, 0.02, m.z + oz);
      M.multiply(SHADOW_ROT);
      M_tmp.makeScale(0.55, 0.55, 1);
      M.multiply(M_tmp);
      shadow.current.setMatrixAt(i, M);
      M.makeTranslation(m.x + ox, 1.0, m.z + oz);
      M_tmp.makeScale(1.1, 2.0, 1.1);
      M.multiply(M_tmp);
      hit.current.setMatrixAt(i, M);
    }
    for (const r of [torso, head, legs, arms, shadow, hit]) r.current.instanceMatrix.needsUpdate = true;
    hit.current.boundingSphere = null;
    // Anillo de selección
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
      <instancedMesh ref={torso} args={[undefined, undefined, MAX_MEMBERS]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, MAX_MEMBERS]} frustumCulled={false}>
        <icosahedronGeometry args={[1, 1]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={legs} args={[undefined, undefined, MAX_MEMBERS * 2]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={arms} args={[undefined, undefined, MAX_MEMBERS * 2]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={shadow} args={[undefined, undefined, MAX_MEMBERS]} frustumCulled={false}>
        <circleGeometry args={[1, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
      <instancedMesh
        ref={hit}
        args={[undefined, undefined, MAX_MEMBERS]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onPick(e.instanceId);
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </instancedMesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.55, 0.72, 32]} />
        <meshBasicMaterial color="#A3E635" toneMapped={false} transparent opacity={0.95} />
      </mesh>
    </group>
  );
}

type Pop = { id: number; x: number; z: number; kind: string; title: string; detail: string; born: number };

function Popups({ sim, enabled, tour }: { sim: GemeloSim; enabled: boolean; tour: Tour }) {
  const [pops, setPops] = useState<Pop[]>([]);
  const lastId = useRef(0);
  const clock = useRef(0);
  const els = useRef<Map<number, HTMLDivElement>>(new Map());
  // en celular, máximo 2 globos a la vez (no tapan etiquetas ni tarjetas)
  const narrow = useThree((st) => st.size.width) < 768;
  useFrame((_, dt) => {
    clock.current += fdt(dt);
    const fresh = sim.events.filter((e) => e.id > lastId.current);
    if (fresh.length) {
      lastId.current = fresh[fresh.length - 1].id;
      // en el recorrido solo se ve lo de la protagonista (nada tapa el formulario ni el celular)
      const quiet = tour.active && tour.phase !== "to_gate" && tour.phase !== "gate" && tour.phase !== "enter" && tour.phase !== "training";
      if (enabled && !quiet) {
        const add = fresh.slice(narrow ? -1 : -3).map((e) => ({
          id: e.id,
          x: e.x,
          z: e.z,
          kind: e.kind,
          title: e.kind === "ok" ? "✔ Acceso concedido" : e.kind === "deny" ? "✕ Acceso denegado" : e.kind === "renew" ? `+ ${formatCOP(e.amount || 0)}` : e.kind === "sale" ? `+ ${formatCOP(e.amount || 0)}` : e.kind === "lost" ? "Dinero en riesgo" : "",
          detail: e.kind === "ok" || e.kind === "deny" ? `${e.name} · ${e.detail.split(" · ").slice(-2).join(" · ")}` : e.detail,
          born: clock.current,
        }));
        setPops((p) => [...p.filter((x) => clock.current - x.born < 2.6), ...add].slice(narrow ? -2 : -6));
      }
    }
    for (let pi = 0; pi < pops.length; pi++) {
      const p = pops[pi];
      const el = els.current.get(p.id);
      if (!el) continue;
      let stack = 0;
      for (let pj = pi + 1; pj < pops.length; pj++) {
        const q = pops[pj];
        if (Math.abs(q.x - p.x) < 4.5 && Math.abs(q.z - p.z) < 3 && clock.current - q.born < 2.5) stack++;
      }
      const age = clock.current - p.born;
      const o = age < 0.18 ? age / 0.18 : age > 2.0 ? Math.max(0, 1 - (age - 2.0) / 0.5) : 1;
      el.style.opacity = String(o);
      el.style.transform = `translate3d(-50%, ${-age * 14 - stack * 50 + (age < 0.18 ? (0.18 - age) * 60 : 0)}px, 0) scale(${0.9 + Math.min(age, 0.18) / 0.18 * 0.1})`;
    }
  });
  if (!enabled) return null;
  return (
    <>
      {pops.map((p) => (
        <Html key={p.id} position={[p.x, 2.6, p.z]} zIndexRange={[40, 10]} style={{ pointerEvents: "none" }}>
          <div
            ref={(el) => {
              if (el) els.current.set(p.id, el);
              else els.current.delete(p.id);
            }}
            className={`gm-pop gm-pop-${p.kind}`}
          >
            <div className="gm-pop-t">{p.title}</div>
            <div className="gm-pop-d">{p.detail}</div>
          </div>
        </Html>
      ))}
    </>
  );
}

/* ---------- Tarjeta que sigue al socio ---------- */

/** En celular la tarjeta se acopla abajo (bottom sheet sobre la barra de navegación) */
const DOCK_W = 768;
function dockPos(bottom: number) {
  return (_el: THREE.Object3D, _cam: THREE.Camera, size: { width: number; height: number }) => [size.width / 2, size.height - bottom];
}
function setCardFlag(k: string, on: boolean) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle(k, on);
}

function FollowCard({ sim, ctrl, onClose }: { sim: GemeloSim; ctrl: WorldCtrl; onClose: () => void }) {
  const g = useRef<THREE.Group>(null!);
  const [snap, setSnap] = useState<{ id: number; key: string } | null>(null);
  const acc = useRef(0);
  const width = useThree((st) => st.size.width);
  const docked = width < DOCK_W && !(typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search));
  useEffect(() => () => setCardFlag("gm-card-follow", false), []);
  useFrame((_, dt) => {
    const id = ctrl.selected;
    // nunca dos tarjetas: la de la protagonista del recorrido tiene prioridad
    const tourCard = ctrl.tour.active && (ctrl.tour.phase === "training" || ctrl.tour.phase === "enter");
    const m = id >= 0 && !tourCard ? sim.members[id] : null;
    setCardFlag("gm-card-follow", !!(m && m.phase !== "fuera"));
    if (m && m.phase !== "fuera") {
      g.current.visible = true;
      g.current.position.set(m.x, 2.35, m.z);
    } else g.current.visible = false;
    acc.current += fdt(dt);
    if (acc.current > 0.2) {
      acc.current = 0;
      const key = m ? `${id}|${m.phase}|${m.daysLeft}|${m.vencida}|${m.station}|${m.routine}` : "";
      if (!snap || snap.key !== key) setSnap(m && m.phase !== "fuera" ? { id, key } : null);
    }
  });
  const m = snap ? sim.members[snap.id] : null;
  return (
    <group ref={g}>
      {m && (
        <Html
          center={!docked}
          calculatePosition={docked ? (dockPos(ctrl.tour.active ? 168 : 84) as any) : undefined}
          zIndexRange={[75, 74]}
          style={{ pointerEvents: "auto" }}
        >
          <div className={`gm-card ${docked ? "gm-card-dock" : ""}`}>
            <div className="gm-card-h">
              <span className="gm-dot" style={{ background: m.shirt }} />
              <div>
                <div className="gm-card-n">{m.name}</div>
                <div className="gm-card-s">{phaseLabel(m, sim.layout)}</div>
              </div>
              <button className="gm-card-x" onClick={onClose} aria-label="Cerrar">×</button>
            </div>
            {m.phase !== "staff" && (
              <div className="gm-card-g">
                <div><span>Plan</span><b>{m.method === "PIN" ? "Invitación" : m.plan}</b></div>
                <div>
                  <span>Días restantes</span>
                  <b className={m.vencida ? "text-[#FF4D6D]" : m.daysLeft <= 5 ? "text-[#FFB02E]" : "text-[#22E0A1]"}>{m.method === "PIN" ? "1 ingreso" : m.vencida ? "Vencida" : m.daysLeft}</b>
                </div>
                <div className="col-span-2"><span>Rutina del día</span><b>{m.routine}</b></div>
                <div><span>Acceso</span><b>{m.method === "PIN" ? "Invitado · PIN" : "Facial"}</b></div>
                <div><span>Visitas</span><b>{m.method === "PIN" ? "Invitado" : `${12 + ((m.id * 7) % 30)} este mes`}</b></div>
              </div>
            )}
            {m.phase !== "staff" && (
              <a className="gm-card-link" href={m.socioId ? `/clientes?socio=${encodeURIComponent(m.socioId)}` : "/clientes"} target="_blank" rel="noopener">
                Ver en el panel →
              </a>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ---------- Etiquetas de zonas ---------- */

function ZoneLabels({ L }: { L: Layout }) {
  const items = [
    ...L.zones.filter((z) => z.zone !== "lobby").map((z) => ({ t: z.label, x: (z.x0 + z.x1) / 2, z: z.z0 + 0.8 })),
    { t: "Recepción · Caja", x: L.reception.x, z: L.reception.z - 0.2 },
    { t: "Torniquetes", x: 0, z: 6.7 },
  ];
  return (
    <>
      {items.map((it) => (
        <Html key={it.t} position={[it.x, 0.4, it.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="gm-label">{it.t}</div>
        </Html>
      ))}
    </>
  );
}

/* ---------- Cámara ---------- */

function presetFor(p: CamPreset, L: Layout, aspect: number): { pos: THREE.Vector3; tgt: THREE.Vector3 } {
  const m = L.mirror;
  const zc = (zone: string) => {
    const z = L.zones.find((zz) => zz.zone === zone)!;
    return new THREE.Vector3((z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2);
  };
  const portrait = aspect < 0.9;
  const k = aspect < 1.4 ? 1.12 : 1;
  let tgt: THREE.Vector3;
  let off: THREE.Vector3;
  switch (p) {
    case "entrada":
      tgt = new THREE.Vector3(0, 0.6, 9.2);
      off = portrait ? new THREE.Vector3(3 * m, 11, 15) : new THREE.Vector3(7 * m, 7.5, 11);
      break;
    case "pesas":
      tgt = zc("pesas").add(new THREE.Vector3(0, 0.5, -2));
      off = portrait ? new THREE.Vector3(-17 * m, 15, 3) : new THREE.Vector3(-5 * m, 10, 13);
      break;
    case "cardio":
      tgt = zc("cardio").add(new THREE.Vector3(0, 0.6, 0));
      off = portrait ? new THREE.Vector3(5 * m, 11, 14) : new THREE.Vector3(7 * m, 8, 10);
      break;
    case "funcional":
      tgt = zc("funcional").add(new THREE.Vector3(0, 0.5, 0));
      off = portrait ? new THREE.Vector3(15 * m, 13, 4) : new THREE.Vector3(9 * m, 8, 10);
      break;
    case "torniquete":
      tgt = new THREE.Vector3(0.2, 0.85, 8.1);
      off = portrait ? new THREE.Vector3(2.2, 1.35, 4.6) : new THREE.Vector3(2.9, 1.45, 4.4);
      return { pos: tgt.clone().add(off), tgt };
    case "recepcion":
      tgt = new THREE.Vector3(L.reception.x, 0.8, L.reception.z + 0.5);
      off = portrait ? new THREE.Vector3(-3 * m, 9, 12) : new THREE.Vector3(-4 * m, 6, 9);
      break;
    case "hero":
      tgt = new THREE.Vector3(0, 0, 0.5);
      off = portrait ? new THREE.Vector3(40, 50, 6) : new THREE.Vector3(24, 27, 31).multiplyScalar(k * 0.98);
      break;
    default:
      tgt = new THREE.Vector3(0, 0, portrait ? 1.5 : 0.5);
      off = portrait ? new THREE.Vector3(38, 46, 5) : new THREE.Vector3(22, 25, 29).multiplyScalar(k);
  }
  return { pos: tgt.clone().add(off), tgt };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function tourShot(tour: Tour, L: Layout, aspect: number): { pos: THREE.Vector3; tgt: THREE.Vector3; k: number } {
  const m = L.mirror;
  const portrait = aspect < 0.9;
  const P = new THREE.Vector3(tour.x, 0, tour.z);
  const g = L.gates[tour.gate];
  const ph = tour.phase;
  const pt = tour.phaseT;
  const panel = new THREE.Vector3(L.reception.x - 0.4 * m, 2.55, L.reception.z + 0.2);
  const panelN = new THREE.Vector3(Math.sin(-0.35 * m), 0, Math.cos(-0.35 * m));
  if (ph === "walk_in") {
    const left = tour.phaseDur - pt;
    if (left < 1.6) {
      // empuje hacia el panel de recepción
      const d = portrait ? 5.9 : 8.2;
      const pos = panel.clone().addScaledVector(panelN, d + left * 1.6).add(new THREE.Vector3(0, 0.2 + left * 0.5, 0));
      const tgt = panel.clone().lerp(P.clone().setY(1.2), Math.min(1, left / 1.6) * 0.6);
      return { pos, tgt, k: 2.4 };
    }
    const crane = Math.max(0, 2.4 - pt) * 1.4;
    const tgt = P.clone().add(new THREE.Vector3(-0.6 * m, 1.15, -0.4));
    const off = portrait ? new THREE.Vector3(-2.3 * m, 1.55 + crane, 4.6 + crane * 0.6) : new THREE.Vector3(-2.7 * m, 1.45 + crane, 3.9 + crane * 0.6);
    return { pos: P.clone().add(off), tgt, k: pt < 0.05 ? 50 : 3.2 };
  }
  if (ph === "form" || ph === "registered" || ph === "plan") {
    const d = portrait ? 5.7 : ph === "form" ? 8.1 : 7.2;
    const push = ph === "form" ? Math.max(0, 1 - pt / 7) * 0.5 : 0;
    const lift = portrait ? 0.42 : 0.36;
    const pos = panel.clone().addScaledVector(panelN, d + push).add(new THREE.Vector3(0, 0.05 + lift, 0));
    const tgt = panel.clone().add(new THREE.Vector3(0, lift, 0));
    if (!portrait) {
      tgt.x += 0.9 * m;
      pos.x += 0.9 * m;
    }
    return { pos, tgt, k: 2.6 };
  }
  if (ph === "phone" || ph === "enrolled") {
    const tgt = P.clone().add(new THREE.Vector3(0.05 * m, 1.32, -0.25));
    const pos = P.clone().add(portrait ? new THREE.Vector3(0.95 * m, 1.95, 1.7) : new THREE.Vector3(1.25 * m, 1.95, 2.1));
    if (ph === "enrolled" && pt > tour.phaseDur - 0.6) pos.add(new THREE.Vector3(0.6 * m, 0.4, 1.0));
    return { pos, tgt, k: ph === "phone" && pt < 1.0 ? 2.2 : 2.6 };
  }
  if (ph === "to_gate") {
    const tgt = new THREE.Vector3(P.x * 0.6 + g.x * 0.4, 1.0, P.z * 0.6 + (g.z + 0.4) * 0.4);
    const pos = portrait ? new THREE.Vector3(g.x + 2.3, 2.5, g.z + 6.0) : new THREE.Vector3(g.x + 2.8, 2.4, g.z + 6.2);
    return { pos, tgt, k: 2.0 };
  }
  if (ph === "gate") {
    const tgt = new THREE.Vector3(g.x + 0.28, 1.12, g.z + 0.45);
    const pos = portrait ? new THREE.Vector3(g.x + 1.55, 1.68, g.z + 2.3) : new THREE.Vector3(g.x + 1.8, 1.65, g.z + 2.5);
    return { pos, tgt, k: 2.4 };
  }
  if (ph === "enter") {
    // contraplano desde adentro: la ve cruzar el torniquete y la sigue con la mirada
    const tgt = P.clone().add(new THREE.Vector3(0, 1.0, 0)).lerp(new THREE.Vector3(g.x, 1.0, g.z), Math.max(0, 1 - pt / 1.2) * 0.5);
    const pos = portrait ? new THREE.Vector3(g.x + 0.9 * m, 1.65, g.z - 3.9) : new THREE.Vector3(g.x + 1.4 * m, 1.7, g.z - 4.4);
    return { pos, tgt, k: pt < 0.1 ? 50 : 3.0 };
  }
  // Parte 2 · Entrenamiento: celular de la socia, entreno y panel del entrenador con el mundo vivo detrás
  if (ph === "app" || ph === "food" || ph === "train" || ph === "coach") {
    const base = Math.atan2(1.6 * m, -3.6);
    if (ph === "app" || ph === "food") {
      const a = base + 0.35 * m + pt * 0.012;
      const r = portrait ? 2.5 : 2.9;
      const pos = P.clone().add(new THREE.Vector3(Math.sin(a) * r, 2.05, Math.cos(a) * r));
      return { pos, tgt: P.clone().add(new THREE.Vector3(0, portrait ? 1.75 : 1.35, 0)), k: pt < 0.05 ? 2.2 : 2.4 };
    }
    if (ph === "train") {
      const a = base - 0.25 * m + pt * 0.09 * m;
      const r = portrait ? 2.7 - pt * 0.04 : 3.1 - pt * 0.05;
      const pos = P.clone().add(new THREE.Vector3(Math.sin(a) * r, 1.55 + pt * 0.03, Math.cos(a) * r));
      return { pos, tgt: P.clone().add(new THREE.Vector3(0, portrait ? 1.35 : 1.1, 0)), k: 2.2 };
    }
    const a = base + 0.5 * m + pt * 0.035 * m;
    const r = portrait ? 7.5 : 8.5;
    const pos = P.clone().add(new THREE.Vector3(Math.sin(a) * r, portrait ? 4.6 : 4.0, Math.cos(a) * r));
    return { pos, tgt: P.clone().add(new THREE.Vector3(0, portrait ? 2.6 : 1.4, 0)), k: 1.6 };
  }
  // camino al equipo y entrenamiento
  const tgt = P.clone().add(new THREE.Vector3(0, portrait ? 1.7 : 1.2, 0));
  const pos = P.clone().add(portrait ? new THREE.Vector3(1.6 * m, 2.6, -3.6) : new THREE.Vector3(2.2 * m, 2.3, -3.6));
  return { pos, tgt, k: 2.0 };
}

function CameraRig({ sim, ctrl }: { sim: GemeloSim; ctrl: WorldCtrl }) {
  const { camera, size, gl } = useThree();
  const st = useRef({
    seq: -1,
    t: 1,
    dur: 1,
    fromP: new THREE.Vector3(),
    fromT: new THREE.Vector3(),
    curT: new THREE.Vector3(0, 0, 0.5),
    clock: 0,
    drag: { yaw: 0, pitch: 0 },
  });
  const dragRef = useRef({ pts: new Map<number, { x: number; y: number }>(), pinch: 0 });

  useEffect(() => {
    const el = gl.domElement;
    const d = dragRef.current;
    const can = () => ctrl.fullscreen || ctrl.explore;
    const down = (e: PointerEvent) => {
      if (!can()) return;
      d.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (d.pts.size === 2) {
        const [a, b] = [...d.pts.values()];
        d.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const move = (e: PointerEvent) => {
      const p = d.pts.get(e.pointerId);
      if (!p) return;
      if (d.pts.size >= 2) {
        p.x = e.clientX;
        p.y = e.clientY;
        const [a, b] = [...d.pts.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (d.pinch > 0) ctrl.zoom = Math.max(0.35, Math.min(2.2, ctrl.zoom * (d.pinch / Math.max(1, dist))));
        d.pinch = dist;
        return;
      }
      st.current.drag.yaw -= (e.clientX - p.x) * 0.005;
      st.current.drag.pitch = Math.max(-0.45, Math.min(0.6, st.current.drag.pitch + (e.clientY - p.y) * 0.003));
      p.x = e.clientX;
      p.y = e.clientY;
    };
    const up = (e: PointerEvent) => {
      d.pts.delete(e.pointerId);
      if (d.pts.size < 2) d.pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (!can()) return;
      e.preventDefault();
      ctrl.zoom = Math.max(0.35, Math.min(2.2, ctrl.zoom * Math.exp(e.deltaY * 0.0012)));
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, ctrl]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(fdt(dtRaw), 0.1);
    const s = st.current;
    s.clock += dt;
    const aspect = size.width / Math.max(1, size.height);
    const cam = camera as THREE.PerspectiveCamera;
    const wantFov = aspect < 0.9 ? 44 : 30;
    const wantNear = ctrl.preset === "tour" || ctrl.preset === "torniquete" ? 0.05 : 0.5;
    if (cam.fov !== wantFov || cam.near !== wantNear) {
      cam.fov = wantFov;
      cam.near = wantNear;
      cam.updateProjectionMatrix();
    }
    const tour = ctrl.tour;
    if (ctrl.preset === "tour" && !tour.active) ctrl.preset = "general";
    const followM = ctrl.follow >= 0 ? sim.members[ctrl.follow] : null;
    let damp = ctrl.preset === "follow" ? 4 : 6;
    const targetFor = (): { pos: THREE.Vector3; tgt: THREE.Vector3 } => {
      if (ctrl.preset === "tour" && tour.active) {
        const r = tourShot(tour, sim.layout, aspect);
        damp = r.k;
        return r;
      }
      if (ctrl.preset === "follow" && followM) {
        const portrait = aspect < 0.9;
        const tgt = new THREE.Vector3(followM.x, portrait ? 4.6 : 1.6, followM.z);
        const off = portrait ? new THREE.Vector3(3 * sim.layout.mirror, 8, 10.5) : new THREE.Vector3(6 * sim.layout.mirror, 7.5, 10.5);
        return { pos: tgt.clone().add(off), tgt };
      }
      return presetFor(ctrl.preset === "follow" || ctrl.preset === "tour" ? "general" : ctrl.preset, sim.layout, aspect);
    };
    if (ctrl.seq !== s.seq) {
      s.seq = ctrl.seq;
      s.fromP.copy(camera.position);
      s.fromT.copy(s.curT);
      s.t = 0;
      s.dur = Math.max(0.0001, ctrl.dur);
      s.drag.yaw = 0;
      s.drag.pitch = 0;
    }
    const goal = targetFor();
    // giro lento en modo hero / general
    if (ctrl.preset === "hero" || ctrl.preset === "general") {
      const ang = Math.sin(s.clock * 0.12) * 0.22 + s.drag.yaw;
      const off = goal.pos.clone().sub(goal.tgt);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      goal.pos.copy(goal.tgt).add(off);
    } else if (s.drag.yaw || s.drag.pitch) {
      const off = goal.pos.clone().sub(goal.tgt);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), s.drag.yaw);
      goal.pos.copy(goal.tgt).add(off);
    }
    if (s.drag.pitch) {
      const off = goal.pos.clone().sub(goal.tgt);
      const r = off.length();
      const el = Math.asin(Math.max(-1, Math.min(1, off.y / r)));
      const ne = Math.max(0.06, Math.min(1.45, el + s.drag.pitch));
      const hz = Math.hypot(off.x, off.z) || 1;
      off.x *= (Math.cos(ne) * r) / hz;
      off.z *= (Math.cos(ne) * r) / hz;
      off.y = Math.sin(ne) * r;
      goal.pos.copy(goal.tgt).add(off);
    }
    if (ctrl.zoom !== 1) goal.pos.sub(goal.tgt).multiplyScalar(ctrl.zoom).add(goal.tgt);
    if (s.t < 1) {
      s.t = Math.min(1, s.t + dt / s.dur);
      const e = ease(s.t);
      const p = s.fromP.clone().lerp(goal.pos, e);
      const lift = ctrl.preset === "tour" ? 0 : Math.sin(Math.PI * e) * s.fromP.distanceTo(goal.pos) * 0.12;
      p.y += lift;
      camera.position.copy(p);
      s.curT.copy(s.fromT).lerp(goal.tgt, e);
    } else {
      const k = 1 - Math.exp(-dt * damp);
      camera.position.lerp(goal.pos, k);
      s.curT.lerp(goal.tgt, k);
    }
    camera.lookAt(s.curT);
  });
  return null;
}

/* ---------- Tarjeta del protagonista ---------- */

function TourCard({ tour }: { tour: Tour }) {
  const g = useRef<THREE.Group>(null!);
  const el = useRef<HTMLDivElement>(null);
  const width = useThree((st) => st.size.width);
  const docked = width < DOCK_W && !(typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search));
  useEffect(() => () => setCardFlag("gm-card-tour-on", false), []);
  useFrame(() => {
    // después de la tarjeta de Accesos (nunca dos tarjetas a la vez)
    const on = tour.active && (tour.phase === "training" || (tour.phase === "enter" && tour.phaseT > 6.6));
    g.current.position.set(tour.x, 2.25, tour.z);
    if (el.current) el.current.style.display = on ? "" : "none";
    setCardFlag("gm-card-tour-on", on);
  });
  return (
    <group ref={g}>
      <Html
        center={!docked}
        calculatePosition={docked ? (dockPos(168) as any) : undefined}
        zIndexRange={[75, 74]}
        style={{ pointerEvents: "none" }}
      >
        <div ref={el} className={`gm-card gm-card-tour ${docked ? "gm-card-dock" : ""}`} style={{ display: "none" }}>
          <div className="gm-card-h">
            <span className="gm-dot" style={{ background: "#38BDF8" }} />
            <div>
              <div className="gm-card-n">{TOUR_PERSON.nombre}</div>
              <div className="gm-card-s">Socia nueva · primer entrenamiento</div>
            </div>
          </div>
          <div className="gm-card-g">
            <div><span>Plan</span><b>Mensual · $120.000</b></div>
            <div><span>Días restantes</span><b className="text-[#22E0A1]">30</b></div>
            <div className="col-span-2"><span>Rutina del día</span><b>{TOUR_PERSON.routine}</b></div>
            <div><span>Acceso</span><b>Facial ✓</b></div>
            <div><span>Visitas</span><b>1 este mes</b></div>
          </div>
        </div>
      </Html>
    </group>
  );
}

/* ---------- Captura determinista ---------- */

function CaptureHook() {
  const get = useThree((st) => st.get);
  useEffect(() => {
    // Modo captura: un render exacto por cuadro de video. El delta se fija contra
    // el cuadro anterior (los screenshots pueden disparar renders internos que
    // moverían el reloj de R3F).
    let last = -1;
    (window as any).__gemeloAdvance = (ms: number) => {
      const t = ms / 1000;
      (window as any).__gmFixedDt = last < 0 ? 1 / 30 : Math.max(0, Math.min(0.1, t - last));
      last = t;
      advance(t);
    };
    return () => {
      delete (window as any).__gemeloAdvance;
      delete (window as any).__gmFixedDt;
    };
  }, [get]);
  return null;
}

/* ---------- Driver de simulación + pausa ---------- */

function SimDriver({ sim, ctrl }: { sim: GemeloSim; ctrl: WorldCtrl }) {
  useFrame((_, dt) => {
    sim.step(Math.min(fdt(dt), 0.1));
    ctrl.tour.step(Math.min(fdt(dt), 0.1));
  }, -1);
  return null;
}

function Scene({ sim, ctrl, version, onPick, labels }: { sim: GemeloSim; ctrl: WorldCtrl; version: number; onPick: (id: number) => void; labels: boolean }) {
  const L = sim.layout;
  const phoneRef = useRef<THREE.Object3D | null>(null);
  return (
    <>
      <color attach="background" args={["#060a15"]} />
      <fog attach="fog" args={["#060a15", 70, 190]} />
      <hemisphereLight args={["#bcd7ff", "#1a1030", 1.15]} />
      <directionalLight position={[12, 24, 14]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-14, 10, -8]} intensity={0.5} color={L.accent2} />
      <SimDriver sim={sim} ctrl={ctrl} />
      <StudioEnv />
      <StaticWorld key={`s${version}`} L={L} />
      <Turnstiles key={`g${version}`} sim={sim} tour={ctrl.tour} />
      <Human tour={ctrl.tour} phoneRef={phoneRef} />
      <ClientesPanel3D sim={sim} tour={ctrl.tour} />
      <PhoneOverlay tour={ctrl.tour} anchor={phoneRef} />
      <TourCard tour={ctrl.tour} />
      <StatusToast tour={ctrl.tour} />
      <PhoneEntreno tour={ctrl.tour} />
      <CoachPanel tour={ctrl.tour} />
      <Members sim={sim} ctrl={ctrl} onPick={onPick} />
      {labels && <ZoneLabels key={`l${version}`} L={L} />}
      <Popups sim={sim} enabled={labels} tour={ctrl.tour} />
      <FollowCard sim={sim} ctrl={ctrl} onClose={() => onPick(-1)} />
      <CameraRig sim={sim} ctrl={ctrl} />
    </>
  );
}

export default function World3D({
  sim,
  ctrl,
  version,
  active,
  labels,
  capture,
  onPick,
  onBackgroundClick,
}: {
  sim: GemeloSim;
  ctrl: WorldCtrl;
  version: number;
  active: boolean;
  labels: boolean;
  capture?: boolean;
  onPick: (id: number) => void;
  onBackgroundClick?: () => void;
}) {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const d = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    setDpr(capture ? Math.min(2, d) : Math.min(1.5, d));
  }, [capture]);
  return (
    <Canvas
      dpr={dpr}
      frameloop={capture ? "never" : active ? "always" : "never"}
      camera={{ fov: 30, near: 0.5, far: 200, position: [24, 27, 31] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      gl={{ antialias: !capture, powerPreference: "high-performance", alpha: false, stencil: false }}
      style={{ touchAction: ctrl.fullscreen || ctrl.explore ? "none" : "pan-y" }}
      onPointerMissed={() => onBackgroundClick?.()}
    >
      {capture && <CaptureHook />}
      <Scene sim={sim} ctrl={ctrl} version={version} onPick={onPick} labels={labels} />
    </Canvas>
  );
}
