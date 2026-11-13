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
import { Html, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { formatCOP, phaseLabel, type GemeloSim, type Layout, type StationKind } from "../../lib/gemelo/sim";
import type { WorldCtrl, CamPreset } from "../../lib/gemelo/ctrl";
import type { Tour } from "../../lib/gemelo/tour";
import { TOUR_PERSON, fridgeSpot, pinStand } from "../../lib/gemelo/tour";
import { StudioEnv, Turnstiles } from "./Turnstiles";
import { Human } from "./Human";
import { Crowd } from "./Crowd";
import { ClientesPanel3D, PhoneOverlay, StatusToast } from "./TourPanels";
import { CoachPanel, PhoneEntreno } from "./TourPanels2";
import { Fridge, Cashier, SaleBottle } from "./Caja3D";
import { CajaPanel } from "./TourPanels3";
import { PhoneAviso, MembresiaPanel } from "./TourPanels4";
import { Guests3D, PhoneInv, IngresoPanel } from "./TourPanels5";
import { Owner3D, AerialCounters, OwnerPanel, OwnerPhone } from "./TourPanels6";

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
        // cinta de correr: plataforma, banda, capó del motor, parales, pasamanos y consola
        LB(0, 0.12, 0.05, 0.86, 0.16, 1.95, "#1b2440");
        LB(0, 0.205, 0, 0.62, 0.02, 1.7, "#05070d");
        LB(-0.37, 0.215, 0, 0.1, 0.03, 1.7, "#334155");
        LB(0.37, 0.215, 0, 0.1, 0.03, 1.7, "#334155");
        LB(0, 0.24, 0.92, 0.86, 0.26, 0.32, "#263354");
        LB(-0.38, 0.78, 1.0, 0.06, 1.1, 0.08, "#475569");
        LB(0.38, 0.78, 1.0, 0.06, 1.1, 0.08, "#475569");
        LB(-0.38, 1.12, 0.74, 0.05, 0.05, 0.52, "#94a3b8");
        LB(0.38, 1.12, 0.74, 0.05, 0.05, 0.52, "#94a3b8");
        LB(0, 1.34, 1.02, 0.8, 0.28, 0.12, "#1e293b");
        LG(0, 1.36, 0.955, 0.5, 0.16, 0.02, L.accent2);
        break;
      case "bici":
        // bicicleta estática: base, volante de inercia, sillín, manubrio y consola
        LB(0, 0.04, -0.45, 0.6, 0.06, 0.08, "#1f2937");
        LB(0, 0.04, 0.55, 0.6, 0.06, 0.08, "#1f2937");
        LB(0, 0.2, 0.05, 0.1, 0.1, 1.05, "#334155");
        LC(0, 0.45, 0.5, 0.25, 0.07, "x", "#475569");
        LC(0, 0.42, 0.12, 0.07, 0.2, "x", "#94a3b8");
        LB(0, 0.55, -0.3, 0.06, 0.55, 0.06, "#475569");
        LB(0, 0.82, -0.3, 0.18, 0.06, 0.3, "#0f172a");
        LB(0, 0.8, 0.45, 0.06, 0.62, 0.06, "#475569");
        LB(0, 1.13, 0.49, 0.56, 0.04, 0.06, "#94a3b8");
        LG(0, 1.2, 0.53, 0.22, 0.12, 0.02, L.accent2);
        break;
      case "banco":
        // banco plano con parales y ganchos (la barra la pone cada socio)
        LB(0, 0.27, 0.05, 0.34, 0.08, 1.25, "#1e293b");
        LB(0, 0.13, 0.05, 0.12, 0.2, 1.1, "#475569");
        LB(0, 0.03, 0.55, 0.5, 0.06, 0.08, "#334155");
        LB(0, 0.03, -0.45, 0.5, 0.06, 0.08, "#334155");
        LB(0, 0.03, -0.62, 1.2, 0.05, 0.25, "#334155");
        LB(-0.55, 0.6, -0.62, 0.07, 1.2, 0.07, "#475569");
        LB(0.55, 0.6, -0.62, 0.07, 1.2, 0.07, "#475569");
        LB(-0.55, 1.0, -0.58, 0.09, 0.05, 0.1, "#94a3b8");
        LB(0.55, 1.0, -0.58, 0.09, 0.05, 0.1, "#94a3b8");
        break;
      case "rack":
        // power rack sobre plataforma de madera, ganchos, barras de seguridad y discos guardados
        LB(0, 0.02, 0, 1.9, 0.04, 1.6, "#3b2a1a");
        for (const [lx, lz] of [[-0.75, -0.5], [0.75, -0.5], [-0.75, 0.5], [0.75, 0.5]] as const)
          LB(lx, 1.17, lz, 0.08, 2.3, 0.08, "#475569");
        LB(0, 2.3, -0.5, 1.58, 0.07, 0.07, "#334155");
        LB(0, 2.3, 0.5, 1.58, 0.07, 0.07, "#334155");
        LB(-0.75, 2.3, 0, 0.07, 0.07, 1.07, "#334155");
        LB(0.75, 2.3, 0, 0.07, 0.07, 1.07, "#334155");
        LG(0, 2.36, 0, 1.6, 0.02, 0.04, L.accent);
        LB(-0.75, 0.85, 0, 0.05, 0.05, 1.1, "#94a3b8");
        LB(0.75, 0.85, 0, 0.05, 0.05, 1.1, "#94a3b8");
        LB(-0.75, 1.38, -0.12, 0.1, 0.05, 0.1, "#94a3b8");
        LB(0.75, 1.38, -0.12, 0.1, 0.05, 0.1, "#94a3b8");
        for (const sx of [-1, 1]) {
          LC(sx * 0.86, 0.3, -0.62, 0.22, 0.05, "x", "#111827");
          LC(sx * 0.92, 0.3, -0.62, 0.22, 0.05, "x", "#111827");
          LC(sx * 0.98, 0.25, -0.62, 0.16, 0.04, "x", "#1d4ed8");
        }
        break;
      case "polea":
        // jalón al pecho: columna, pila de pesas, viga con polea, asiento y rodillo de rodillas
        LB(0, 0.03, 0.3, 0.62, 0.05, 1.1, "#334155");
        LB(0, 1.1, 0.64, 0.5, 2.2, 0.1, "#334155");
        LB(0, 0.46, 0.57, 0.32, 0.72, 0.2, "#111827");
        LB(-0.13, 1.1, 0.57, 0.03, 2.0, 0.03, "#94a3b8");
        LB(0.13, 1.1, 0.57, 0.03, 2.0, 0.03, "#94a3b8");
        LB(0, 2.38, 0.42, 0.14, 0.1, 0.5, "#475569");
        LC(0, 2.38, 0.24, 0.06, 0.05, "x", "#94a3b8");
        LG(0, 2.0, 0.695, 0.4, 0.03, 0.02, L.accent);
        LB(0, 0.24, 0, 0.08, 0.42, 0.08, "#475569");
        LB(0, 0.46, 0, 0.42, 0.08, 0.4, "#1e293b");
        LB(0, 0.6, 0.3, 0.06, 0.2, 0.06, "#475569");
        LC(0, 0.7, 0.3, 0.06, 0.5, "x", "#1e293b");
        break;
      case "mancuernas":
        // soporte de dos niveles con pares de mancuernas
        LB(-0.68, 0.42, 0.88, 0.06, 0.84, 0.46, "#334155");
        LB(0.68, 0.42, 0.88, 0.06, 0.84, 0.46, "#334155");
        LB(0, 0.42, 0.82, 1.4, 0.05, 0.36, "#1f2937");
        LB(0, 0.74, 0.96, 1.4, 0.05, 0.28, "#1f2937");
        for (let i = 0; i < 6; i++) {
          const x = -0.55 + i * 0.22;
          LC(x, 0.5, 0.82, 0.05 + i * 0.005, 0.26, "z", "#111827");
          LC(x, 0.81, 0.96, 0.04 + i * 0.004, 0.2, "z", "#1f2937");
        }
        break;
      case "kettle":
        LB(0, 0.015, 0.1, 1.2, 0.03, 1.3, "#1e3a5f");
        LB(0, 0.24, -0.78, 0.9, 0.05, 0.32, "#334155");
        LB(-0.42, 0.12, -0.78, 0.05, 0.24, 0.3, "#475569");
        LB(0.42, 0.12, -0.78, 0.05, 0.24, 0.3, "#475569");
        for (const x of [-0.28, 0, 0.28]) LC(x, 0.34, -0.78, 0.085, 0.15, "y", "#111827");
        break;
      case "tapete":
        LB(0, 0.015, 0, 0.75, 0.03, 1.8, "#1e3a5f");
        LC(0.5, 0.09, 0.75, 0.08, 0.5, "x", "#f59e0b");
        break;
      case "cajon":
        LB(0, 0.015, 0.25, 1.2, 0.03, 1.7, "#1e3a5f");
        LB(0, 0.3, 0.75, 0.75, 0.6, 0.75, "#7c2d12");
        LB(0, 0.605, 0.75, 0.7, 0.012, 0.7, "#9a3412");
        LG(0, 0.612, 0.75, 0.76, 0.01, 0.04, "#fb923c");
        break;
      case "cuerdas":
        LB(0, 0.015, 1.3, 1.3, 0.03, 3.0, "#1e3a5f");
        LB(0, 0.28, 2.65, 0.26, 0.56, 0.26, "#334155");
        LC(0, 0.22, 2.5, 0.06, 0.04, "z", "#94a3b8");
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
          title: e.kind === "ok" ? "✔ Entrada autorizada" : e.kind === "deny" ? "✕ Acceso rechazado" : e.kind === "renew" ? `+ ${formatCOP(e.amount || 0)}` : e.kind === "sale" ? `+ ${formatCOP(e.amount || 0)}` : e.kind === "lost" ? "Plan vencido" : "",
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
/** Segundos que se lee la tarjeta de un socio antes de desvanecerse. */
const CARD_SECS = 4.5;
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
  const card = useRef<HTMLDivElement>(null);
  const shown = useRef({ id: -1, seq: -1, age: 0 });
  const width = useThree((st) => st.size.width);
  const docked = width < DOCK_W && !(typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search));
  useEffect(() => () => setCardFlag("gm-card-follow", false), []);
  useFrame((_, dt) => {
    const id0 = ctrl.selected;
    // la tarjeta se lee unos segundos y se desvanece (vuelve al tocar de nuevo a la persona)
    const seq = (ctrl as any).pickSeq || 0;
    const sh = shown.current;
    if (id0 !== sh.id || seq !== sh.seq) {
      sh.id = id0;
      sh.seq = seq;
      sh.age = 0;
    } else sh.age += fdt(dt);
    const fade = sh.age < CARD_SECS ? 1 : Math.max(0, 1 - (sh.age - CARD_SECS) / 0.6);
    if (card.current) card.current.style.opacity = String(fade);
    const id = fade > 0 ? id0 : -1;
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
          <div ref={card} className={`gm-card ${docked ? "gm-card-dock" : ""}`} style={{ transition: "opacity .25s linear" }}>
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
  if (tour.chapter === 6) {
    // Parte 6: grúa desde el dueño hasta la vista aérea; panel en recepción; celular del dueño
    const F = tour.focus;
    const Q = new THREE.Vector3(F.x, 0, F.z);
    const air = presetFor("general", L, aspect);
    if (ph === "own_aerial" || ph === "own_end") {
      const close = { pos: Q.clone().add(new THREE.Vector3(1.4 * m, 2.2, 3.2)), tgt: Q.clone().add(new THREE.Vector3(0, 1.3, 0)) };
      const u = ph === "own_end" ? 1 : ease(Math.min(1, Math.max(0, (pt - 0.8) / 5.5)));
      return { pos: close.pos.clone().lerp(air.pos, u), tgt: close.tgt.clone().lerp(air.tgt, u), k: pt < 0.05 && ph === "own_aerial" ? 50 : 3.0 };
    }
    if (ph === "own_phone") {
      const tgt = Q.clone().add(new THREE.Vector3(0.05 * m, 1.32, -0.25));
      const pos = Q.clone().add(portrait ? new THREE.Vector3(0.95 * m, 1.95, 1.7) : new THREE.Vector3(1.25 * m, 1.95, 2.1));
      return { pos, tgt, k: 2.2 };
    }
    const tt = tour.t;
    const pos = panel.clone().addScaledVector(panelN, portrait ? 7.4 : 9.4).add(new THREE.Vector3(Math.sin(tt * 0.05) * 1.4 * m, portrait ? 1.6 : 1.1, 0));
    const tgt = panel.clone().add(new THREE.Vector3(portrait ? 0 : -1.6 * m, portrait ? 1.2 : 0.2, 0));
    return { pos, tgt, k: 1.4 };
  }
  if (tour.chapter === 5) {
    // Parte 5: la cámara sigue a quien actúa (Valentina, Ana o Camilo)
    const F = tour.focus;
    const Q = new THREE.Vector3(F.x, 0, F.z);
    const g2 = L.gates[tour.gate2];
    const S = pinStand(L);
    if (ph === "invite" || ph === "invite2" || ph === "guest_enroll" || (ph === "ledger" && pt < 4.6)) {
      const tgt = Q.clone().add(new THREE.Vector3(0.05 * m, 1.32, -0.25));
      const pos = Q.clone().add(portrait ? new THREE.Vector3(0.95 * m, 1.95, 1.7) : new THREE.Vector3(1.25 * m, 1.95, 2.1));
      return { pos, tgt, k: pt < 0.05 ? 50 : 2.4 };
    }
    if (ph === "ana_gate") {
      const tgt = new THREE.Vector3(Q.x * 0.6 + g.x * 0.4, 1.0, Q.z * 0.6 + (g.z + 0.4) * 0.4);
      const pos = portrait ? new THREE.Vector3(g.x + 2.3, 2.5, g.z + 6.0) : new THREE.Vector3(g.x + 2.8, 2.4, g.z + 6.2);
      return { pos, tgt, k: 2.0 };
    }
    if (ph === "gate_g") {
      const tgt = new THREE.Vector3(g.x + 0.28, 1.12, g.z + 0.45);
      const pos = portrait ? new THREE.Vector3(g.x + 1.55, 1.68, g.z + 2.3) : new THREE.Vector3(g.x + 1.8, 1.65, g.z + 2.5);
      return { pos, tgt, k: 2.4 };
    }
    if (ph === "ana_in") {
      const tgt = Q.clone().add(new THREE.Vector3(0, 1.0, 0));
      const pos = portrait ? new THREE.Vector3(g.x + 0.9 * m, 1.65, g.z - 3.9) : new THREE.Vector3(g.x + 1.4 * m, 1.7, g.z - 4.4);
      return { pos, tgt, k: pt < 0.1 ? 50 : 3.0 };
    }
    if (ph === "camilo_in") {
      // contraplano desde adentro: lo ve cruzar el torniquete que abrió el PIN
      const tgt = Q.clone().add(new THREE.Vector3(0, 1.0, 0)).lerp(new THREE.Vector3(g2.x, 1.0, g2.z), Math.max(0, 1 - pt / 1.4) * 0.5);
      const pos = portrait ? new THREE.Vector3(g2.x - 0.9 * m, 1.65, g2.z - 3.9) : new THREE.Vector3(g2.x - 1.3 * m, 1.7, g2.z - 4.4);
      return { pos, tgt, k: pt < 0.1 ? 50 : 3.0 };
    }
    if (ph === "to_pin") {
      // por encima y detrás de Camilo (lado de la calle), sin que nadie lo tape
      const tgt = Q.clone().add(new THREE.Vector3(0, 1.0, -1.0));
      const pos = Q.clone().add(new THREE.Vector3(0.5, portrait ? 3.4 : 3.1, portrait ? 5.0 : 4.6));
      return { pos, tgt, k: 2.0 };
    }
    if (ph === "pin") {
      const tgt = new THREE.Vector3(S.x, 1.15, S.z);
      const pos = new THREE.Vector3(S.x + 0.6, portrait ? 2.9 : 2.6, S.z + (portrait ? 4.0 : 3.6));
      return { pos, tgt, k: 2.0 };
    }
    // registro en recepción y cierre: plano de recepción
    const tt = tour.t;
    const pos = panel.clone().addScaledVector(panelN, portrait ? 7.4 : 9.4).add(new THREE.Vector3(Math.sin(tt * 0.05) * 1.4 * m, portrait ? 1.6 : 1.1, 0));
    const tgt = panel.clone().add(new THREE.Vector3(portrait ? 0 : -1.6 * m, portrait ? 1.2 : 0.2, 0));
    return { pos, tgt, k: 1.4 };
  }
  if (ph === "walk_in" || ph === "to_desk") {
    const left = tour.phaseDur - pt;
    if (left < 1.6 && ph === "walk_in") {
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
  if (ph === "to_fridge" || ph === "to_counter" || ph === "to_recep") {
    // Parte 3: sigue a Valentina hacia la nevera y de vuelta a la caja
    const tgt = P.clone().add(new THREE.Vector3(0, 1.15, -0.3));
    const off = portrait ? new THREE.Vector3(1.2 * m, 2.5, 4.4) : new THREE.Vector3(1.4 * m, 2.35, 3.9);
    if (ph === "to_counter" || ph === "to_recep") off.set((portrait ? 1.6 : 2.0) * m, 2.9, portrait ? 3.8 : 3.2);
    if (ph === "to_fridge") off.add(new THREE.Vector3(0, Math.max(0, 2.4 - pt) * 1.4, Math.max(0, 2.4 - pt) * 0.8));
    return { pos: P.clone().add(off), tgt, k: ph === "to_fridge" && pt < 0.05 ? 50 : 3.0 };
  }
  if (ph === "fridge") {
    const fr = fridgeSpot(L);
    // de lado (lado opuesto a la bisagra) para ver la puerta abrirse y la mano tomar la botella
    const tgt = new THREE.Vector3(fr.x + 0.3 * m, 1.25, fr.front + 0.2);
    const pos = portrait ? new THREE.Vector3(fr.x - 1.0 * m, 1.8, fr.front + 3.6) : new THREE.Vector3(fr.x - 1.5 * m, 1.75, fr.front + 3.1);
    return { pos, tgt, k: 2.2 };
  }
  if (ph === "scan") {
    const cx = L.reception.x + 1.0 * m;
    const tgt = new THREE.Vector3(cx - 0.15 * m, 1.3, L.reception.z + 0.2);
    const pos = portrait ? new THREE.Vector3(cx + 1.5 * m, 2.0, L.reception.z + 3.1) : new THREE.Vector3(cx + 1.9 * m, 1.85, L.reception.z + 2.5);
    return { pos, tgt, k: 2.4 };
  }
  if (ph === "accesos" || ph === "renew" || ph === "pos" || ph === "fact" || ph === "cliente" || ph === "items" || ph === "files" || ph === "dian" || ph === "stock" || ph === "order" || ph === "close" || ph === "desk_end") {
    // Parte 3: plano de recepción con deriva lenta; el panel de caja va en pantalla
    const tt = tour.t;
    const pos = panel.clone().addScaledVector(panelN, portrait ? 7.4 : 9.4).add(new THREE.Vector3(Math.sin(tt * 0.05) * 1.4 * m, portrait ? 1.6 : 1.1, 0));
    const tgt = panel.clone().add(new THREE.Vector3(portrait ? 0 : -1.6 * m, portrait ? 1.2 : 0.2, 0));
    return { pos, tgt, k: 1.4 };
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
  if (ph === "phone" || ph === "enrolled" || ph === "aviso" || ph === "login" || ph === "wompi") {
    const tgt = P.clone().add(new THREE.Vector3(0.05 * m, 1.32, -0.25));
    const pos = P.clone().add(portrait ? new THREE.Vector3(0.95 * m, 1.95, 1.7) : new THREE.Vector3(1.25 * m, 1.95, 2.1));
    if (ph === "enrolled" && pt > tour.phaseDur - 0.6) pos.add(new THREE.Vector3(0.6 * m, 0.4, 1.0));
    return { pos, tgt, k: ph === "phone" && pt < 1.0 ? 2.2 : 2.6 };
  }
  if (ph === "to_gate" || ph === "back_gate") {
    const tgt = new THREE.Vector3(P.x * 0.6 + g.x * 0.4, 1.0, P.z * 0.6 + (g.z + 0.4) * 0.4);
    const pos = portrait ? new THREE.Vector3(g.x + 2.3, 2.5, g.z + 6.0) : new THREE.Vector3(g.x + 2.8, 2.4, g.z + 6.2);
    return { pos, tgt, k: 2.0 };
  }
  if (ph === "gate" || ph === "gate_deny") {
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
  const sub = useRef<HTMLDivElement>(null);
  const days = useRef<HTMLElement>(null);
  const visits = useRef<HTMLElement>(null);
  const width = useThree((st) => st.size.width);
  const docked = width < DOCK_W && !(typeof window !== "undefined" && /[?&]ad=1/.test(window.location.search));
  const age = useRef(-1);
  useEffect(() => () => setCardFlag("gm-card-tour-on", false), []);
  useFrame((_, dt) => {
    // después de la tarjeta de Accesos (nunca dos tarjetas a la vez); se lee ~4,5 s y se desvanece
    const want = tour.active && (tour.phase === "training" || (tour.phase === "enter" && tour.phaseT > 6.6));
    if (!want) age.current = -1;
    else age.current = age.current < 0 ? 0 : age.current + fdt(dt);
    const fade = !want ? 0 : age.current < CARD_SECS ? 1 : Math.max(0, 1 - (age.current - CARD_SECS) / 0.6);
    const on = fade > 0;
    g.current.position.set(tour.x, 2.25, tour.z);
    if (el.current) {
      el.current.style.display = on ? "" : "none";
      el.current.style.opacity = String(fade);
    }
    setCardFlag("gm-card-tour-on", on);
    if (on && sub.current && days.current && visits.current) {
      const ch4 = tour.chapter === 4;
      sub.current.textContent = ch4 ? "Renovó en la app con Wompi · de vuelta a entrenar" : "Socia nueva · primer entrenamiento";
      days.current.textContent = ch4 ? "29" : "30";
      visits.current.textContent = ch4 ? "Hoy, tras pagar en la app" : "1 este mes";
    }
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
              <div ref={sub} className="gm-card-s">Socia nueva · primer entrenamiento</div>
            </div>
          </div>
          <div className="gm-card-g">
            <div><span>Plan</span><b>Mensual · $120.000</b></div>
            <div><span>Días restantes</span><b ref={days} className="text-[#22E0A1]">30</b></div>
            <div className="col-span-2"><span>Rutina del día</span><b>{TOUR_PERSON.routine}</b></div>
            <div><span>Acceso</span><b>Facial ✓</b></div>
            <div><span>Visitas</span><b ref={visits}>1 este mes</b></div>
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
  const valeHand = useRef<THREE.Object3D | null>(null);
  const cashHand = useRef<THREE.Object3D | null>(null);
  const scanTip = useRef<THREE.Object3D | null>(null);
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
      <Human tour={ctrl.tour} phoneRef={phoneRef} handRef={valeHand} />
      <Fridge key={`f${version}`} L={L} tour={ctrl.tour} />
      <Cashier key={`c${version}`} L={L} tour={ctrl.tour} handRef={cashHand} tipRef={scanTip} />
      <SaleBottle key={`b${version}`} L={L} tour={ctrl.tour} valeHand={valeHand} cashHand={cashHand} tip={scanTip} />
      <ClientesPanel3D sim={sim} tour={ctrl.tour} />
      <PhoneOverlay tour={ctrl.tour} anchor={phoneRef} />
      <TourCard tour={ctrl.tour} />
      <StatusToast tour={ctrl.tour} />
      <PhoneEntreno tour={ctrl.tour} />
      <CoachPanel tour={ctrl.tour} />
      <CajaPanel tour={ctrl.tour} />
      <PhoneAviso tour={ctrl.tour} />
      <MembresiaPanel tour={ctrl.tour} />
      <Guests3D key={`v${version}`} L={L} tour={ctrl.tour} />
      <PhoneInv tour={ctrl.tour} />
      <IngresoPanel tour={ctrl.tour} />
      <Owner3D tour={ctrl.tour} />
      <AerialCounters key={`o${version}`} L={L} tour={ctrl.tour} />
      <OwnerPanel tour={ctrl.tour} />
      <OwnerPhone tour={ctrl.tour} />
      <Crowd key={`m${version}`} sim={sim} ctrl={ctrl} onPick={onPick} />
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
      {!capture && <PerformanceMonitor onDecline={() => setDpr(1)} />}
      {capture && <CaptureHook />}
      <Scene sim={sim} ctrl={ctrl} version={version} onPick={onPick} labels={labels} />
    </Canvas>
  );
}
