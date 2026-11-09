import { GENERATED_CLIPS, type StudioPose } from "./clips.generated";

export type MotionStudioModelKey = "male" | "female";

export type MotionStudioModelDefinition = {
  key: MotionStudioModelKey;
  label: string;
  /** URL pública de Next. No es una ruta del disco. */
  src: string;
  scale: number;
  y: number;
};

/**
 * GLB licenciados, después de la compra en Fab:
 *   gym-web/public/models/motion-studio/fitness-man.glb
 *   gym-web/public/models/motion-studio/fitness-woman.glb
 * El .blend se queda fuera de public/. Next publica todo lo que hay en esa carpeta.
 */
export type MotionCamera = {
  position: [number, number, number];
  target: [number, number, number];
};

/** Las tomas se midieron con Z hacia arriba. El GLB ya deja el cuerpo de pie en Y. */
export function sceneCamera(shot: MotionCamera): MotionCamera {
  return {
    position: [shot.position[0], shot.position[2], -shot.position[1]],
    target: [shot.target[0], shot.target[2], -shot.target[1]],
  };
}

export type MotionStudioSource = {
  key: string;
  label: string;
  src: string;
  scale: number;
  y: number;
  camera: [number, number, number];
  target: [number, number, number];
  note: string;
  /** Clips que se reproducen juntos: el cuerpo y, si hace falta, la barra. */
  play: string[];
  /** Mallas del implemento que este ejercicio deja visibles. */
  show: string[];
  views: { frente: MotionCamera; perfil: MotionCamera; tres: MotionCamera; atras: MotionCamera };
};

function rearOf(front: MotionCamera): MotionCamera {
  return {
    position: [front.position[0], -front.position[1], front.position[2]],
    target: [front.target[0], front.target[1], front.target[2]],
  };
}

/**
 * Un solo GLB: la malla del maniquí va una vez y cada ejercicio va como clip.
 * La query cambia cuando se publica otro archivo, para que el navegador no
 * se quede con la versión anterior.
 */
export const MOTION_STUDIO_FILE = "/models/motion-studio/estudio.glb?v=20261014t";
export const ANATOMY_FILE = "/models/motion-studio/anatomia.glb?v=20261015g";

const POSE_VIEWS: Record<StudioPose, MotionStudioSource["views"]> = {
  depie: {
    frente: { position: [0.15, -3.6, 1.05], target: [0, 0, 0.9] },
    perfil: { position: [3.2, -0.15, 1.05], target: [0, 0, 0.9] },
    tres: { position: [2.2, -2.2, 1.15], target: [0, 0, 0.95] },
    atras: rearOf({ position: [0.15, -3.6, 1.05], target: [0, 0, 0.9] }),
  },
  banco: {
    frente: { position: [0.2, -2.7, 1.45], target: [0, 0.7, 0.45] },
    perfil: { position: [3.3, 0.75, 0.95], target: [0, 0.75, 0.5] },
    tres: { position: [2.5, -1.7, 1.25], target: [0, 0.7, 0.45] },
    atras: rearOf({ position: [0.2, -2.7, 1.45], target: [0, 0.7, 0.45] }),
  },
  suelo: {
    frente: { position: [0.2, -2.8, 1.35], target: [0, 0.35, 0.35] },
    perfil: { position: [3.1, 0.2, 0.9], target: [0, 0.15, 0.35] },
    tres: { position: [2.4, -1.8, 1.15], target: [0, 0.2, 0.35] },
    atras: rearOf({ position: [0.2, -2.8, 1.35], target: [0, 0.35, 0.35] }),
  },
  sentado: {
    frente: { position: [0.15, -3.1, 1.15], target: [0, 0.15, 0.75] },
    perfil: { position: [3.1, 0.1, 1.05], target: [0, 0.1, 0.75] },
    tres: { position: [2.2, -2.1, 1.2], target: [0, 0.1, 0.75] },
    atras: rearOf({ position: [0.15, -3.1, 1.15], target: [0, 0.15, 0.75] }),
  },
};

/** Ciclos generados en Blender sobre el maniquí CC0. El editor de poses no se reemplaza. */
/** La flexión femoral se lee de lado: de frente el cuerpo acostado parece al revés. */
/** El cuerpo está acostado: de frente se ve el pecho y el banco entero. */
const BANCO_LIBRE: MotionStudioSource["views"] = {
  frente: { position: [0.15, -3.15, 1.55], target: [0, 0.85, 0.5] },
  perfil: { position: [3.3, 0.75, 0.95], target: [0, 0.75, 0.5] },
  tres: { position: [2.4, -1.8, 1.3], target: [0, 0.75, 0.48] },
  atras: rearOf({ position: [0.15, -3.15, 1.55], target: [0, 0.85, 0.5] }),
};

const CLIP_VIEWS: Partial<Record<string, MotionStudioSource["views"]>> = {
  press: BANCO_LIBRE,
  "press-banca-mancuernas": BANCO_LIBRE,
  aperturas: BANCO_LIBRE,
  "femoral-maquina": {
    frente: { position: [3.4, 0.05, 0.95], target: [0, 0.02, 0.58] },
    perfil: { position: [-3.2, 0.35, 0.9], target: [0, 0.02, 0.55] },
    tres: { position: [2.2, -2.3, 1.15], target: [0, -0.05, 0.55] },
    atras: rearOf({ position: [3.4, 0.05, 0.95], target: [0, 0.02, 0.58] }),
  },
};

export const MOTION_STUDIO_SOURCES: MotionStudioSource[] = GENERATED_CLIPS.map((clip) => {
  const views = CLIP_VIEWS[clip.key] || POSE_VIEWS[clip.pose];
  return {
    key: clip.key,
    label: clip.label,
    src: MOTION_STUDIO_FILE,
    scale: 1,
    y: 0,
    camera: views.tres.position,
    target: views.tres.target,
    note: clip.note,
    play: clip.play,
    show: clip.show,
    views,
  };
});

export const MOTION_PROP_NAMES = [...new Set(MOTION_STUDIO_SOURCES.flatMap((item) => item.show))];

export type MotionAngles = {
  kneeL: number | null;
  kneeR: number | null;
  elbowL: number | null;
  elbowR: number | null;
};

export const MOTION_STUDIO_MODELS: Record<MotionStudioModelKey, MotionStudioModelDefinition> = {
  male: {
    key: "male",
    label: "Hombre",
    src: "/models/motion-studio/fitness-man.glb",
    scale: 1,
    y: 0,
  },
  female: {
    key: "female",
    label: "Mujer",
    src: "/models/motion-studio/fitness-woman.glb",
    scale: 1,
    y: 0,
  },
};

export type MotionRigClipReport = {
  name: string;
  durationSeconds: number;
  trackCount: number;
  tracksMatchingBones: number;
};

export type MotionRigReport = {
  src: string;
  rootName: string;
  meshCount: number;
  skinnedMeshCount: number;
  boneCount: number;
  boneNames: string[];
  heightInSceneUnits: number | null;
  clips: MotionRigClipReport[];
  warnings: string[];
};
