"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import type { JointId, Pose } from "../../lib/motionModel";

const SKIN = "#d7a286";
const HAIR = "#241c18";
const LIP = "#b56a58";

export function MotionStage({
  pose,
  selected,
  onSelect,
  view = "frente",
  className,
}: {
  pose: Pose;
  selected?: JointId | null;
  onSelect?: (id: JointId) => void;
  view?: "frente" | "perfil" | "espalda";
  className?: string;
}) {
  return (
    <div className={className || "h-full w-full"}>
      <Canvas camera={{ position: [0, 1.15, 3.15], fov: 34 }} gl={{ antialias: true }}>
        <color attach="background" args={["#0c1018"]} />
        <hemisphereLight args={["#fff4ea", "#1c2638", 0.65]} />
        <ambientLight intensity={0.28} />
        <directionalLight position={[2.4, 4.4, 2.8]} intensity={1.45} color="#fff8f2" />
        <directionalLight position={[-2.6, 2.2, -2.2]} intensity={0.55} color="#b9d4ff" />
        <CameraRig view={view} />
        <Human pose={pose} selected={selected || null} onSelect={onSelect} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[1.35, 48]} />
          <meshStandardMaterial color="#141b2a" roughness={0.95} />
        </mesh>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.45} scale={3.2} blur={2.4} far={1.6} />
      </Canvas>
    </div>
  );
}

function CameraRig({ view }: { view: "frente" | "perfil" | "espalda" }) {
  const { camera } = useThree();
  const controls = useRef<any>(null);
  useEffect(() => {
    const spots = {
      frente: [0, 1.12, 3.25],
      perfil: [3.25, 1.12, 0.15],
      espalda: [0, 1.12, -3.25],
    } as const;
    const p = spots[view];
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(0, 0.95, 0);
    controls.current?.target.set(0, 0.95, 0);
    controls.current?.update();
  }, [view, camera]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={1.7}
      maxDistance={5.4}
      maxPolarAngle={Math.PI * 0.85}
      target={[0, 0.95, 0]}
    />
  );
}

function Human({
  pose,
  selected,
  onSelect,
}: {
  pose: Pose;
  selected: JointId | null;
  onSelect?: (id: JointId) => void;
}) {
  const pick = (id: JointId) => onSelect?.(id);
  const hipA = ((pose["cadera-izq"].flex + pose["cadera-der"].flex) / 2) * Math.PI / 180;
  const kneeA = ((pose["rodilla-izq"].flex + pose["rodilla-der"].flex) / 2) * Math.PI / 180;
  const thigh = 0.42;
  const shinL = 0.4;
  const kneeY = -Math.cos(hipA) * thigh;
  const kneeZ = -Math.sin(hipA) * thigh;
  const total = hipA - kneeA;
  const footY = kneeY - Math.cos(total) * shinL;
  const footZ = kneeZ - Math.sin(total) * shinL;
  const rootY = 0.05 - footY;
  const rootZ = 0.04 - footZ;
  const columna = -pose.columna.flex * Math.PI / 180;
  const pecho = -pose.pecho.flex * Math.PI / 180;
  const cabeza = -pose.cabeza.flex * Math.PI / 180;
  return (
    <group position={[0, rootY, rootZ]}>
      <Oval args={[0.13, 0.09, 0.11]} position={[0, 0.02, 0]} onClick={() => pick("columna")} />
      <Oval args={[0.07, 0.06, 0.06]} position={[-0.045, -0.01, -0.07]} onClick={() => pick("columna")} />
      <Oval args={[0.07, 0.06, 0.06]} position={[0.045, -0.01, -0.07]} onClick={() => pick("columna")} />
      <group rotation={[columna, 0, 0]}>
        <Mark id="columna" selected={selected} onPick={pick} />
        <Oval args={[0.12, 0.1, 0.105]} position={[0, 0.11, 0.012]} onClick={() => pick("columna")} />
        <group position={[0, 0.2, 0]} rotation={[pecho, 0, 0]}>
          <Mark id="pecho" selected={selected} onPick={pick} />
          <Chest onClick={() => pick("pecho")} />
          <group position={[-0.22, 0.15, 0]}>
            <mesh>
              <sphereGeometry args={[0.055, 16, 12]} />
              <Skin />
            </mesh>
            <Down id="brazo-izq" flex={pose["brazo-izq"].flex} open={pose["brazo-izq"].open} openSign={-1} length={0.28} r0={0.048} r1={0.04} selected={selected} onPick={pick}>
              <Down id="codo-izq" flex={pose["codo-izq"].flex} length={0.25} r0={0.04} r1={0.032} selected={selected} onPick={pick}>
                <Hand side={-1} />
              </Down>
            </Down>
          </group>
          <group position={[0.22, 0.15, 0]}>
            <mesh>
              <sphereGeometry args={[0.055, 16, 12]} />
              <Skin />
            </mesh>
            <Down id="brazo-der" flex={pose["brazo-der"].flex} open={pose["brazo-der"].open} openSign={1} length={0.28} r0={0.048} r1={0.04} selected={selected} onPick={pick}>
              <Down id="codo-der" flex={pose["codo-der"].flex} length={0.25} r0={0.04} r1={0.032} selected={selected} onPick={pick}>
                <Hand side={1} />
              </Down>
            </Down>
          </group>
          <group position={[0, 0.2, 0]} rotation={[cabeza, 0, 0]}>
            <Mark id="cabeza" selected={selected} onPick={pick} />
            <mesh position={[0, 0.045, 0]} onClick={(e) => { e.stopPropagation(); pick("cabeza"); }}>
              <cylinderGeometry args={[0.048, 0.055, 0.09, 16]} />
              <Skin hot={selected === "cabeza"} />
            </mesh>
            <Head onClick={() => pick("cabeza")} />
          </group>
        </group>
      </group>
      <group position={[-0.09, -0.02, 0]}>
        <Down id="cadera-izq" hip flex={pose["cadera-izq"].flex} length={0.42} r0={0.075} r1={0.055} selected={selected} onPick={pick}>
          <Down id="rodilla-izq" knee flex={pose["rodilla-izq"].flex} length={0.4} r0={0.052} r1={0.038} selected={selected} onPick={pick}>
            <Foot />
          </Down>
        </Down>
      </group>
      <group position={[0.09, -0.02, 0]}>
        <Down id="cadera-der" hip flex={pose["cadera-der"].flex} length={0.42} r0={0.075} r1={0.055} selected={selected} onPick={pick}>
          <Down id="rodilla-der" knee flex={pose["rodilla-der"].flex} length={0.4} r0={0.052} r1={0.038} selected={selected} onPick={pick}>
            <Foot />
          </Down>
        </Down>
      </group>
    </group>
  );
}

function Chest({ onClick }: { onClick: () => void }) {
  return (
    <group position={[0, 0.13, 0]}>
      <Oval args={[0.16, 0.12, 0.11]} position={[0, 0, 0]} onClick={onClick} />
      <Oval args={[0.055, 0.04, 0.04]} position={[-0.055, 0.01, 0.07]} onClick={onClick} />
      <Oval args={[0.055, 0.04, 0.04]} position={[0.055, 0.01, 0.07]} onClick={onClick} />
    </group>
  );
}

function Head({ onClick }: { onClick: () => void }) {
  return (
    <group position={[0, 0.2, 0]} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh scale={[0.86, 1.02, 0.9]}>
        <sphereGeometry args={[0.118, 32, 24]} />
        <Skin />
      </mesh>
      <mesh position={[0, 0.05, -0.015]} scale={[0.98, 0.58, 0.88]}>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshStandardMaterial color={HAIR} roughness={0.78} />
      </mesh>
      <Brow x={-0.04} />
      <Brow x={0.04} />
      <Eye x={-0.04} />
      <Eye x={0.04} />
      <mesh position={[0, -0.002, 0.112]} rotation={[1.15, 0, 0]}>
        <coneGeometry args={[0.013, 0.038, 12]} />
        <Skin />
      </mesh>
      <mesh position={[0, -0.038, 0.1]} scale={[1.5, 0.38, 0.45]}>
        <sphereGeometry args={[0.018, 12, 8]} />
        <meshStandardMaterial color={LIP} roughness={0.45} />
      </mesh>
      <Ear x={-1} />
      <Ear x={1} />
    </group>
  );
}

function Eye({ x }: { x: number }) {
  return (
    <group position={[x, 0.018, 0.1]}>
      <mesh>
        <sphereGeometry args={[0.016, 14, 12]} />
        <meshStandardMaterial color="#f6f3ee" roughness={0.25} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <sphereGeometry args={[0.008, 10, 10]} />
        <meshStandardMaterial color="#2a211c" roughness={0.3} />
      </mesh>
    </group>
  );
}

function Brow({ x }: { x: number }) {
  return (
    <mesh position={[x, 0.042, 0.1]} rotation={[0, 0, x < 0 ? 0.3 : -0.3]}>
      <boxGeometry args={[0.03, 0.006, 0.008]} />
      <meshStandardMaterial color={HAIR} />
    </mesh>
  );
}

function Ear({ x }: { x: number }) {
  return (
    <mesh position={[x * 0.112, -0.005, 0]} scale={[0.35, 0.7, 0.45]}>
      <sphereGeometry args={[0.04, 12, 10]} />
      <Skin />
    </mesh>
  );
}

function Hand({ side }: { side: -1 | 1 }) {
  return (
    <group position={[0, -0.02, 0.012]}>
      <mesh scale={[0.62, 0.32, 0.9]}>
        <sphereGeometry args={[0.042, 16, 12]} />
        <Skin />
      </mesh>
      <mesh position={[0, -0.048, 0.008]} scale={[0.72, 0.42, 0.38]}>
        <sphereGeometry args={[0.036, 12, 10]} />
        <Skin />
      </mesh>
      <mesh position={[side * 0.03, -0.012, 0.02]} rotation={[0.4, 0, side * 0.6]} scale={[0.45, 0.7, 0.4]}>
        <sphereGeometry args={[0.024, 10, 8]} />
        <Skin />
      </mesh>
    </group>
  );
}

function Foot() {
  return (
    <group position={[0, -0.02, 0.045]}>
      <mesh scale={[0.72, 0.38, 1.25]}>
        <sphereGeometry args={[0.05, 16, 12]} />
        <Skin />
      </mesh>
      <mesh position={[0, -0.008, 0.055]} scale={[0.55, 0.28, 0.48]}>
        <sphereGeometry args={[0.038, 12, 10]} />
        <Skin />
      </mesh>
    </group>
  );
}

function Down({
  id, flex, open = 0, openSign = 1, knee = false, hip = false, length, r0, r1, selected, onPick, children,
}: {
  id: JointId;
  flex: number;
  open?: number;
  openSign?: number;
  knee?: boolean;
  hip?: boolean;
  length: number;
  r0: number;
  r1: number;
  selected: JointId | null;
  onPick: (id: JointId) => void;
  children?: ReactNode;
}) {
  const sign = hip ? 1 : -1;
  const x = sign * flex * Math.PI / 180;
  const z = openSign * open * Math.PI / 180;
  return (
    <group rotation={[x, 0, z]}>
      <Mark id={id} selected={selected} onPick={onPick} />
      <mesh position={[0, -length / 2, 0]} onClick={(e) => { e.stopPropagation(); onPick(id); }}>
        <cylinderGeometry args={[r0, r1, length, 20]} />
        <Skin hot={id === selected} />
      </mesh>
      <mesh position={[0, -length, 0]}>
        <sphereGeometry args={[r1 * 0.95, 14, 12]} />
        <Skin hot={id === selected} />
      </mesh>
      <group position={[0, -length, 0]}>{children}</group>
    </group>
  );
}

function Mark({ id, selected, onPick }: { id: JointId; selected: JointId | null; onPick: (id: JointId) => void }) {
  if (id !== selected) return null;
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} onClick={(e) => { e.stopPropagation(); onPick(id); }}>
      <torusGeometry args={[0.05, 0.008, 8, 24]} />
      <meshStandardMaterial color="#e7c14a" emissive="#e7c14a" emissiveIntensity={0.35} />
    </mesh>
  );
}

function Oval({
  args, position, onClick,
}: {
  args: [number, number, number];
  position: [number, number, number];
  onClick: () => void;
}) {
  return (
    <mesh position={position} scale={args} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <sphereGeometry args={[1, 24, 18]} />
      <Skin />
    </mesh>
  );
}

function Skin({ hot = false }: { hot?: boolean }) {
  return <meshStandardMaterial color={hot ? "#e4b08a" : SKIN} roughness={0.58} metalness={0.02} />;
}
