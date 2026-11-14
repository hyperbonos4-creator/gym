"use client";

/**
 * Personajes del conjunto URBAN. Misma construcción articulada que las figuras del gemelo del
 * gimnasio (cadera, rodilla, hombro, codo; Human.tsx / Crowd.tsx), con ojos que parpadean,
 * cabeza que gira (prueba de vida), pose sentada (caseta / oficina) y celular en la mano.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Pose } from "../../lib/urban/tour";

const HIP = 0.93;
const THIGH = 0.44;
const SHIN = 0.43;
const UARM = 0.29;
const FARM = 0.26;

export type Look = {
  female: boolean;
  skin: string;
  hair: string;
  top: string;
  legs: string;
  shoes: string;
  hairStyle: "pony" | "bun" | "long" | "short" | "cap";
  build?: number;
  sleeves?: string;
  badge?: string;
};

let GEO: Record<string, THREE.BufferGeometry> | null = null;
function geo() {
  if (GEO) return GEO;
  GEO = {
    thigh: new THREE.CapsuleGeometry(0.075, THIGH - 0.1, 4, 12).translate(0, -THIGH / 2, 0),
    shin: new THREE.CapsuleGeometry(0.06, SHIN - 0.08, 4, 12).translate(0, -SHIN / 2, 0),
    uarm: new THREE.CapsuleGeometry(0.05, UARM - 0.08, 4, 10).translate(0, -UARM / 2, 0),
    farm: new THREE.CapsuleGeometry(0.042, FARM - 0.08, 4, 10).translate(0, -FARM / 2, 0),
    hand: new THREE.SphereGeometry(0.045, 12, 10),
    torso: new THREE.CapsuleGeometry(0.15, 0.3, 8, 16),
    hips: new THREE.CapsuleGeometry(0.135, 0.06, 4, 14).rotateZ(Math.PI / 2),
    neck: new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12),
    head: new THREE.SphereGeometry(0.105, 24, 18),
    nose: new THREE.ConeGeometry(0.016, 0.04, 8).rotateX(Math.PI / 2),
    eye: new THREE.SphereGeometry(0.0125, 10, 8),
    brow: new THREE.BoxGeometry(0.03, 0.006, 0.008),
    capHair: new THREE.SphereGeometry(0.112, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    capShort: new THREE.SphereGeometry(0.11, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
    pony: new THREE.CapsuleGeometry(0.04, 0.16, 4, 10),
    bun: new THREE.SphereGeometry(0.055, 14, 12),
    long: new THREE.CapsuleGeometry(0.085, 0.2, 4, 12),
    visor: new THREE.CylinderGeometry(0.1, 0.1, 0.012, 18, 1, false, -Math.PI / 2, Math.PI).rotateY(Math.PI),
    shoe: new THREE.BoxGeometry(0.1, 0.075, 0.25),
    shadow: new THREE.CircleGeometry(0.36, 20).rotateX(-Math.PI / 2),
    phone: new THREE.BoxGeometry(0.075, 0.01, 0.152),
    screen: new THREE.PlaneGeometry(0.066, 0.14).rotateX(-Math.PI / 2),
    badge: new THREE.PlaneGeometry(0.06, 0.035),
    collar: new THREE.TorusGeometry(0.07, 0.018, 6, 16).rotateX(Math.PI / 2),
  };
  return GEO;
}
const MATS = new Map<string, THREE.Material>();
function mat(c: string, rough = 0.6, metal = 0): THREE.MeshStandardMaterial {
  const k = `${c}|${rough}|${metal}`;
  let m = MATS.get(k) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: metal });
    MATS.set(k, m);
  }
  return m;
}
function basic(c: string, opacity = 1): THREE.MeshBasicMaterial {
  const k = `b|${c}|${opacity}`;
  let m = MATS.get(k) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: c, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, toneMapped: false });
    MATS.set(k, m);
  }
  return m;
}

export default function Person({ look, pose }: { look: Look; pose: (t: number) => Pose }) {
  const G = geo();
  const f = look.female;
  const b = look.build ?? 0.4;
  const M = useMemo(
    () => ({
      skin: mat(look.skin, 0.62),
      hair: mat(look.hair, 0.5),
      top: mat(look.top, 0.6),
      sleeve: mat(look.sleeves || look.top, 0.6),
      legs: mat(look.legs, 0.7),
      shoe: mat(look.shoes, 0.45),
      eye: mat("#1a1410", 0.3),
      phone: mat("#0b0f17", 0.25, 0.5),
      screen: basic("#3B82F6"),
      shadow: basic("#000000", 0.35),
      badge: basic(look.badge || "#ffffff"),
    }),
    [look],
  );
  const R = {
    root: useRef<THREE.Group>(null!),
    body: useRef<THREE.Group>(null!),
    pelvis: useRef<THREE.Group>(null!),
    chest: useRef<THREE.Group>(null!),
    head: useRef<THREE.Group>(null!),
    eyes: useRef<THREE.Group>(null!),
    thL: useRef<THREE.Group>(null!),
    thR: useRef<THREE.Group>(null!),
    knL: useRef<THREE.Group>(null!),
    knR: useRef<THREE.Group>(null!),
    shL: useRef<THREE.Group>(null!),
    shR: useRef<THREE.Group>(null!),
    elL: useRef<THREE.Group>(null!),
    elR: useRef<THREE.Group>(null!),
    phone: useRef<THREE.Group>(null!),
  };
  const clock = useRef(0);

  useFrame((state) => {
    const w = window as any;
    const t: number = typeof w.__urT === "number" ? w.__urT : state.clock.elapsedTime;
    clock.current = t;
    const p = pose(t);
    const r = R.root.current;
    if (!r) return;
    r.position.set(p.x, 0, p.z);
    r.rotation.y = p.yaw;
    const wk = p.walk;
    const s = Math.sin(p.phase);
    const c = Math.cos(p.phase);
    const breathe = Math.sin(t * 1.6) * 0.012;
    // Piernas (marcha) o sentado
    const sit = p.sit;
    R.thL.current.rotation.x = -0.42 * s * wk - 1.5 * sit;
    R.thR.current.rotation.x = 0.42 * s * wk - 1.5 * sit;
    R.knL.current.rotation.x = wk * (0.08 + 0.62 * Math.max(0, c)) + 1.45 * sit;
    R.knR.current.rotation.x = wk * (0.08 + 0.62 * Math.max(0, -c)) + 1.45 * sit;
    R.pelvis.current.position.y = HIP + Math.abs(c) * 0.03 * wk - 0.42 * sit;
    R.pelvis.current.rotation.y = 0.08 * s * wk;
    R.chest.current.rotation.y = -0.14 * s * wk;
    R.chest.current.rotation.x = 0.04 * wk + 0.1 * sit + breathe;
    // Brazos: braceo, celular (pecho) o selfie (prueba de vida), teclear
    const ph = Math.max(p.phone, p.selfie);
    const self = p.selfie;
    const typ = p.type * sit;
    const tw = Math.sin(t * 9) * 0.05 * typ;
    const armSwing = 0.36 * s * wk * (1 - ph);
    R.shL.current.rotation.x = armSwing * (1 - typ) + 0.04 * ph + (-0.55 * typ) + tw;
    R.elL.current.rotation.x = -0.18 * wk * (1 - ph) - 0.22 * ph - 0.9 * typ - 0.06;
    R.shL.current.rotation.z = -0.07;
    R.shR.current.rotation.x = -armSwing * (1 - typ) + (-0.5 * ph * (1 - self)) + (-1.6 * self) + (-0.55 * typ) - tw;
    R.elR.current.rotation.x = -0.18 * wk * (1 - ph) - 1.3 * ph * (1 - self) - 0.3 * self - 0.9 * typ - 0.06;
    R.shR.current.rotation.y = -0.3 * self;
    R.shR.current.rotation.z = 0.06 + 0.22 * ph * (1 - self) - 0.12 * self;
    R.phone.current.visible = ph > 0.02;
    R.phone.current.rotation.x = 0.87 * p.phone * (1 - self) + 0.6 * self;
    // Cabeza
    R.head.current.rotation.y = p.headYaw;
    R.head.current.rotation.x = p.headPitch;
    R.eyes.current.scale.y = 1 - 0.9 * p.blink;
  });

  const shX = f ? 0.172 : 0.205 + b * 0.025;
  const armT = f ? 0.92 : 1.08 + b * 0.12;
  const legT = f ? 1.04 : 1.08;
  const sc = f ? 0.95 : 1.02;
  const hs = look.hairStyle;

  return (
    <group ref={R.root} scale={sc}>
      <mesh geometry={G.shadow} material={M.shadow} position={[0, 0.012, 0]} />
      <group ref={R.body}>
        <group ref={R.pelvis} position={[0, HIP, 0]}>
          <mesh geometry={G.hips} material={M.legs} scale={f ? [1.12, 1, 0.82] : [1.02, 1, 0.76]} />
          {([[R.thL, R.knL, -1], [R.thR, R.knR, 1]] as const).map(([th, kn, side]) => (
            <group key={side} ref={th} position={[side * (f ? 0.1 : 0.095), -0.02, 0]}>
              <mesh geometry={G.thigh} material={M.legs} scale={[legT, 1, legT]} />
              <group ref={kn} position={[0, -THIGH, 0]}>
                <mesh geometry={G.shin} material={M.legs} scale={[legT * 0.97, 1, legT * 0.97]} />
                <mesh geometry={G.shoe} material={M.shoe} position={[0, -SHIN - 0.02, 0.045]} />
              </group>
            </group>
          ))}
          <group ref={R.chest} position={[0, 0.06, 0]}>
            <mesh geometry={G.torso} material={M.top} position={[0, 0.27, 0]} scale={f ? [1.04, 0.98, 0.74] : [1.22 + b * 0.1, 1.03, 0.8]} />
            {look.badge && <mesh geometry={G.badge} material={M.badge} position={[0.08, 0.36, f ? 0.117 : 0.126]} />}
            <mesh geometry={G.neck} material={M.skin} position={[0, 0.53, 0]} scale={f ? [0.9, 1, 0.9] : [1.12, 1, 1.12]} />
            <group ref={R.head} position={[0, 0.58, 0]}>
              <mesh geometry={G.head} material={M.skin} position={[0, 0.1, 0.005]} scale={f ? [0.9, 1.06, 0.96] : [0.95, 1.08, 1]} />
              <mesh geometry={G.nose} material={M.skin} position={[0, 0.085, 0.1]} />
              <group ref={R.eyes} position={[0, 0.115, 0.088]}>
                <mesh geometry={G.eye} material={M.eye} position={[-0.034, 0, 0]} />
                <mesh geometry={G.eye} material={M.eye} position={[0.034, 0, 0]} />
              </group>
              <mesh geometry={G.brow} material={M.hair} position={[-0.034, 0.142, 0.094]} />
              <mesh geometry={G.brow} material={M.hair} position={[0.034, 0.142, 0.094]} />
              {f ? (
                <>
                  <mesh geometry={G.capHair} material={M.hair} position={[0, 0.115, -0.005]} rotation={[-0.25, 0, 0]} />
                  {hs === "pony" && <mesh geometry={G.pony} material={M.hair} position={[0, 0.07, -0.13]} rotation={[0.45, 0, 0]} />}
                  {hs === "bun" && <mesh geometry={G.bun} material={M.hair} position={[0, 0.21, -0.07]} />}
                  {hs === "long" && <mesh geometry={G.long} material={M.hair} position={[0, 0.0, -0.075]} scale={[1.15, 1, 0.45]} />}
                </>
              ) : hs === "cap" ? (
                <>
                  <mesh geometry={G.capShort} material={M.hair} position={[0, 0.118, -0.002]} scale={[0.97, 0.9, 0.97]} rotation={[-0.3, 0, 0]} />
                  <mesh geometry={G.capHair} material={M.top} position={[0, 0.135, -0.005]} scale={[1.02, 0.85, 1.02]} rotation={[-0.12, 0, 0]} />
                  <mesh geometry={G.visor} material={M.top} position={[0, 0.16, 0.07]} rotation={[0.18, 0, 0]} />
                </>
              ) : (
                <mesh geometry={G.capShort} material={M.hair} position={[0, 0.125, -0.005]} rotation={[-0.18, 0, 0]} />
              )}
            </group>
            {([[R.shL, R.elL, -1], [R.shR, R.elR, 1]] as const).map(([sh, el, side]) => (
              <group key={side} ref={sh} position={[side * shX, 0.44, 0]}>
                <mesh geometry={G.uarm} material={M.sleeve} scale={[armT, 1, armT]} />
                <group ref={el} position={[0, -UARM, 0]}>
                  <mesh geometry={G.farm} material={f ? M.skin : M.sleeve} scale={[armT, 1, armT]} />
                  <mesh geometry={G.hand} material={M.skin} position={[0, -FARM - 0.02, 0]} />
                  {side === 1 && (
                    <group ref={R.phone} position={[0, -FARM - 0.05, 0.02]}>
                      <mesh geometry={G.phone} material={M.phone} />
                      <mesh geometry={G.screen} material={M.screen} position={[0, 0.0055, 0]} />
                    </group>
                  )}
                </group>
              </group>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}
