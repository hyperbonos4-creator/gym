"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, useAnimations } from "@react-three/drei";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import {
  Box3,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Quaternion,
  SphereGeometry,
  AnimationMixer,
  Line,
  LineBasicMaterial,
  LoopRepeat,
  DoubleSide,
  FrontSide,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Raycaster,
  Vector2,
  type AnimationClip,
  type Group,
  type Material,
  type Object3D,
  type SkinnedMesh,
  Vector3,
} from "three";
import { muscleCueFor, muscleId, muscleName, muscleNote, atlasRole, type AnatomyMode } from "../../lib/motion-studio/muscles";
import {
  ANATOMY_FILE,
  MOTION_PROP_NAMES,
  type MotionAngles,
  type MotionRigReport,
} from "../../lib/motion-studio/models";

const NO_CLIPS: AnimationClip[] = [];
const PROP_NAMES = new Set(MOTION_PROP_NAMES);

type MotionStudioAvatarProps = {
  src: string;
  scale?: number;
  y?: number;
  play: string[];
  show: string[];
  clipKey?: string;
  anatomyMode?: AnatomyMode;
  /** true = atlas con ecorché real (músculos). false = editor con el maniquí gris. */
  atlas?: boolean;
  playing?: boolean;
  playbackRate?: number;
  /** 0–1 mientras se arrastra la línea de tiempo. Null sigue la reproducción. */
  scrub?: number | null;
  ghost?: boolean;
  onRigReport?: (report: MotionRigReport) => void;
  onLoadError?: (message: string) => void;
  onProgress?: (ratio: number | null) => void;
  onClock?: (time: number, duration: number) => void;
  onAngles?: (angles: MotionAngles) => void;
  onMuscleSelect?: (id: string | null) => void;
};

function inspectRig(scene: Object3D, clips: AnimationClip[], src: string): MotionRigReport {
  const boneNames = new Set<string>();
  const clipReports: MotionRigReport["clips"] = [];
  let meshCount = 0;
  let skinnedMeshCount = 0;

  scene.traverse((node) => {
    const skinned = node as SkinnedMesh;
    if (skinned.isSkinnedMesh) {
      skinnedMeshCount += 1;
      meshCount += 1;
    } else if ((node as { isMesh?: boolean }).isMesh) {
      meshCount += 1;
    }
    if ((node as { isBone?: boolean }).isBone) boneNames.add(node.name || "(hueso sin nombre)");
  });

  for (const clip of clips) {
    const matchingTrackCount = clip.tracks.filter((track) => {
      const target = track.name.split(".")[0]?.replace(/^\.root\./, "");
      return boneNames.has(target);
    }).length;
    clipReports.push({
      name: clip.name || "Animación sin nombre",
      durationSeconds: Number.isFinite(clip.duration) ? Math.max(0, clip.duration) : 0,
      trackCount: clip.tracks.length,
      tracksMatchingBones: matchingTrackCount,
    });
  }

  let heightInSceneUnits: number | null = null;
  try {
    const bounds = new Box3().setFromObject(scene);
    const size = new Vector3();
    bounds.getSize(size);
    if (Number.isFinite(size.y) && size.y > 0) heightInSceneUnits = Number(size.y.toFixed(3));
  } catch {
    heightInSceneUnits = null;
  }

  const warnings: string[] = [];
  if (skinnedMeshCount === 0) warnings.push("No hay una malla unida al esqueleto. Este GLB todavía no sirve para mover el cuerpo.");
  if (boneNames.size === 0) warnings.push("No hay huesos. No es un avatar articulado.");
  if (clips.length === 0) warnings.push("El GLB no trae clips. Las poses de la tienda pueden ser archivos aparte, no un ejercicio en bucle.");
  if (clips.length > 0 && clipReports.every((clip) => clip.tracksMatchingBones === 0)) {
    warnings.push("Hay clips, pero sus pistas no coinciden con los nombres de los huesos. Hay que revisar el rig antes de reproducirlos.");
  }
  if (heightInSceneUnits !== null && (heightInSceneUnits < 0.25 || heightInSceneUnits > 10)) {
    warnings.push("La altura del archivo se sale de lo esperado. Hay que revisar escala y unidades.");
  }

  return {
    src,
    rootName: scene.name || "Scene",
    meshCount,
    skinnedMeshCount,
    boneCount: boneNames.size,
    boneNames: [...boneNames].sort((a, b) => a.localeCompare(b)),
    heightInSceneUnits,
    clips: clipReports,
    warnings,
  };
}

function owningProp(node: Object3D) {
  let current: Object3D | null = node;
  while (current) {
    if (PROP_NAMES.has(current.name)) return current.name;
    current = current.parent;
  }
  return null;
}

function applyProps(root: Object3D, show: string[]) {
  const visible = new Set(show);
  root.traverse((node) => {
    const mesh = node as SkinnedMesh;
    if (!mesh.isMesh) return;
    if (mesh.isSkinnedMesh) {
      if (mesh.name.startsWith("musculo_") || mesh.name.startsWith("superficie_")) return;
      mesh.visible = true;
      return;
    }
    const owner = owningProp(mesh);
    mesh.visible = owner !== null && visible.has(owner);
  });
}

const jointA = new Vector3();
const jointB = new Vector3();
const jointC = new Vector3();

function jointDegrees(root: Object3D, hip: string, joint: string, end: string) {
  const a = root.getObjectByName(hip);
  const b = root.getObjectByName(joint);
  const c = root.getObjectByName(end);
  if (!a || !b || !c) return null;
  a.getWorldPosition(jointA);
  b.getWorldPosition(jointB);
  c.getWorldPosition(jointC);
  const u = jointA.sub(jointB).normalize();
  const v = jointC.sub(jointB).normalize();
  const dot = Math.max(-1, Math.min(1, u.dot(v)));
  return Math.round((Math.acos(dot) * 180) / Math.PI);
}

type LookKind = "plain" | "studio" | "skin" | "plate" | "fiber" | "glass";

const FACE_OUT = "if (dot(normal, normalize(vViewPosition)) < 0.0) normal = -normal;";

function compileLook(material: MeshStandardMaterial, kind: LookKind) {
  const plateHot = (material.userData.plateHot ??= { value: 0 }) as { value: number };
  const fiberHot = (material.userData.fiberHot ??= { value: 0 }) as { value: number };
  const glassMix = (material.userData.glassMix ??= { value: 0 }) as { value: number };
  const hooks = (material.userData.lookHooks ??= {}) as Partial<Record<LookKind, (shader: { uniforms: Record<string, { value: number }>; vertexShader: string; fragmentShader: string }) => void>>;
  hooks.plain ??= () => {};
  hooks.studio ??= (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>\n${FACE_OUT}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float sky = clamp(normal.y * 0.55 + 0.5, 0.0, 1.0);
        diffuseColor.rgb *= mix(0.78, 1.06, sky);`,
      );
  };
  hooks.skin ??= (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed -= normalize(normal) * 0.012;",
    );
  };
  hooks.plate ??= (shader) => {
    shader.uniforms.plateHot = plateHot;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPlatePos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPlatePos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float plateHot;\nvarying vec3 vPlatePos;")
      .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>\n${FACE_OUT}`)
      .replace(
        "#include <color_fragment>",
        `float strand = abs(sin(dot(vPlatePos, vec3(18.0, 40.0, 12.0))));
        float grain = 0.93 + 0.07 * strand;
        vec3 ink = vec3(0.46, 0.49, 0.53);
        vec3 paper = vec3(0.66, 0.69, 0.73);
        vec3 line = mix(ink, paper, 0.65) * grain;
        vec3 blush = vec3(0.72, 0.40, 0.36);
        vec3 coral = vec3(0.86, 0.24, 0.18);
        vec3 tint = mix(line, blush, smoothstep(0.0, 0.7, plateHot));
        diffuseColor.rgb = mix(tint, coral, smoothstep(0.55, 1.0, plateHot));`,
      );
  };
  hooks.fiber ??= (shader) => {
    shader.uniforms.fiberHot = fiberHot;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFiberPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFiberPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float fiberHot;\nvarying vec3 vFiberPos;")
      .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>\n${FACE_OUT}`)
      .replace(
        "#include <color_fragment>",
        `float strand = abs(sin(dot(vFiberPos, vec3(22.0, 48.0, 16.0))));
        float grain = 0.8 + 0.2 * abs(sin(vFiberPos.y * 36.0 + vFiberPos.x * 12.0));
        vec3 hot = vec3(0.96, 0.26, 0.20);
        vec3 cool = vec3(0.58, 0.18, 0.30);
        vec3 flesh = mix(cool, hot, fiberHot);
        diffuseColor.rgb = mix(flesh * 0.62, flesh, smoothstep(0.08, 0.9, strand)) * grain;`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 1.65);
        vec3 glow = mix(vec3(0.42, 0.10, 0.24), vec3(1.0, 0.28, 0.18), fiberHot);
        totalEmissiveRadiance += glow * (0.22 + fres * 0.38) + vec3(0.12, 0.48, 0.72) * fres * 0.28;`,
      );
  };
  hooks.glass ??= (shader) => {
    shader.uniforms.glassMix = glassMix;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed -= normalize(normal) * 0.006;",
    );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float glassMix;")
      .replace("#include <normal_fragment_begin>", `#include <normal_fragment_begin>\n${FACE_OUT}`)
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float bodyFres = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 1.7);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.7, 0.92, 1.0), bodyFres * glassMix);`,
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float rimLight = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 1.4);
        totalEmissiveRadiance += vec3(0.35, 0.86, 1.0) * rimLight * glassMix * 1.7;`,
      );
  };
  material.userData.look = `${kind}-6`;
  material.customProgramCacheKey = () => String(material.userData.look);
  material.onBeforeCompile = hooks[kind] as MeshStandardMaterial["onBeforeCompile"];
  material.needsUpdate = true;
}

function toneMuscles(root: Object3D, clipKey: string, anatomyMode: AnatomyMode) {
  const cue = anatomyMode === "anatomia" ? muscleCueFor(clipKey) : null;
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const id = muscleId(mesh.name);
    if (!id) return;
    const role = cue && mesh.name.startsWith("musculo_")
      ? cue.primary.includes(id)
        ? "primary"
        : cue.secondary.includes(id)
          ? "secondary"
          : null
      : null;
    mesh.visible = role !== null;
    if (!role) return;
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
    if (!source?.isMeshStandardMaterial) return;
    const colored = (mesh.userData.fiberMat as MeshStandardMaterial | undefined) ?? source.clone();
    colored.side = DoubleSide;
    colored.vertexColors = false;
    colored.transparent = false;
    colored.opacity = 1;
    colored.depthWrite = true;
    colored.roughness = 0.42;
    colored.metalness = 0;
    colored.polygonOffset = true;
    colored.polygonOffsetFactor = -3;
    colored.polygonOffsetUnits = -3;
    compileLook(colored, "fiber");
    (colored.userData.fiberHot as { value: number }).value = role === "primary" ? 1 : 0.38;
    mesh.renderOrder = role === "primary" ? 4 : 3;
    mesh.userData.fiberMat = colored;
    mesh.material = colored;
  });
}

function toneBody(root: Object3D, atlas: boolean, anatomyMode: AnatomyMode) {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || mesh.name !== "cuerpo") return;
    mesh.visible = true;
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
    if (!source?.isMeshStandardMaterial) return;
    const colored = (mesh.userData.bodyMat as MeshStandardMaterial | undefined) ?? source.clone();
    colored.vertexColors = false;
    colored.emissive = new Color("#000000");
    colored.emissiveIntensity = 0;
    colored.side = FrontSide;
    colored.opacity = 1;
    if (!atlas) {
      colored.color = new Color("#6c737c");
      colored.roughness = 0.46;
      colored.metalness = 0.18;
      colored.transparent = false;
      colored.depthWrite = true;
      colored.polygonOffset = false;
      compileLook(colored, "plain");
    } else if (anatomyMode === "anatomia") {
      const glass = (mesh.userData.glassMat as MeshPhysicalMaterial | undefined) ?? new MeshPhysicalMaterial({
        color: "#e7f3fb",
        roughness: 0.08,
        metalness: 0,
        transmission: 0.68,
        thickness: 1.15,
        ior: 1.4,
        attenuationColor: "#8ec4e0",
        attenuationDistance: 0.55,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        emissive: "#0e4a66",
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 1,
        side: FrontSide,
        depthWrite: true,
      });
      mesh.userData.glassMat = glass;
      mesh.material = glass;
      mesh.renderOrder = 0;
      return;
    } else {
      colored.color = new Color("#8b939c");
      colored.roughness = 0.5;
      colored.metalness = 0.06;
      colored.emissive = new Color("#000000");
      colored.emissiveIntensity = 0;
      colored.transparent = false;
      colored.opacity = 1;
      colored.depthWrite = true;
      colored.polygonOffset = false;
      compileLook(colored, "plain");
      mesh.renderOrder = 0;
    }
    mesh.userData.bodyMat = colored;
    mesh.material = colored;
  });
}

const GUIDE_BONES = ["upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r"] as const;
const guideRay = new Raycaster();
const guideNdc = new Vector2();
const guideTmp = new Vector3();

const BONE_LINKS = [
  ["pelvis", "spine_01"],
  ["spine_01", "spine_02"],
  ["spine_02", "spine_03"],
  ["spine_03", "neck_01"],
  ["spine_03", "clavicle_l"],
  ["clavicle_l", "upperarm_l"],
  ["upperarm_l", "lowerarm_l"],
  ["lowerarm_l", "hand_l"],
  ["spine_03", "clavicle_r"],
  ["clavicle_r", "upperarm_r"],
  ["upperarm_r", "lowerarm_r"],
  ["lowerarm_r", "hand_r"],
  ["pelvis", "thigh_l"],
  ["thigh_l", "calf_l"],
  ["calf_l", "foot_l"],
  ["pelvis", "thigh_r"],
  ["thigh_r", "calf_r"],
  ["calf_r", "foot_r"],
] as const;

const boneUp = new Vector3(0, 1, 0);
const boneQuat = new Quaternion();

function SkeletonFigure({ root, active, tone }: { root: Object3D; active: boolean; tone: "glass" | "bone" }) {
  const holder = useRef<Group>(null);
  const rods = useRef<Array<Mesh | null>>([]);
  const joints = useRef<Array<Mesh | null>>([]);
  const jointNames = useMemo(() => [...new Set(BONE_LINKS.flat())], []);
  const rodGeo = useMemo(() => new CylinderGeometry(0.016, 0.011, 1, 10), []);
  const jointGeo = useMemo(() => new SphereGeometry(0.022, 16, 12), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: "#d7eef8",
        emissive: "#1a7ea0",
        emissiveIntensity: 0.8,
        roughness: 0.22,
        metalness: 0.42,
      }),
    [],
  );
  const ribMaterial = useMemo(() => new LineBasicMaterial({ color: "#8ee7ff", transparent: true, opacity: 0.9 }), []);
  const ribLines = useMemo(() => Array.from({ length: 12 }, () => new Line(new BufferGeometry(), ribMaterial)), [ribMaterial]);

  useEffect(() => {
    if (tone === "bone") {
      material.color.set("#eadfce");
      material.emissive.set("#6a5340");
      material.emissiveIntensity = 0.22;
      ribMaterial.color.set("#f0e2cf");
      return;
    }
    material.color.set("#d7eef8");
    material.emissive.set("#1a7ea0");
    material.emissiveIntensity = 0.7;
    material.transparent = true;
    material.opacity = 0.42;
    material.depthWrite = false;
    ribMaterial.color.set("#8ee7ff");
    ribMaterial.opacity = 0.55;
  }, [material, ribMaterial, tone]);

  useFrame(() => {
    const group = holder.current;
    if (!group || !active) return;
    BONE_LINKS.forEach(([from, to], index) => {
      const rod = rods.current[index];
      const start = root.getObjectByName(from);
      const end = root.getObjectByName(to);
      if (!rod || !start || !end) {
        if (rod) rod.visible = false;
        return;
      }
      start.getWorldPosition(guideTmp);
      const a = group.worldToLocal(guideTmp.clone());
      end.getWorldPosition(guideTmp);
      const b = group.worldToLocal(guideTmp.clone());
      const delta = b.clone().sub(a);
      const length = delta.length();
      if (length < 0.001) {
        rod.visible = false;
        return;
      }
      rod.visible = true;
      rod.position.copy(a).add(b).multiplyScalar(0.5);
      rod.quaternion.copy(boneQuat.setFromUnitVectors(boneUp, delta.multiplyScalar(1 / length)));
      const girth = tone === "glass" ? 0.36 : 1;
      rod.scale.set(girth, length, girth);
    });
    jointNames.forEach((name, index) => {
      const joint = joints.current[index];
      const bone = root.getObjectByName(name);
      if (!joint || !bone) return;
      bone.getWorldPosition(guideTmp);
      joint.position.copy(group.worldToLocal(guideTmp.clone()));
      joint.visible = true;
      const jointScale = tone === "glass" ? 0.55 : 1;
      joint.scale.setScalar((name.startsWith("spine") || name === "pelvis" ? 1.35 : 1) * jointScale);
    });
    const chest = root.getObjectByName("spine_03");
    const waist = root.getObjectByName("spine_02");
    const clavicle = root.getObjectByName("clavicle_l");
    if (!chest || !waist || !clavicle) return;
    chest.getWorldPosition(guideTmp);
    const chestLocal = group.worldToLocal(guideTmp.clone());
    waist.getWorldPosition(guideTmp);
    const waistLocal = group.worldToLocal(guideTmp.clone());
    clavicle.getWorldPosition(guideTmp);
    const shoulder = group.worldToLocal(guideTmp.clone());
    const up = chestLocal.clone().sub(waistLocal);
    if (up.length() < 0.001) return;
    up.normalize();
    const lateral = shoulder.clone().sub(chestLocal);
    lateral.addScaledVector(up, -lateral.dot(up));
    if (lateral.length() < 0.001) return;
    lateral.normalize();
    const forward = new Vector3().crossVectors(lateral, up).normalize();
    for (let rib = 0; rib < 6; rib += 1) {
      const center = waistLocal.clone().lerp(chestLocal, 0.15 + rib * 0.13);
      const width = 0.11 + rib * 0.012;
      for (const side of [-1, 1]) {
        const line = ribLines[rib * 2 + (side < 0 ? 0 : 1)];
        const points: Vector3[] = [];
        for (let step = 0; step <= 7; step += 1) {
          const t = step / 7;
          const angle = t * Math.PI * 0.72;
          points.push(
            center
              .clone()
              .addScaledVector(lateral, Math.sin(angle) * width * side)
              .addScaledVector(forward, (Math.cos(angle) - 1) * 0.045)
              .addScaledVector(up, -0.012 * t),
          );
        }
        line.geometry.setFromPoints(points);
      }
    }
  });

  if (!active) return null;

  return (
    <group ref={holder}>
      {BONE_LINKS.map(([from, to], index) => (
        <mesh
          key={`${from}-${to}`}
          ref={(node) => {
            rods.current[index] = node;
          }}
          geometry={rodGeo}
          material={material}
        />
      ))}
      {jointNames.map((name, index) => (
        <mesh
          key={name}
          ref={(node) => {
            joints.current[index] = node;
          }}
          geometry={jointGeo}
          material={material}
        />
      ))}
      {ribLines.map((line, index) => (
        <primitive key={index} object={line} />
      ))}
    </group>
  );
}

function AtlasGuides({
  root,
  clock,
  onSelect,
}: {
  root: Object3D;
  clock: { time: number };
  onSelect?: (id: string | null) => void;
}) {
  const anchor = useRef<Group>(null);
  const dots = useRef<Array<Mesh | null>>([]);
  const trails = useRef<[Vector3[], Vector3[]]>([[], []]);
  const previous = useRef(0);
  const label = useRef<Vector3 | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const lines = useMemo(() => {
    const material = new LineBasicMaterial({ color: "#3e8fb3", transparent: true, opacity: 0.8 });
    return [0, 1].map(() => new Line(new BufferGeometry(), material));
  }, []);
  const { camera, gl } = useThree();

  useEffect(() => {
    const element = gl.domElement;
    const choose = (event: PointerEvent) => {
      const rect = element.getBoundingClientRect();
      guideNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      guideNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      guideRay.setFromCamera(guideNdc, camera);
      const hit = guideRay.intersectObject(root, true).find((item) => muscleId(item.object.name));
      const id = hit ? muscleId(hit.object.name) : null;
      const holder = anchor.current;
      if (hit && holder) {
        label.current = holder.worldToLocal(hit.point.clone());
      } else {
        label.current = null;
      }
      setPicked(id);
      onSelect?.(id);
    };
    element.addEventListener("pointerdown", choose);
    return () => element.removeEventListener("pointerdown", choose);
  }, [camera, gl, onSelect, root]);

  useFrame(() => {
    const holder = anchor.current;
    if (!holder) return;
    if (clock.time + 0.05 < previous.current) {
      trails.current = [[], []];
      for (const line of lines) line.geometry.setFromPoints([]);
    }
    previous.current = clock.time;
    GUIDE_BONES.forEach((name, index) => {
      const bone = root.getObjectByName(name);
      const dot = dots.current[index];
      if (!bone || !dot) return;
      bone.getWorldPosition(guideTmp);
      dot.position.copy(holder.worldToLocal(guideTmp.clone()));
      if (name.startsWith("hand_")) {
        const side = name.endsWith("_l") ? 0 : 1;
        const trail = trails.current[side];
        const last = trail[trail.length - 1];
        if (!last || last.distanceTo(dot.position) > 0.02) {
          const closed = trail.length > 24 && trail[0].distanceTo(dot.position) < 0.035;
          if (!closed) {
            trail.push(dot.position.clone());
            if (trail.length > 180) trail.shift();
            if (trail.length >= 2) lines[side].geometry.setFromPoints(trail);
          }
        }
      }
    });
  });

  return (
    <group ref={anchor}>
      {GUIDE_BONES.map((name, index) => (
        <mesh
          key={name}
          ref={(node) => {
            dots.current[index] = node;
          }}
        >
          <sphereGeometry args={[name.startsWith("hand_") ? 0.011 : 0.015, 12, 12]} />
          <meshBasicMaterial color="#3e8fb3" transparent opacity={0.92} />
        </mesh>
      ))}
      <primitive object={lines[0]} />
      <primitive object={lines[1]} />
      {picked && label.current && (
        <Html position={label.current} center distanceFactor={3.2} style={{ pointerEvents: "none" }}>
          <div className="rounded-full border border-[#3e8fb3]/50 bg-[#0c1018]/90 px-2 py-1 text-[11px] font-semibold text-white shadow-lg">
            {muscleName(picked)}
            <div className="font-normal text-white/70">{muscleNote(picked)}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function faceMusclesOut(root: Object3D) {
  const center = new Vector3(0, 0.9, 0);
  const point = new Vector3();
  const normal = new Vector3();
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.name.startsWith("musculo_")) return;
    const geo = mesh.geometry;
    if (geo.userData.facedOut) return;
    geo.userData.facedOut = true;
    const pos = geo.getAttribute("position");
    const norms = geo.getAttribute("normal");
    if (!pos || !norms) return;
    let facing = 0;
    const step = Math.max(1, Math.floor(pos.count / 90));
    for (let i = 0; i < pos.count; i += step) {
      point.fromBufferAttribute(pos, i);
      normal.fromBufferAttribute(norms, i);
      facing += normal.dot(point.sub(center));
    }
    if (facing >= 0) return;
    for (let i = 0; i < norms.count; i += 1) {
      norms.setXYZ(i, -norms.getX(i), -norms.getY(i), -norms.getZ(i));
    }
    norms.needsUpdate = true;
    const index = geo.getIndex();
    if (!index) return;
    for (let i = 0; i < index.count; i += 3) {
      const swap = index.getX(i);
      index.setX(i, index.getX(i + 2));
      index.setX(i + 2, swap);
    }
    index.needsUpdate = true;
  });
}

function paintAtlas(root: Object3D, clipKey: string, anatomyMode: AnatomyMode) {
  const cue = muscleCueFor(clipKey);
  const glass = anatomyMode === "anatomia";
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh || !mesh.name.startsWith("musculo_")) return;
    const lowName = mesh.name.toLowerCase();
    // El trapecio descendente y el esternocleidomastoideo no se sientan en este
    // cráneo: quedan como cuernos. El resto del trapecio sigue visible.
    if (lowName.includes("sternocleidomastoid") || lowName.includes("descending part of trapezius")) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    const source = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as MeshStandardMaterial;
    if (!source?.isMeshStandardMaterial) return;
    const colored = (mesh.userData.atlasMat as MeshStandardMaterial | undefined) ?? source.clone();
    // Una mitad del GLB trae las caras hacia adentro. Dibujar ambos lados
    // evita el hueco negro sin voltear el músculo que sí estaba bien.
    colored.side = DoubleSide;
    colored.vertexColors = false;
    const role = atlasRole(mesh.name, cue);
    const heat = role === "primary" ? 1 : role === "secondary" ? 0.62 : 0;
    colored.roughness = glass ? 0.42 : 0.62;
    colored.metalness = 0;
    colored.transparent = false;
    colored.opacity = 1;
    colored.depthWrite = true;
    colored.polygonOffset = !glass;
    colored.polygonOffsetFactor = glass ? 0 : -2;
    colored.polygonOffsetUnits = glass ? 0 : -2;
    colored.color = new Color(glass ? "#c45a52" : "#8d939b");
    colored.emissive = new Color("#000000");
    colored.emissiveIntensity = 0;
    compileLook(colored, glass ? "fiber" : "plate");
    (colored.userData.fiberHot as { value: number }).value = glass ? (role === "primary" ? 1 : role === "secondary" ? 0.55 : 0.22) : 0;
    (colored.userData.plateHot as { value: number }).value = glass ? 0 : heat;
    mesh.renderOrder = role === "primary" ? 3 : 2;
    mesh.userData.atlasMat = colored;
    mesh.material = colored;
  });
}

function RealAnatomy({
  clipKey,
  anatomyMode,
  play,
  clockRef,
}: {
  clipKey: string;
  anatomyMode: AnatomyMode;
  play: string[];
  clockRef: React.MutableRefObject<{ time: number; duration: number }>;
}) {
  const [gltf, setGltf] = useState<GLTF | null>(null);
  useEffect(() => {
    const loader = new GLTFLoader();
    let dead = false;
    loader.load(ANATOMY_FILE, (parsed) => {
      if (dead) return;
      faceMusclesOut(parsed.scene);
      setGltf(parsed);
    });
    return () => {
      dead = true;
    };
  }, []);
  const scene = gltf?.scene ?? null;
  const mixer = useMemo(() => (scene ? new AnimationMixer(scene) : null), [scene]);
  const playKey = play.join("|");
  useEffect(() => {
    if (!mixer || !gltf) return;
    mixer.stopAllAction();
    for (const name of play) {
      const clip = gltf.animations.find((c) => c.name === name);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset();
        action.play();
      }
    }
  }, [mixer, gltf, playKey]);
  useEffect(() => {
    if (scene) paintAtlas(scene, clipKey, anatomyMode);
  }, [scene, clipKey, anatomyMode]);
  useFrame(() => {
    if (mixer) mixer.setTime(clockRef.current.time);
  });
  if (!scene) return null;
  return <primitive object={scene} />;
}

function paintGhost(root: Object3D) {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.name.startsWith("superficie_") || mesh.name.startsWith("musculo_")) {
      mesh.visible = false;
      return;
    }
    const source = mesh.material;
    const materials = (Array.isArray(source) ? source : [source]).map((material) => {
      const next = material.clone();
      next.transparent = true;
      next.opacity = 0.2;
      next.depthWrite = false;
      const colored = next as Material & { color?: Color };
      if (colored.color) colored.color = new Color("#b7c7d6");
      return next;
    });
    mesh.material = Array.isArray(source) ? materials : materials[0];
  });
}

export default function MotionStudioAvatar({
  src,
  scale = 1,
  y = 0,
  play,
  show,
  clipKey = "",
  anatomyMode = "superficie",
  atlas = false,
  playing = false,
  playbackRate = 1,
  scrub = null,
  ghost = false,
  onRigReport,
  onLoadError,
  onProgress,
  onClock,
  onAngles,
  onMuscleSelect,
}: MotionStudioAvatarProps) {
  const mount = useRef<Group>(null);
  const clockRef = useRef({ time: 0, duration: 1 });
  const uiRef = useRef(0);
  const [loaded, setLoaded] = useState<GLTF | null>(null);

  const playKey = play.join("|");
  const showKey = show.join("|");

  useEffect(() => {
    let dead = false;
    setLoaded(null);
    onProgress?.(0);
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    MeshoptDecoder.ready
      .then(() => fetch(src))
      .then((res) => {
        if (!res.ok) throw new Error(`El archivo respondió ${res.status}.`);
        const total = Number(res.headers.get("content-length") || 0);
        const reader = res.body?.getReader();
        if (!reader) return res.arrayBuffer();
        const chunks: Uint8Array[] = [];
        let received = 0;
        const pump = async (): Promise<ArrayBuffer> => {
          const step = await reader.read();
          if (step.done) {
            const buffer = new Uint8Array(received);
            let offset = 0;
            for (const chunk of chunks) {
              buffer.set(chunk, offset);
              offset += chunk.length;
            }
            return buffer.buffer;
          }
          chunks.push(step.value);
          received += step.value.length;
          if (!dead) onProgress?.(total > 0 ? received / total : null);
          return pump();
        };
        return pump();
      })
      .then(
        (buffer) =>
          new Promise<GLTF>((resolve, reject) => {
            loader.parse(buffer, "", resolve, (err) => reject(err));
          }),
      )
      .then((parsed) => {
        if (dead) return;
        setLoaded(parsed);
        onProgress?.(1);
      })
      .catch((err: unknown) => {
        if (dead) return;
        const message = err instanceof Error ? err.message : "No se pudo leer el GLB.";
        onLoadError?.(message);
        onProgress?.(null);
      });
    return () => {
      dead = true;
    };
  }, [onLoadError, onProgress, src]);

  const avatarScene = loaded?.scene ?? null;
  const animations = loaded?.animations ?? NO_CLIPS;
  const report = useMemo(
    () => (avatarScene ? inspectRig(avatarScene, animations, src) : null),
    [avatarScene, animations, src],
  );
  const { actions, mixer } = useAnimations(animations, mount);
  const ghostScene = useMemo(() => {
    if (!ghost || !avatarScene) return null;
    const copy = cloneSkeleton(avatarScene);
    paintGhost(copy);
    return copy;
  }, [avatarScene, ghost]);
  const ghostMixer = useMemo(() => (ghostScene ? new AnimationMixer(ghostScene) : null), [ghostScene]);

  useEffect(() => {
    if (report) onRigReport?.(report);
  }, [onRigReport, report]);

  useEffect(() => {
    if (!avatarScene) return;
    // El rig gris queda siempre montado: solo sirve de soporte de los
    // implementos (mancuernas, barra). El cuerpo se oculta en toneBody.
    avatarScene.visible = true;
    applyProps(avatarScene, show);
    toneMuscles(avatarScene, clipKey, anatomyMode);
    toneBody(avatarScene, atlas, anatomyMode);
    if (ghostScene) applyProps(ghostScene, show);
  }, [avatarScene, ghostScene, showKey, show, clipKey, anatomyMode, atlas]);

  useEffect(() => {
    if (!ghostMixer || !ghostScene) return;
    const clips = animations.filter((clip) => play.includes(clip.name));
    for (const clip of clips) {
      const action = ghostMixer.clipAction(clip, ghostScene);
      action.reset();
      action.setLoop(LoopRepeat, Infinity);
      action.play();
    }
    return () => {
      ghostMixer.stopAllAction();
    };
  }, [animations, ghostMixer, ghostScene, playKey, play]);

  useEffect(() => {
    const active = play
      .map((name) => actions[name])
      .filter((action): action is NonNullable<typeof action> => Boolean(action));
    for (const action of Object.values(actions)) {
      if (action && !active.includes(action)) action.stop();
    }
    if (active.length === 0) return;
    const duration = Math.max(...active.map((action) => action.getClip().duration), 0.01);
    clockRef.current.duration = duration;
    for (const action of active) {
      action.reset();
      action.enabled = true;
      action.setLoop(LoopRepeat, Infinity);
      action.play();
    }
    mixer.setTime(0);
    clockRef.current.time = 0;
    return () => {
      for (const action of active) action.stop();
    };
  }, [actions, mixer, playKey, play]);

  useEffect(() => {
    const active = play
      .map((name) => actions[name])
      .filter((action): action is NonNullable<typeof action> => Boolean(action));
    for (const action of active) {
      action.timeScale = playbackRate;
      action.paused = !playing || scrub !== null;
    }
  }, [actions, play, playbackRate, playing, scrub]);

  useEffect(() => {
    if (scrub === null) return;
    const duration = clockRef.current.duration;
    const time = Math.max(0, Math.min(duration, scrub * duration));
    mixer.setTime(time);
    clockRef.current.time = time;
  }, [mixer, scrub]);

  useFrame(() => {
    const duration = clockRef.current.duration;
    const lead = actions[play[0]];
    const time = scrub === null ? (lead ? lead.time % duration : 0) : scrub * duration;
    clockRef.current.time = time;
    if (ghostMixer) {
      const behind = time - 0.45;
      ghostMixer.setTime(behind < 0 ? behind + duration : behind);
    }
    const now = performance.now();
    if (now - uiRef.current < 120) return;
    uiRef.current = now;
    onClock?.(time, duration);
    if (!avatarScene) return;
    onAngles?.({
      kneeL: jointDegrees(avatarScene, "thigh_l", "calf_l", "foot_l"),
      kneeR: jointDegrees(avatarScene, "thigh_r", "calf_r", "foot_r"),
      elbowL: jointDegrees(avatarScene, "upperarm_l", "lowerarm_l", "hand_l"),
      elbowR: jointDegrees(avatarScene, "upperarm_r", "lowerarm_r", "hand_r"),
    });
  });

  if (!avatarScene) return null;

  return (
    <group position={[0, y, 0]} scale={scale}>
      <group ref={mount}>
        <primitive object={avatarScene} dispose={null} />
      </group>
    </group>
  );
}
