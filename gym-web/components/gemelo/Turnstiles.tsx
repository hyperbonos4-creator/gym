"use client";

/**
 * Torniquetes reales del gimnasio (speed gate de acero inoxidable con paneles
 * de vidrio batientes), modelados en código: gabinetes con pilares de extremo
 * redondeados, tapa superior larga, tapas oscuras con anillo LED cian, ranura
 * negra lateral, paneles de vidrio con esquinas redondeadas sobre eje de acero,
 * flechas verde / X roja + el ícono de tarjeta impreso del equipo (solo arte: el software no usa tarjetas), tablet de reconocimiento facial sobre
 * poste y pantalla trasera. Geometría estática fusionada por material (pocas
 * draw calls), PBR metal/rugosidad con entorno generado en código.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { GemeloSim } from "../../lib/gemelo/sim";
import type { Tour } from "../../lib/gemelo/tour";
import { TOUR_PERSON, GUESTS } from "../../lib/gemelo/tour";

/* ---------- Entorno PBR generado en código ---------- */

export function StudioEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pm.fromScene(room, 0.04);
    scene.environment = rt.texture;
    (scene as any).environmentIntensity = 0.85;
    return () => {
      scene.environment = null;
      rt.dispose();
      pm.dispose();
    };
  }, [gl, scene]);
  return null;
}

/* ---------- Geometrías ---------- */

const CAB_L = 1.6; // largo del gabinete (dirección de paso)
const CAB_W = 0.2;
const CAB_H = 1.0;
const LANE_W = 1.0;

function roundedRect(w: number, d: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -d / 2;
  r = Math.min(r, w / 2, d / 2);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - r);
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + d);
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** losa redondeada horizontal (w en x, d en z), de y0 a y0+h */
function slab(w: number, d: number, r: number, h: number, seg = 10) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, d, r), { depth: h, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** panel vertical de vidrio con esquinas redondeadas; borde de bisagra en x=0, se extiende a +x */
function glassPanel(w: number, h: number, t: number) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w, h, 0.06), { depth: t, bevelEnabled: false, curveSegments: 8 });
  g.translate(w / 2, h / 2, -t / 2);
  return g;
}

function place(g: THREE.BufferGeometry, x: number, y: number, z: number, ry = 0) {
  const c = g.clone();
  if (ry) c.rotateY(ry);
  c.translate(x, y, z);
  return c.index ? c.toNonIndexed() : c;
}

function merge(list: THREE.BufferGeometry[]) {
  const norm = list.map((g) => {
    const c = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(c.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") c.deleteAttribute(k);
    if (!c.attributes.uv) c.setAttribute("uv", new THREE.BufferAttribute(new Float32Array((c.attributes.position.count) * 2), 2));
    return c;
  });
  return mergeGeometries(norm, false)!;
}

/* ---------- Texturas en canvas ---------- */

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function capTopTexture() {
  return canvasTex(256, 384, (g) => {
    g.fillStyle = "#0b0e14";
    g.fillRect(0, 0, 256, 384);
    // flecha verde
    g.fillStyle = "#16c46a";
    g.beginPath();
    g.arc(128, 82, 52, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e9fff3";
    g.beginPath();
    g.moveTo(128, 46);
    g.lineTo(160, 82);
    g.lineTo(140, 82);
    g.lineTo(140, 118);
    g.lineTo(116, 118);
    g.lineTo(116, 82);
    g.lineTo(96, 82);
    g.closePath();
    g.fill();
    // ícono de tarjeta impreso en el equipo físico (solo arte)
    g.strokeStyle = "#9fdcff";
    g.lineWidth = 7;
    g.strokeRect(84, 166, 88, 58);
    g.lineWidth = 6;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(128, 252 - 30, 24 + i * 16, -Math.PI * 0.8, -Math.PI * 0.2);
      g.stroke();
    }
    // X roja
    g.fillStyle = "#e5293f";
    g.beginPath();
    g.arc(128, 310, 46, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = "#fff0f2";
    g.lineWidth = 14;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(108, 290);
    g.lineTo(148, 330);
    g.moveTo(148, 290);
    g.lineTo(108, 330);
    g.stroke();
  });
}

function drawFace(g: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  // persona inventada (ilustración)
  g.fillStyle = "#3b2418";
  g.beginPath();
  g.ellipse(cx, cy - s * 0.1, s * 0.62, s * 0.7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d9a27a";
  g.beginPath();
  g.ellipse(cx, cy + s * 0.05, s * 0.45, s * 0.56, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#3b2418";
  g.beginPath();
  g.ellipse(cx, cy - s * 0.42, s * 0.5, s * 0.22, 0, Math.PI, Math.PI * 2);
  g.fill();
  g.fillStyle = "#1d1410";
  g.beginPath();
  g.arc(cx - s * 0.17, cy, s * 0.05, 0, Math.PI * 2);
  g.arc(cx + s * 0.17, cy, s * 0.05, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#a0523d";
  g.lineWidth = s * 0.04;
  g.beginPath();
  g.arc(cx, cy + s * 0.2, s * 0.14, 0.2, Math.PI - 0.2);
  g.stroke();
  // hombros
  g.fillStyle = "#e8eefc";
  g.beginPath();
  g.ellipse(cx, cy + s * 1.25, s * 0.95, s * 0.55, 0, Math.PI, Math.PI * 2);
  g.fill();
}

type TabletState = "idle" | "scan" | "ok" | "okv" | "okg" | "deny" | "back";

function tabletTexture(kind: TabletState) {
  return canvasTex(300, 520, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 520);
    grd.addColorStop(0, "#0a1426");
    grd.addColorStop(1, "#050a14");
    g.fillStyle = grd;
    g.fillRect(0, 0, 300, 520);
    if (kind === "back") {
      g.fillStyle = "#0b1220";
      g.fillRect(0, 0, 300, 520);
      g.fillStyle = "#38bdf8";
      g.font = "700 30px Orbitron, Inter, sans-serif";
      g.textAlign = "center";
      g.fillText("VISIONYX", 150, 250);
      g.fillStyle = "#64748b";
      g.font = "500 20px Inter, sans-serif";
      g.fillText("Salida", 150, 290);
      return;
    }
    g.fillStyle = "#7dd3fc";
    g.font = "800 24px Orbitron, Inter, sans-serif";
    g.textAlign = "center";
    g.fillText("VISIONYX", 150, 44);
    // cámara / rostro
    const fy = 210;
    g.save();
    g.beginPath();
    g.rect(30, 70, 240, 270);
    g.clip();
    g.fillStyle = "#15233d";
    g.fillRect(30, 70, 240, 270);
    if (kind !== "idle") drawFace(g, 150, fy, 92);
    g.restore();
    const col = kind === "ok" || kind === "okv" || kind === "okg" ? "#22E0A1" : kind === "deny" ? "#FF4D6D" : "#38BDF8";
    g.strokeStyle = col;
    g.lineWidth = 5;
    const bx = 82;
    const by = 120;
    const bw = 136;
    const bh = 160;
    const L = 30;
    g.beginPath();
    for (const [x, y, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]] as const) {
      g.moveTo(x + dx * L, y);
      g.lineTo(x, y);
      g.lineTo(x, y + dy * L);
    }
    g.stroke();
    // Textos reales del kiosko (access/backend/public/assets/kiosk.js · setVerdict)
    if (kind === "idle") {
      g.fillStyle = "#94a3b8";
      g.font = "600 34px Inter, sans-serif";
      g.fillText("◎", 150, 215);
    }
    // franja de estado
    const sy = 360;
    if (kind === "ok" || kind === "okv" || kind === "okg") {
      g.fillStyle = "rgba(34,224,161,0.16)";
      g.fillRect(0, sy, 300, 160);
      g.fillStyle = "#22E0A1";
      g.font = "800 27px Inter, sans-serif";
      g.fillText("✔ ACCESO CONCEDIDO", 150, sy + 50);
      g.fillStyle = "#e8eefc";
      g.font = "600 19px Inter, sans-serif";
      if (kind === "okg") {
        // nombre del sujeto del invitado: "{invitado} · invitado de {socio}" (api/mobile/invitaciones)
        g.font = "600 17px Inter, sans-serif";
        g.fillText(`Bienvenido, ${GUESTS[0].nombre}`, 150, sy + 84);
        g.fillText(`· invitado de ${TOUR_PERSON.nombre}`, 150, sy + 108);
      } else if (kind === "okv") {
        g.fillText("Bienvenido,", 150, sy + 86);
        g.fillText(TOUR_PERSON.nombre, 150, sy + 112);
      } else g.fillText("Identidad verificada", 150, sy + 92);
      g.fillStyle = "#94a3b8";
      g.font = "500 16px Inter, sans-serif";
      g.fillText("Cliente · Abriendo…", 150, sy + 142);
    } else if (kind === "deny") {
      g.fillStyle = "rgba(255,77,109,0.18)";
      g.fillRect(0, sy, 300, 160);
      g.fillStyle = "#FF4D6D";
      g.font = "800 27px Inter, sans-serif";
      g.fillText("✕ ACCESO DENEGADO", 150, sy + 52);
      g.fillStyle = "#e8eefc";
      g.font = "600 18px Inter, sans-serif";
      g.fillText("Membresía vencida o sin plan", 150, sy + 94);
      g.fillStyle = "#94a3b8";
      g.font = "500 16px Inter, sans-serif";
      g.fillText("Cerrado", 150, sy + 126);
    } else {
      // reposo y lectura: "Acérquese a la cámara" (la tarjeta pulsa mientras escanea)
      g.fillStyle = kind === "scan" ? "#38BDF8" : "#cbd5e1";
      g.font = "700 22px Inter, sans-serif";
      g.fillText("Acérquese a la cámara", 150, sy + 46);
      g.fillStyle = "#64748b";
      g.font = "500 15px Inter, sans-serif";
      g.fillText("El sistema reconocerá su", 150, sy + 80);
      g.fillText("rostro automáticamente", 150, sy + 100);
      if (kind === "scan") {
        g.fillStyle = "rgba(56,189,248,0.25)";
        g.fillRect(40, sy + 124, 220, 6);
        g.fillStyle = "#38BDF8";
        g.fillRect(40, sy + 124, 150, 6);
      }
    }
  });
}

/* ---------- Componente ---------- */

export function Turnstiles({ sim, tour }: { sim: GemeloSim; tour: Tour }) {
  const L = sim.layout;
  const data = useMemo(() => {
    const steel: THREE.BufferGeometry[] = [];
    const dark: THREE.BufferGeometry[] = [];
    const led: THREE.BufferGeometry[] = [];
    const glassSide: THREE.BufferGeometry[] = [];
    const caps: THREE.BufferGeometry[] = [];
    const lanesX = L.gates.map((g) => g.x);
    const gz = L.gates[0].z;
    const cabXs = new Set<number>();
    for (const x of lanesX) {
      cabXs.add(+(x - LANE_W / 2).toFixed(3));
      cabXs.add(+(x + LANE_W / 2).toFixed(3));
    }
    const ex = L.exitX;
    const exitCabs = [ex - LANE_W / 2, ex + LANE_W / 2];
    const allCabs = [...cabXs, ...exitCabs];
    const pillar = slab(CAB_W, 0.34, 0.1, CAB_H - 0.06, 12);
    const beam = new THREE.BoxGeometry(CAB_W * 0.8, 0.16, CAB_L - 0.6);
    const rail = new THREE.BoxGeometry(CAB_W * 0.7, 0.07, CAB_L - 0.6);
    const sideGlass = new THREE.BoxGeometry(0.014, 0.66, CAB_L - 0.62);
    const cover = slab(CAB_W + 0.05, CAB_L, 0.12, 0.035, 12);
    const cap = slab(CAB_W + 0.055, 0.36, 0.12, 0.03, 12);
    const ledBand = slab(CAB_W + 0.06, 0.37, 0.125, 0.022, 12);
    const slot = new THREE.BoxGeometry(0.008, 0.028, CAB_L - 0.7);
    const capTop = new THREE.PlaneGeometry(0.2, 0.3);
    capTop.rotateX(-Math.PI / 2);
    const rod = new THREE.CylinderGeometry(0.02, 0.02, 0.86, 14);
    const rodCap = new THREE.CylinderGeometry(0.03, 0.03, 0.04, 14);
    const pole = new THREE.CylinderGeometry(0.02, 0.024, 0.26, 14);
    const base = new THREE.CylinderGeometry(0.075, 0.08, 0.016, 20);
    const frame = new THREE.BoxGeometry(0.19, 0.31, 0.022);
    for (const cx of allCabs) {
      const zEnd = CAB_L / 2 - 0.17;
      for (const sgn of [1, -1]) {
        steel.push(place(pillar, cx, 0, gz + sgn * zEnd));
        dark.push(place(cap, cx, CAB_H + 0.035, gz + sgn * zEnd));
        led.push(place(ledBand, cx, CAB_H - 0.03, gz + sgn * zEnd));
        caps.push(place(capTop, cx, CAB_H + 0.067, gz + sgn * zEnd, sgn > 0 ? 0 : Math.PI));
      }
      steel.push(place(beam, cx, CAB_H - 0.14, gz));
      steel.push(place(rail, cx, 0.035, gz));
      steel.push(place(cover, cx, CAB_H - 0.008, gz));
      glassSide.push(place(sideGlass, cx, 0.42, gz));
      dark.push(place(slot, cx - CAB_W * 0.4 - 0.004, CAB_H - 0.12, gz));
      dark.push(place(slot, cx + CAB_W * 0.4 + 0.004, CAB_H - 0.12, gz));
    }
    // ejes de los paneles (uno por lado de cada carril)
    const hinges: { x: number; dir: 1 | -1; lane: number }[] = [];
    lanesX.forEach((x, i) => {
      hinges.push({ x: x - LANE_W / 2 + CAB_W / 2 + 0.02, dir: 1, lane: i });
      hinges.push({ x: x + LANE_W / 2 - CAB_W / 2 - 0.02, dir: -1, lane: i });
    });
    hinges.push({ x: ex - LANE_W / 2 + CAB_W / 2 + 0.02, dir: 1, lane: -1 });
    hinges.push({ x: ex + LANE_W / 2 - CAB_W / 2 - 0.02, dir: -1, lane: -1 });
    for (const h of hinges) {
      steel.push(place(rod, h.x, 0.47, gz));
      steel.push(place(rodCap, h.x, 0.91, gz));
    }
    // tablets: una por carril de entrada, en el gabinete derecho, mirando a quien entra (+z)
    const tablets: { x: number; z: number; lane: number; back: boolean }[] = [];
    lanesX.forEach((x, i) => tablets.push({ x: x + LANE_W / 2, z: gz + CAB_L / 2 - 0.42, lane: i, back: false }));
    // pantalla trasera (mira hacia adentro, -z) en el extremo opuesto
    lanesX.forEach((x, i) => tablets.push({ x: x - LANE_W / 2, z: gz - CAB_L / 2 + 0.42, lane: i, back: true }));
    for (const t of tablets) {
      steel.push(place(base, t.x, CAB_H + 0.035, t.z));
      steel.push(place(pole, t.x, CAB_H + 0.17, t.z));
      steel.push(place(frame, t.x, CAB_H + 0.43, t.z));
    }
    return {
      steel: merge(steel),
      dark: merge(dark),
      led: merge(led),
      glassSide: merge(glassSide),
      caps: merge(caps),
      hinges,
      tablets,
      gz,
    };
  }, [L]);

  const mats = useMemo(() => {
    const capTex = capTopTexture();
    return {
      steel: new THREE.MeshStandardMaterial({ color: "#c9cdd2", metalness: 0.92, roughness: 0.3, envMapIntensity: 1.25 }),
      dark: new THREE.MeshStandardMaterial({ color: "#0d1016", metalness: 0.3, roughness: 0.38 }),
      led: new THREE.MeshBasicMaterial({ color: "#2ee6ff", toneMapped: false }),
      glassSide: new THREE.MeshStandardMaterial({ color: "#b8d8f0", metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false }),
      glass: new THREE.MeshStandardMaterial({ color: "#d7ecff", metalness: 0.15, roughness: 0.04, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 }),
      glassEdge: new THREE.MeshBasicMaterial({ color: "#bfe7ff", transparent: true, opacity: 0.55, toneMapped: false }),
      caps: new THREE.MeshStandardMaterial({ map: capTex, roughness: 0.35, metalness: 0.1, emissive: "#ffffff", emissiveMap: capTex, emissiveIntensity: 0.55 }),
      tex: {
        idle: tabletTexture("idle"),
        scan: tabletTexture("scan"),
        ok: tabletTexture("ok"),
        okv: tabletTexture("okv"),
        deny: tabletTexture("deny"),
        okg: tabletTexture("okg"),
        back: tabletTexture("back"),
      } as Record<TabletState, THREE.Texture>,
    };
  }, []);

  const panelGeo = useMemo(() => glassPanel(LANE_W / 2 - CAB_W / 2 - 0.035, 0.62, 0.014), []);
  const edgeGeo = useMemo(() => {
    const w = LANE_W / 2 - CAB_W / 2 - 0.035;
    const g = new THREE.BoxGeometry(0.008, 0.6, 0.018);
    g.translate(w - 0.004, 0.31, 0);
    return g;
  }, []);
  const flaps = useRef<(THREE.Group | null)[]>([]);
  const screens = useRef<(THREE.Mesh | null)[]>([]);
  const pads = useRef<(THREE.Mesh | null)[]>([]);
  const ok = useMemo(() => new THREE.Color("#22E0A1"), []);
  const bad = useMemo(() => new THREE.Color("#FF4D6D"), []);
  const base = useMemo(() => new THREE.Color("#0f2140"), []);
  const exitOpen = useRef(0);

  useFrame((_, dtRaw) => {
    const w = window as any;
    const dt = Math.min(typeof w.__gmFixedDt === "number" ? w.__gmFixedDt : dtRaw, 0.1);
    // salida: abre si alguien pasa
    let near = false;
    for (const m of sim.members) {
      if (m.phase === "saliendo" && Math.abs(m.x - L.exitX) < 0.7 && m.z > data.gz - 1.6 && m.z < data.gz + 1.8) {
        near = true;
        break;
      }
    }
    exitOpen.current = Math.max(0, Math.min(1, exitOpen.current + (near ? dt * 4 : -dt * 2.2)));
    data.hinges.forEach((h, i) => {
      const grp = flaps.current[i];
      if (!grp) return;
      let o: number;
      if (h.lane < 0) o = exitOpen.current;
      else {
        const g = L.gates[h.lane];
        o = g.open > 0 ? Math.min(1, g.open / 0.25) : 0;
        // denegado: vibración corta del vidrio
        if (!g.flashOk && g.flash > 0.6) o = Math.sin(g.flash * 40) * 0.03;
      }
      const prev = (grp.userData.o as number) ?? 0;
      const k = o > prev ? Math.min(1, dt * 9) : Math.min(1, dt * 5);
      const cur = h.lane < 0 ? o : prev + (o - prev) * k;
      grp.userData.o = cur;
      // abre hacia adentro (-z): ambos paneles giran 90°
      grp.rotation.y = h.dir * cur * (Math.PI / 2) * 0.98;
    });
    data.tablets.forEach((t, i) => {
      const mesh = screens.current[i];
      if (!mesh) return;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      let st: TabletState = "idle";
      if (t.back) st = "back";
      else {
        const g = L.gates[t.lane];
        if (tour.active && t.lane === tour.gate && tour.tablet !== "idle") st = tour.tablet === "ok" ? "okv" : tour.tablet === "okg" ? "okg" : tour.tablet === "deny" ? "deny" : "scan";
        else if (g.flash > 0) st = g.flashOk ? "ok" : "deny";
      }
      const tex = mats.tex[st];
      if (mat.map !== tex) {
        mat.map = tex;
        mat.needsUpdate = true;
      }
    });
    L.gates.forEach((g, i) => {
      const pad = pads.current[i];
      if (!pad) return;
      const f = g.flash / 1.1;
      const mat = pad.material as THREE.MeshBasicMaterial;
      mat.color.copy(base).lerp(g.flashOk ? ok : bad, Math.min(1, f * 1.5));
      mat.opacity = 0.55 + f * 0.4;
    });
  });

  return (
    <group>
      <mesh geometry={data.steel} material={mats.steel} />
      <mesh geometry={data.dark} material={mats.dark} />
      <mesh geometry={data.led} material={mats.led} />
      <mesh geometry={data.glassSide} material={mats.glassSide} renderOrder={2} />
      <mesh geometry={data.caps} material={mats.caps} />
      {L.gates.map((g, i) => (
        <mesh key={`p${i}`} ref={(el) => { pads.current[i] = el; }} position={[g.x, 0.012, g.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[LANE_W - CAB_W - 0.06, CAB_L]} />
          <meshBasicMaterial transparent toneMapped={false} depthWrite={false} />
        </mesh>
      ))}
      {data.hinges.map((h, i) => (
        <group key={`h${i}`} position={[h.x, 0.27, data.gz]} ref={(el) => { flaps.current[i] = el; }}>
          <group scale={[h.dir, 1, 1]}>
            <mesh geometry={panelGeo} material={mats.glass} renderOrder={3} />
            <mesh geometry={edgeGeo} material={mats.glassEdge} renderOrder={3} />
          </group>
        </group>
      ))}
      {data.tablets.map((t, i) => (
        <mesh
          key={`t${i}`}
          ref={(el) => { screens.current[i] = el; }}
          position={[t.x, CAB_H + 0.43, t.z + (t.back ? -0.0115 : 0.0115)]}
          rotation={[0, t.back ? Math.PI : 0, 0]}
        >
          <planeGeometry args={[0.165, 0.285]} />
          <meshBasicMaterial toneMapped={false} map={mats.tex.idle} />
        </mesh>
      ))}
    </group>
  );
}
