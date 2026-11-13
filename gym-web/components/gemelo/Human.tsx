"use client";

/**
 * Protagonista del recorrido: figura humana estilizada con jerarquía de
 * articulaciones (cadera, rodilla, hombro, codo) y ciclo de marcha natural:
 * zancada, flexión de rodilla en el balanceo, braceo opuesto, rebote de pelvis
 * y contra-rotación del torso. También poses de "mirar el celular" y ejercicio.
 */

import { curlElbow } from "../../lib/gemelo/curl";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Tour } from "../../lib/gemelo/tour";
import { FR, SC, ss } from "../../lib/gemelo/sale";

const HIP_Y = 0.93;
const THIGH = 0.44;
const SHIN = 0.43;
const UARM = 0.29;
const FARM = 0.26;

export function Human({ tour, phoneRef, handRef }: { tour: Tour; phoneRef?: React.MutableRefObject<THREE.Object3D | null>; handRef?: React.MutableRefObject<THREE.Object3D | null> }) {
  const hand = useRef<THREE.Group>(null!);
  const root = useRef<THREE.Group>(null!);
  const pelvis = useRef<THREE.Group>(null!);
  const chest = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const thL = useRef<THREE.Group>(null!);
  const thR = useRef<THREE.Group>(null!);
  const knL = useRef<THREE.Group>(null!);
  const knR = useRef<THREE.Group>(null!);
  const shL = useRef<THREE.Group>(null!);
  const shR = useRef<THREE.Group>(null!);
  const elL = useRef<THREE.Group>(null!);
  const elR = useRef<THREE.Group>(null!);
  const phone = useRef<THREE.Group>(null!);
  const dbL = useRef<THREE.Group>(null!);
  const dbR = useRef<THREE.Group>(null!);

  const mat = useMemo(
    () => ({
      skin: new THREE.MeshStandardMaterial({ color: "#c98b62", roughness: 0.6 }),
      hair: new THREE.MeshStandardMaterial({ color: "#2a1a12", roughness: 0.55 }),
      top: new THREE.MeshStandardMaterial({ color: "#38BDF8", roughness: 0.55 }),
      jacket: new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.6 }),
      legs: new THREE.MeshStandardMaterial({ color: "#151a2e", roughness: 0.7 }),
      shoe: new THREE.MeshStandardMaterial({ color: "#f1f5f9", roughness: 0.5 }),
      sole: new THREE.MeshStandardMaterial({ color: "#38BDF8", roughness: 0.5 }),
      phone: new THREE.MeshStandardMaterial({ color: "#0b0f19", roughness: 0.25, metalness: 0.6 }),
      bag: new THREE.MeshStandardMaterial({ color: "#7c3aed", roughness: 0.6 }),
      iron: new THREE.MeshStandardMaterial({ color: "#2b3442", roughness: 0.4, metalness: 0.7 }),
      shadow: new THREE.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.4, depthWrite: false }),
    }),
    [],
  );
  const geo = useMemo(
    () => ({
      thigh: new THREE.CapsuleGeometry(0.075, THIGH - 0.1, 6, 12).translate(0, -THIGH / 2, 0),
      shin: new THREE.CapsuleGeometry(0.06, SHIN - 0.08, 6, 12).translate(0, -SHIN / 2, 0),
      uarm: new THREE.CapsuleGeometry(0.05, UARM - 0.08, 6, 10).translate(0, -UARM / 2, 0),
      farm: new THREE.CapsuleGeometry(0.042, FARM - 0.08, 6, 10).translate(0, -FARM / 2, 0),
      hand: new THREE.SphereGeometry(0.045, 12, 10),
      eye: new THREE.SphereGeometry(0.013, 10, 8),
      torso: new THREE.CapsuleGeometry(0.15, 0.3, 8, 16),
      hips: new THREE.CapsuleGeometry(0.135, 0.06, 6, 14).rotateZ(Math.PI / 2),
      neck: new THREE.CylinderGeometry(0.045, 0.05, 0.09, 12),
      head: new THREE.SphereGeometry(0.105, 24, 18),
      hair: new THREE.SphereGeometry(0.112, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      pony: new THREE.CapsuleGeometry(0.04, 0.16, 6, 10),
      shoe: new THREE.BoxGeometry(0.1, 0.07, 0.24),
      sole: new THREE.BoxGeometry(0.105, 0.02, 0.25),
      phone: new THREE.BoxGeometry(0.075, 0.155, 0.009),
      bag: new THREE.BoxGeometry(0.06, 0.32, 0.26),
      db: new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14).rotateZ(Math.PI / 2),
      bar: new THREE.CylinderGeometry(0.016, 0.016, 0.2, 8).rotateZ(Math.PI / 2),
    }),
    [],
  );

  useFrame(() => {
    const r = root.current;
    r.visible = tour.active;
    if (!tour.active) return;
    r.position.set(tour.x, 0, tour.z);
    r.rotation.y = tour.h;
    const w = tour.walk;
    const t = tour.t;
    const moving = tour.moving;
    const sw = Math.sin(w);
    const cw = Math.cos(w);
    let pelvisY = HIP_Y;
    let thighL = 0, thighR = 0, kneeL = 0.05, kneeR = 0.05;
    let shoulderL = 0, shoulderR = 0, elbowL = -0.15, elbowR = -0.15;
    let armOutL = -0.08, armOutR = 0.08;
    let headX = 0, chestX = 0.03, chestY = 0;
    let showPhone = false;
    let showDb = false;
    if (moving || Math.abs(sw) > 0.02) {
      const amp = 0.44;
      thighL = -amp * sw;
      thighR = amp * sw;
      // rodilla: se flexiona en el balanceo (pierna avanzando)
      kneeL = 0.08 + 0.75 * Math.pow(Math.max(0, cw), 1.6) + 0.12 * Math.max(0, -sw);
      kneeR = 0.08 + 0.75 * Math.pow(Math.max(0, -cw), 1.6) + 0.12 * Math.max(0, sw);
      shoulderL = 0.34 * sw;
      shoulderR = -0.34 * sw;
      elbowL = -0.3 - 0.18 * Math.max(0, -sw);
      elbowR = -0.3 - 0.18 * Math.max(0, sw);
      pelvisY = HIP_Y - 0.02 + 0.025 * Math.abs(cw) ;
      chestY = 0.08 * sw;
      chestX = 0.06;
    } else {
      const br = Math.sin(t * 1.6) * 0.012;
      chestX = 0.02 + br;
      shoulderL = 0.02;
      shoulderR = -0.02;
    }
    const ph = tour.phase;
    if (ph === "phone" || ph === "enrolled" || ph === "app" || ph === "food" || ph === "aviso" || (ph === "plan" && tour.phaseDur - tour.phaseT < 0.6)) {
      // sostiene el celular frente al rostro
      shoulderR = -0.95;
      elbowR = -1.35;
      armOutR = -0.12;
      headX = 0.28;
      showPhone = true;
    }
    if (ph === "training" || ph === "train" || ph === "coach") {
      // misma curva y mismo ciclo (5 s, ambos brazos) que el clip "Curl con mancuernas" del maniquí
      const flex = curlElbow(tour.t - tour.curl0);
      shoulderL = -0.12 - flex * 0.05;
      shoulderR = -0.12 - flex * 0.05;
      elbowL = -0.12 - flex;
      elbowR = -0.12 - flex;
      armOutL = -0.14;
      armOutR = 0.14;
      thighL = -0.05;
      thighR = -0.05;
      kneeL = 0.12;
      kneeR = 0.12;
      pelvisY = HIP_Y - 0.03;
      showDb = true;
    }
    if (tour.chapter === 3) {
      // Parte 3: abre la nevera, toma la bebida, la cierra, la lleva en la mano y la deja en el mostrador
      const pt = tour.phaseT;
      const L = (a: number, b: number, k: number) => a + (b - a) * k;
      const carry = (k: number) => {
        shoulderR = L(shoulderR, -0.32, k);
        elbowR = L(elbowR, -1.25, k);
        armOutR = L(armOutR, 0.1, k);
      };
      if (ph === "fridge") {
        const reach = ss(pt, FR.open0 - 0.4, FR.open0) * (1 - ss(pt, FR.open1, FR.open1 + 0.3));
        const inside = ss(pt, FR.open1, FR.open1 + 0.6) * (1 - ss(pt, FR.grab, FR.grab + 0.7));
        shoulderR = L(shoulderR, -1.0, reach);
        armOutR = L(armOutR, -0.25, reach);
        elbowR = L(elbowR, -0.5, reach);
        shoulderR = L(shoulderR, -1.38, inside);
        elbowR = L(elbowR, -0.12, inside);
        armOutR = L(armOutR, 0.02, inside);
        if (pt > FR.grab) carry(ss(pt, FR.grab, FR.grab + 0.7));
        const push = ss(pt, FR.close0 - 0.3, FR.close0 + 0.2) * (1 - ss(pt, FR.close1, FR.close1 + 0.5));
        shoulderL = L(shoulderL, -1.05, push);
        elbowL = L(elbowL, -0.35, push);
        armOutL = L(armOutL, 0.15, push);
        headX = 0.12 * inside;
      } else if (ph === "to_counter") {
        carry(1);
      } else if (ph === "scan") {
        const put = ss(pt, 0, SC.put) * (1 - ss(pt, SC.put + 0.1, SC.put + 0.8));
        carry(1 - ss(pt, SC.put, SC.put + 0.8));
        shoulderR = L(shoulderR, -0.95, put);
        elbowR = L(elbowR, -0.45, put);
        armOutR = L(armOutR, 0.05, put);
        chestX += 0.1 * put;
      }
    }
    pelvis.current.position.y = pelvisY;
    pelvis.current.rotation.y = -chestY * 0.6;
    chest.current.rotation.set(chestX, chestY, 0);
    head.current.rotation.set(headX, -chestY * 0.5, 0);
    thL.current.rotation.set(thighL, 0, 0.02);
    thR.current.rotation.set(thighR, 0, -0.02);
    knL.current.rotation.x = kneeL;
    knR.current.rotation.x = kneeR;
    shL.current.rotation.set(shoulderL, 0, armOutL);
    shR.current.rotation.set(shoulderR, 0, armOutR);
    elL.current.rotation.x = elbowL;
    elR.current.rotation.x = elbowR;
    phone.current.visible = showPhone;
    dbL.current.visible = showDb;
    dbR.current.visible = showDb;
    if (phoneRef) phoneRef.current = phone.current;
    if (handRef) handRef.current = hand.current;
  });

  return (
    <group ref={root} visible={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} material={mat.shadow}>
        <circleGeometry args={[0.38, 24]} />
      </mesh>
      <group ref={pelvis} position={[0, HIP_Y, 0]}>
        <mesh geometry={geo.hips} material={mat.legs} scale={[1, 1, 0.75]} />
        {/* piernas */}
        {([[thL, knL, -0.095], [thR, knR, 0.095]] as const).map(([th, kn, x], i) => (
          <group key={i} ref={th} position={[x, -0.02, 0]}>
            <mesh geometry={geo.thigh} material={mat.legs} />
            <group ref={kn} position={[0, -THIGH, 0]}>
              <mesh geometry={geo.shin} material={mat.legs} />
              <group position={[0, -SHIN - 0.02, 0.045]}>
                <mesh geometry={geo.shoe} material={mat.shoe} />
                <mesh geometry={geo.sole} material={mat.sole} position={[0, -0.04, 0]} />
              </group>
            </group>
          </group>
        ))}
        {/* torso */}
        <group ref={chest} position={[0, 0.06, 0]}>
          <mesh geometry={geo.torso} material={mat.top} position={[0, 0.27, 0]} scale={[1.18, 1, 0.72]} />
          <mesh geometry={geo.bag} material={mat.bag} position={[0.2, 0.15, -0.02]} rotation={[0, 0, 0.05]} />
          <mesh geometry={geo.neck} material={mat.skin} position={[0, 0.53, 0]} />
          <group ref={head} position={[0, 0.58, 0]}>
            <mesh geometry={geo.head} material={mat.skin} position={[0, 0.1, 0.005]} scale={[0.92, 1.08, 0.98]} />
            <mesh geometry={geo.eye} material={mat.hair} position={[-0.036, 0.115, 0.093]} />
            <mesh geometry={geo.eye} material={mat.hair} position={[0.036, 0.115, 0.093]} />
            <mesh geometry={geo.hair} material={mat.hair} position={[0, 0.115, -0.005]} rotation={[-0.25, 0, 0]} />
            <mesh geometry={geo.pony} material={mat.hair} position={[0, 0.07, -0.13]} rotation={[0.45, 0, 0]} />
          </group>
          {/* brazos */}
          {([[shL, elL, -0.2, false], [shR, elR, 0.2, true]] as const).map(([sh, el, x, right], i) => (
            <group key={i} ref={sh} position={[x, 0.44, 0]}>
              <mesh geometry={geo.uarm} material={mat.top} />
              <group ref={el} position={[0, -UARM, 0]}>
                <mesh geometry={geo.farm} material={mat.skin} />
                <mesh geometry={geo.hand} material={mat.skin} position={[0, -FARM - 0.02, 0]} />
                {right ? (
                  <>
                    <group ref={hand} position={[0, -FARM - 0.03, 0.035]} />
                    <group ref={phone} position={[0, -FARM - 0.04, 0.03]} rotation={[-0.25, 0, 0]}>
                      <mesh geometry={geo.phone} material={mat.phone} />
                    </group>
                    <group ref={dbR} position={[0, -FARM - 0.03, 0]}>
                      <mesh geometry={geo.bar} material={mat.iron} />
                      <mesh geometry={geo.db} material={mat.iron} position={[-0.1, 0, 0]} />
                      <mesh geometry={geo.db} material={mat.iron} position={[0.1, 0, 0]} />
                    </group>
                  </>
                ) : (
                  <group ref={dbL} position={[0, -FARM - 0.03, 0]}>
                    <mesh geometry={geo.bar} material={mat.iron} />
                    <mesh geometry={geo.db} material={mat.iron} position={[-0.1, 0, 0]} />
                    <mesh geometry={geo.db} material={mat.iron} position={[0.1, 0, 0]} />
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
