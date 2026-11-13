"use client";

/**
 * Parte 3 · venta real en recepción (3D):
 *  - Nevera de bebidas con puertas de vidrio e iluminación LED, llena de botellas instanciadas. Solo bebidas del
 *    catálogo de ejemplo (lib/retailCatalog.ts): Agua 600 ml, Bebida isotónica 600 ml (varios sabores/colores) y
 *    Bebida energética, con su precio en la cenefa.
 *  - Cajera en recepción con pistola lectora de códigos: toma la bebida que Valentina deja en el mostrador, la
 *    escanea (láser rojo y "bip") y la vuelve a dejar; el punto de venta (TourPanels3) agrega ese mismo producto.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { fridgeSpot, type Tour } from "../../lib/gemelo/tour";
import type { Layout } from "../../lib/gemelo/sim";
import { FR, SC, ss, bottleAt, cop, FRIDGE_ITEMS, SALE_ITEM } from "../../lib/gemelo/sale";

const W = 1.4;
const H = 2.0;
const D = 0.75;
const SHELF_Y = [0.2, 0.56, 0.92, 1.29, 1.66];
const COLS = 14;
const ISO_COLORS = ["#f97316", "#2563eb", "#dc2626", "#84cc16", "#7c3aed"];
const PICK_COLOR = "#f97316";

function label(text: string, w: number, h: number, bg: string, fg: string, font: string) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, w / 2, h / 2 + 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

type Slot = { x: number; y: number; z: number; kind: "agua" | "iso" | "ene"; color: string };

export function Fridge({ L, tour }: { L: Layout; tour: Tour }) {
  const m = L.mirror;
  const sp = fridgeSpot(L);
  const doorB = useRef<THREE.Group>(null!);
  const colored = useRef<THREE.InstancedMesh>(null!);
  const lastHidden = useRef(false);
  const { slots, pickIdx } = useMemo(() => {
    const out: Slot[] = [];
    const kinds: Slot["kind"][] = ["agua", "ene", "iso", "iso", "agua"];
    SHELF_Y.forEach((y, si) => {
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < 3; r++) {
          const x = (-0.6 + (c * 1.2) / (COLS - 1)) * m;
          const z = 0.27 - r * 0.12;
          const k = kinds[si];
          out.push({ x, y, z, kind: k, color: k === "iso" ? ISO_COLORS[Math.floor(c / 3) % ISO_COLORS.length] : k === "ene" ? (c % 2 ? "#0f172a" : "#166534") : "#cfe8ff" });
        }
      }
    });
    // la botella que toma Valentina: isotónica de naranja, fila de adelante, frente a su mano derecha
    const handX = sp.standX - 0.2 - sp.x;
    let best = -1;
    let bd = 1e9;
    out.forEach((s, i) => {
      if (s.kind !== "iso" || s.y !== SHELF_Y[3] || s.z !== 0.27 || s.color !== PICK_COLOR) return;
      const d = Math.abs(s.x - handX);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return { slots: out, pickIdx: best };
  }, [m, sp.standX, sp.x]);
  const colIdx = useMemo(() => slots.map((s, i) => (s.kind !== "agua" ? i : -1)).filter((i) => i >= 0), [slots]);
  const waterIdx = useMemo(() => slots.map((s, i) => (s.kind === "agua" ? i : -1)).filter((i) => i >= 0), [slots]);
  const geo = useMemo(
    () => ({
      bottle: new THREE.CylinderGeometry(0.031, 0.033, 0.17, 10).translate(0, 0.085, 0),
      neck: new THREE.CylinderGeometry(0.014, 0.03, 0.045, 10).translate(0, 0.192, 0),
      cap: new THREE.CylinderGeometry(0.016, 0.016, 0.022, 8).translate(0, 0.225, 0),
      can: new THREE.CylinderGeometry(0.029, 0.029, 0.17, 10).translate(0, 0.085, 0),
    }),
    [],
  );
  const mat = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: "#1b2333", roughness: 0.45, metalness: 0.6 }),
      inner: new THREE.MeshStandardMaterial({ color: "#e8f1ff", emissive: "#cfe3ff", emissiveIntensity: 0.85, roughness: 0.6 }),
      led: new THREE.MeshBasicMaterial({ color: "#f0f9ff" }),
      shelf: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.75 }),
      glass: new THREE.MeshStandardMaterial({ color: "#bfe3ff", roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.14, depthWrite: false }),
      frame: new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.3, metalness: 0.9 }),
      water: new THREE.MeshStandardMaterial({ color: "#dbeafe", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.72 }),
      colored: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, metalness: 0.05, emissive: "#111827", emissiveIntensity: 0.2 }),
      cap: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }),
      sign: new THREE.MeshBasicMaterial({ map: typeof document !== "undefined" ? label("BEBIDAS FRÍAS", 512, 80, "#0b1222", "#7dd3fc", "bold 46px Arial") : null }),
      strips: [FRIDGE_ITEMS.agua, FRIDGE_ITEMS.energetica, FRIDGE_ITEMS.isotonica, FRIDGE_ITEMS.isotonica, FRIDGE_ITEMS.agua].map(
        (p) => new THREE.MeshBasicMaterial({ map: typeof document !== "undefined" ? label(`${p.name}   ${cop(p.price)}`, 1024, 40, "#f8fafc", "#0f172a", "bold 26px Arial") : null }),
      ),
    }),
    [],
  );
  const setInst = (mesh: THREE.InstancedMesh | null, idx: number[], hideI = -1) => {
    if (!mesh) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    idx.forEach((si, k) => {
      const s = slots[si];
      o.position.set(s.x, s.y + 0.012, s.z);
      o.scale.setScalar(si === hideI ? 0 : 1);
      o.updateMatrix();
      mesh.setMatrixAt(k, o.matrix);
      mesh.setColorAt(k, col.set(s.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const initWater = (mesh: THREE.InstancedMesh | null) => {
    if (mesh) setInst(mesh, waterIdx);
  };
  const initCol = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    colored.current = mesh;
    setInst(mesh, colIdx);
  };
  const capCols = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    slots.forEach((s, i) => {
      o.position.set(s.x, s.y + 0.012, s.z);
      o.scale.setScalar(s.kind === "ene" ? 0 : 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, col.set(s.kind === "agua" ? "#1d4ed8" : s.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  const caps = useRef<THREE.InstancedMesh>(null!);
  const necks = useRef<THREE.InstancedMesh>(null!);

  useFrame(() => {
    const on3 = tour.active && tour.chapter === 3;
    const t = tour.phaseT;
    let a = 0;
    if (on3 && tour.phase === "fridge") a = ss(t, FR.open0, FR.open1) * (1 - ss(t, FR.close0, FR.close1));
    doorB.current.rotation.y = a * 1.75 * m;
    const hide = on3 && bottleAt(tour) !== "fridge";
    if (hide !== lastHidden.current) {
      lastHidden.current = hide;
      const hi = hide ? pickIdx : -1;
      setInst(colored.current, colIdx, hi);
      // tapa y cuello de la botella tomada
      const o = new THREE.Object3D();
      const s = slots[pickIdx];
      o.position.set(s.x, s.y + 0.012, s.z);
      o.scale.setScalar(hide ? 0 : 1);
      o.updateMatrix();
      caps.current.setMatrixAt(pickIdx, o.matrix);
      caps.current.instanceMatrix.needsUpdate = true;
      necks.current.setMatrixAt(pickIdx, o.matrix);
      necks.current.instanceMatrix.needsUpdate = true;
    }
  });

  const fz = D / 2;
  return (
    <group position={[sp.x, 0, sp.z]}>
      {/* gabinete */}
      <mesh material={mat.body} position={[0, H / 2, -fz + 0.02]}><boxGeometry args={[W, H, 0.04]} /></mesh>
      <mesh material={mat.body} position={[-W / 2 + 0.02, H / 2, 0]}><boxGeometry args={[0.04, H, D]} /></mesh>
      <mesh material={mat.body} position={[W / 2 - 0.02, H / 2, 0]}><boxGeometry args={[0.04, H, D]} /></mesh>
      <mesh material={mat.body} position={[0, 0.07, 0]}><boxGeometry args={[W, 0.14, D]} /></mesh>
      <mesh material={mat.body} position={[0, H + 0.13, 0]}><boxGeometry args={[W, 0.26, D]} /></mesh>
      <mesh material={mat.sign} position={[0, H + 0.13, fz + 0.002]}><planeGeometry args={[W * 0.92, 0.2]} /></mesh>
      {/* interior iluminado + LED */}
      <mesh material={mat.inner} position={[0, H / 2 + 0.05, -fz + 0.045]}><planeGeometry args={[W - 0.08, H - 0.1]} /></mesh>
      {[-1, 1].map((sx) => (
        <mesh key={sx} material={mat.led} position={[sx * (W / 2 - 0.05), H / 2 + 0.05, fz - 0.06]}><boxGeometry args={[0.012, H - 0.2, 0.012]} /></mesh>
      ))}
      <mesh material={mat.led} position={[0, H - 0.03, fz - 0.06]}><boxGeometry args={[W - 0.1, 0.012, 0.012]} /></mesh>
      {SHELF_Y.map((y, i) => (
        <group key={y}>
          <mesh material={mat.shelf} position={[0, y, 0.02]}><boxGeometry args={[W - 0.08, 0.012, D - 0.12]} /></mesh>
          <mesh material={mat.strips[i]} position={[0, y - 0.022, fz - 0.035]}><planeGeometry args={[W - 0.1, 0.034]} /></mesh>
        </group>
      ))}
      {/* botellas (instanciadas) */}
      <instancedMesh frustumCulled={false} ref={initWater} args={[geo.bottle, mat.water, waterIdx.length]} />
      <instancedMesh frustumCulled={false} ref={initCol} args={[geo.bottle, mat.colored, colIdx.length]} />
      <instancedMesh frustumCulled={false} ref={(el) => { if (el) { necks.current = el; capCols(el); } }} args={[geo.neck, mat.water, slots.length]} />
      <instancedMesh frustumCulled={false} ref={(el) => { if (el) { caps.current = el; capCols(el); } }} args={[geo.cap, mat.cap, slots.length]} />
      {/* puertas de vidrio: A fija, B (lado de la caja) abre */}
      <group position={[-0.35 * m, H / 2 + 0.05, fz + 0.012]}>
        <DoorLeaf mat={mat} m={m} handleSide={1} />
      </group>
      <group ref={doorB} position={[0.7 * m, H / 2 + 0.05, fz + 0.012]}>
        <group position={[-0.35 * m, 0, 0]}>
          <DoorLeaf mat={mat} m={m} handleSide={-1} />
        </group>
      </group>
    </group>
  );
}

function DoorLeaf({ mat, m, handleSide }: { mat: { glass: THREE.Material; frame: THREE.Material }; m: number; handleSide: number }) {
  const w = 0.69;
  const h = H - 0.12;
  return (
    <>
      <mesh material={mat.glass}><planeGeometry args={[w - 0.04, h - 0.04]} /></mesh>
      <mesh material={mat.frame} position={[0, h / 2, 0]}><boxGeometry args={[w, 0.035, 0.03]} /></mesh>
      <mesh material={mat.frame} position={[0, -h / 2, 0]}><boxGeometry args={[w, 0.035, 0.03]} /></mesh>
      <mesh material={mat.frame} position={[-w / 2, 0, 0]}><boxGeometry args={[0.035, h, 0.03]} /></mesh>
      <mesh material={mat.frame} position={[w / 2, 0, 0]}><boxGeometry args={[0.035, h, 0.03]} /></mesh>
      <mesh material={mat.frame} position={[handleSide * (w / 2 - 0.06) * m, 0.05, 0.035]}><boxGeometry args={[0.022, 0.5, 0.022]} /></mesh>
    </>
  );
}

/* ---------- Cajera ---------- */

export function Cashier({ L, tour, handRef, tipRef }: { L: Layout; tour: Tour; handRef: React.MutableRefObject<THREE.Object3D | null>; tipRef: React.MutableRefObject<THREE.Object3D | null> }) {
  const m = L.mirror;
  const cx = L.reception.x + 1.0 * m;
  const cz = L.reception.z - 0.62;
  const root = useRef<THREE.Group>(null!);
  const chest = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const shL = useRef<THREE.Group>(null!);
  const shR = useRef<THREE.Group>(null!);
  const elL = useRef<THREE.Group>(null!);
  const elR = useRef<THREE.Group>(null!);
  const led = useRef<THREE.MeshBasicMaterial>(null!);
  const mat = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: "#8d5a3c", roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: "#1a120c", roughness: 0.55 }),
      shirt: new THREE.MeshStandardMaterial({ color: "#0EA5E9", roughness: 0.55 }),
      pants: new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.7 }),
      gun: new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 0.4, metalness: 0.3 }),
      gunY: new THREE.MeshStandardMaterial({ color: "#facc15", roughness: 0.5 }),
    }),
    [],
  );
  useFrame(() => {
    const on = tour.active && tour.chapter === 3;
    root.current.visible = on;
    if (!on) return;
    const t = tour.phaseT;
    const ph = tour.phase;
    const L2 = (a: number, b: number, k: number) => a + (b - a) * k;
    let sL = 0.05, sR = -0.05, eL = -0.25, eR = -0.25, oL = -0.1, oR = 0.1, cX = 0.03, hX = 0.05;
    const br = Math.sin(tour.t * 1.5) * 0.012;
    cX += br;
    if (ph === "scan") {
      const reach = ss(t, 1.0, 1.5) * (1 - ss(t, SC.take, SC.take + 0.5));
      const hold = ss(t, SC.take, SC.take + 0.5) * (1 - ss(t, SC.down - 0.6, SC.down - 0.3));
      const put = ss(t, SC.down - 0.6, SC.down - 0.3) * (1 - ss(t, SC.down + 0.1, SC.down + 0.6));
      const gun = ss(t, 1.9, 2.4) * (1 - ss(t, SC.down, SC.down + 0.6));
      sL = L2(sL, -1.2, reach); eL = L2(eL, -0.2, reach); oL = L2(oL, 0.05, reach); cX += 0.3 * reach; hX += 0.25 * reach;
      sL = L2(sL, -0.7, hold); eL = L2(eL, -1.15, hold); oL = L2(oL, 0.32, hold); hX += 0.2 * hold;
      sL = L2(sL, -1.0, put); eL = L2(eL, -0.35, put); oL = L2(oL, 0.12, put); cX += 0.18 * put;
      sR = L2(sR, -0.85, gun); eR = L2(eR, -0.95, gun); oR = L2(oR, -0.28, gun);
    } else if (ph !== "to_fridge" && ph !== "fridge" && ph !== "to_counter") {
      // atiende el punto de venta
      const tap = Math.max(0, Math.sin(tour.t * 9)) * 0.06;
      sR = -0.55; eR = -0.95 - tap; oR = -0.05; hX = 0.3;
    }
    chest.current.rotation.x = cX;
    head.current.rotation.x = hX;
    shL.current.rotation.set(sL, 0, oL);
    shR.current.rotation.set(sR, 0, oR);
    elL.current.rotation.x = eL;
    elR.current.rotation.x = eR;
    const beep = ph === "scan" && t > SC.beep && t < SC.beep + 0.6;
    led.current.color.set(beep ? "#22c55e" : ph === "scan" && t > SC.laser0 && t < SC.beep ? "#ef4444" : "#7f1d1d");
  });
  return (
    <group ref={root} position={[cx, 0, cz]} visible={false}>
      <mesh material={mat.pants} position={[0, 0.48, 0]}><cylinderGeometry args={[0.14, 0.12, 0.92, 12]} /></mesh>
      <group position={[0, 0.99, 0]}>
        <group ref={chest}>
          <mesh material={mat.shirt} position={[0, 0.27, 0]} scale={[1.18, 1, 0.72]}><capsuleGeometry args={[0.15, 0.3, 8, 16]} /></mesh>
          <mesh material={mat.skin} position={[0, 0.53, 0]}><cylinderGeometry args={[0.045, 0.05, 0.09, 12]} /></mesh>
          <group ref={head} position={[0, 0.58, 0]}>
            <mesh material={mat.skin} position={[0, 0.1, 0.005]} scale={[0.92, 1.08, 0.98]}><sphereGeometry args={[0.105, 20, 16]} /></mesh>
            <mesh material={mat.hair} position={[0, 0.115, -0.005]} rotation={[-0.2, 0, 0]}><sphereGeometry args={[0.112, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} /></mesh>
            <mesh material={mat.hair} position={[0, 0.17, -0.1]}><sphereGeometry args={[0.055, 12, 10]} /></mesh>
            <mesh material={mat.hair} position={[-0.036, 0.115, 0.093]}><sphereGeometry args={[0.013, 8, 6]} /></mesh>
            <mesh material={mat.hair} position={[0.036, 0.115, 0.093]}><sphereGeometry args={[0.013, 8, 6]} /></mesh>
          </group>
          {([[shL, elL, -0.2], [shR, elR, 0.2]] as const).map(([sh, el, x], i) => (
            <group key={i} ref={sh} position={[x, 0.44, 0]}>
              <mesh material={mat.shirt} position={[0, -0.145, 0]}><capsuleGeometry args={[0.05, 0.21, 6, 10]} /></mesh>
              <group ref={el} position={[0, -0.29, 0]}>
                <mesh material={mat.skin} position={[0, -0.13, 0]}><capsuleGeometry args={[0.042, 0.18, 6, 10]} /></mesh>
                <mesh material={mat.skin} position={[0, -0.28, 0]}><sphereGeometry args={[0.045, 12, 10]} /></mesh>
                {i === 0 ? (
                  <group ref={(g) => { handRef.current = g; }} position={[0, -0.3, 0.04]} />
                ) : (
                  // pistola lectora en la mano derecha
                  <group position={[0, -0.29, 0.02]}>
                    <mesh material={mat.gun} position={[0, -0.02, 0.03]} rotation={[0.3, 0, 0]}><boxGeometry args={[0.035, 0.1, 0.045]} /></mesh>
                    <mesh material={mat.gunY} position={[0, -0.09, 0.05]}><boxGeometry args={[0.055, 0.075, 0.13]} /></mesh>
                    <mesh position={[0, -0.13, 0.05]}>
                      <boxGeometry args={[0.045, 0.006, 0.1]} />
                      <meshBasicMaterial ref={led} color="#7f1d1d" />
                    </mesh>
                    <group ref={(g) => { tipRef.current = g; }} position={[0, -0.135, 0.05]} />
                  </group>
                )}
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

/* ---------- La bebida en juego, el láser y el bip ---------- */

const V1 = new THREE.Vector3();
const V2 = new THREE.Vector3();
const V3 = new THREE.Vector3();

export function SaleBottle({ L, tour, valeHand, cashHand, tip }: { L: Layout; tour: Tour; valeHand: React.MutableRefObject<THREE.Object3D | null>; cashHand: React.MutableRefObject<THREE.Object3D | null>; tip: React.MutableRefObject<THREE.Object3D | null> }) {
  const m = L.mirror;
  const cx = L.reception.x + 1.0 * m;
  const rz = L.reception.z;
  const A = useMemo(() => new THREE.Vector3(cx - 0.2, 1.155, rz + 0.3), [cx, rz]);
  const B = useMemo(() => new THREE.Vector3(cx - 0.36, 1.155, rz + 0.02), [cx, rz]);
  const bottle = useRef<THREE.Group>(null!);
  const laser = useRef<THREE.Mesh>(null!);
  const dot = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const chip = useRef<HTMLDivElement>(null);
  const mat = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: PICK_COLOR, roughness: 0.35, emissive: "#111827", emissiveIntensity: 0.2 }),
      neck: new THREE.MeshStandardMaterial({ color: "#dbeafe", roughness: 0.05, transparent: true, opacity: 0.72 }),
      cap: new THREE.MeshStandardMaterial({ color: PICK_COLOR, roughness: 0.5 }),
      band: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.5 }),
      laser: new THREE.MeshBasicMaterial({ color: "#ff2a2a", transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
      ring: new THREE.MeshBasicMaterial({ color: "#4ade80", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    }),
    [],
  );
  useFrame(({ camera }) => {
    const on = tour.active && tour.chapter === 3;
    const where = bottleAt(tour);
    const g = bottle.current;
    g.visible = on && where !== "fridge";
    const t = tour.phaseT;
    const scan = tour.phase === "scan";
    laser.current.visible = dot.current.visible = on && scan && t > SC.laser0 && t < SC.beep + 0.15;
    ring.current.visible = on && scan && t > SC.beep && t < SC.beep + 0.6;
    if (chip.current) chip.current.style.display = on && scan && t > SC.beep ? "block" : "none";
    if (!g.visible) return;
    const hv = valeHand.current ? valeHand.current.getWorldPosition(V1).add(V3.set(0, -0.1, 0)) : V1.copy(A);
    const hc = cashHand.current ? cashHand.current.getWorldPosition(V2).add(V3.set(0, -0.1, 0)) : V2.copy(A);
    const P = g.position;
    if (where === "vale") P.copy(hv);
    else if (where === "counterA") P.copy(A);
    else if (where === "cashier") P.copy(hc);
    else P.copy(B);
    if (scan && t > SC.put - 0.35 && t < SC.put) P.copy(hv).lerp(A, ss(t, SC.put - 0.35, SC.put));
    if (scan && t > SC.take && t < SC.take + 0.3) P.copy(A).lerp(hc, ss(t, SC.take, SC.take + 0.3));
    if (scan && t > SC.down - 0.35 && t < SC.down) P.copy(hc).lerp(B, ss(t, SC.down - 0.35, SC.down));
    if (laser.current.visible && tip.current) {
      const a = tip.current.getWorldPosition(V3);
      const b = V1.copy(P).add(V2.set(0, 0.09 + Math.sin(tour.t * 30) * 0.035, 0));
      const len = a.distanceTo(b);
      laser.current.position.copy(a).lerp(b, 0.5);
      laser.current.lookAt(b);
      laser.current.scale.set(1, 1, len);
      dot.current.position.copy(b);
    }
    if (ring.current.visible && tip.current) {
      tip.current.getWorldPosition(ring.current.position);
      ring.current.quaternion.copy(camera.quaternion);
      const k = (t - SC.beep) / 0.6;
      ring.current.scale.setScalar(0.4 + k * 2.2);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    }
  });
  return (
    <>
      <group ref={bottle} visible={false}>
        <mesh material={mat.body} position={[0, 0.085, 0]}><cylinderGeometry args={[0.031, 0.033, 0.17, 12]} /></mesh>
        <mesh material={mat.band} position={[0, 0.09, 0]}><cylinderGeometry args={[0.0335, 0.0335, 0.05, 12]} /></mesh>
        <mesh material={mat.neck} position={[0, 0.192, 0]}><cylinderGeometry args={[0.014, 0.03, 0.045, 10]} /></mesh>
        <mesh material={mat.cap} position={[0, 0.225, 0]}><cylinderGeometry args={[0.016, 0.016, 0.022, 8]} /></mesh>
      </group>
      <mesh ref={laser} material={mat.laser} visible={false}><boxGeometry args={[0.004, 0.004, 1]} /></mesh>
      <mesh ref={dot} material={mat.laser} visible={false}><boxGeometry args={[0.07, 0.006, 0.006]} /></mesh>
      <mesh ref={ring} material={mat.ring} visible={false}><ringGeometry args={[0.05, 0.065, 28]} /></mesh>
      <Html position={[cx - 0.2, 1.95, rz - 0.2]} center zIndexRange={[40, 30]} style={{ pointerEvents: "none" }}>
        <div ref={chip} className="gm-cj-beep" style={{ display: "none" }}>
          <b>BIP ✓</b> {SALE_ITEM.barcode}
          <span>{SALE_ITEM.name} · {cop(SALE_ITEM.price)}</span>
        </div>
      </Html>
    </>
  );
}
