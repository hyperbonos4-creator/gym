/**
 * Cada músculo es una malla propia (superficie_* y musculo_*).
 * El resaltado es una guía del ejercicio, no una medición.
 */
export type MuscleCue = { primary: string[]; secondary: string[] };

const PRESS: MuscleCue = {
  primary: ["pecho"],
  secondary: ["deltoides-anterior", "triceps"],
};
const SQUAT: MuscleCue = {
  primary: ["cuadriceps", "gluteos"],
  secondary: ["isquiotibiales", "aductores", "erectores"],
};
const HINGE: MuscleCue = {
  primary: ["isquiotibiales", "gluteos"],
  secondary: ["erectores"],
};
const PULL: MuscleCue = {
  primary: ["dorsal"],
  secondary: ["biceps", "trapecio"],
};
const CURL: MuscleCue = {
  primary: ["biceps"],
  secondary: ["antebrazos"],
};
const PRESS_HOMBRO: MuscleCue = {
  primary: ["deltoides-anterior", "deltoides-lateral"],
  secondary: ["triceps"],
};
const CORE: MuscleCue = {
  primary: ["abdomen"],
  secondary: ["oblicuos"],
};

export const MUSCLE_CUES: Record<string, MuscleCue> = {
  press: PRESS,
  "press-banca-mancuernas": PRESS,
  "press-inclinado": PRESS,
  aperturas: { primary: ["pecho"], secondary: ["deltoides-anterior"] },
  flexiones: PRESS,
  "press-pecho-maquina": PRESS,
  fondos: { primary: ["triceps", "pecho"], secondary: ["deltoides-anterior"] },
  curl: CURL,
  "curl-martillo": { primary: ["biceps", "antebrazos"], secondary: [] },
  "extension-triceps": { primary: ["triceps"], secondary: [] },
  "extension-triceps-cabeza": { primary: ["triceps"], secondary: [] },
  sentadilla: SQUAT,
  "sentadilla-goblet": SQUAT,
  "sentadilla-bulgara": SQUAT,
  "prensa-piernas": SQUAT,
  zancadas: SQUAT,
  "extension-pierna": { primary: ["cuadriceps"], secondary: [] },
  "peso-muerto-rumano": HINGE,
  "peso-muerto-rumano-mancuernas": HINGE,
  "femoral-maquina": { primary: ["isquiotibiales"], secondary: ["gluteos"] },
  "hip-thrust": { primary: ["gluteos"], secondary: ["isquiotibiales"] },
  "elevacion-pantorrilla": { primary: ["pantorrillas"], secondary: [] },
  "remo-barra": PULL,
  "remo-mancuerna": PULL,
  "remo-polea": PULL,
  "remo-pecho-apoyado": PULL,
  "jalon-abierto": PULL,
  "jalon-cerrado": PULL,
  "dominada-asistida": PULL,
  "dominadas-supino": { primary: ["dorsal", "biceps"], secondary: ["trapecio"] },
  "elevacion-lateral": { primary: ["deltoides-lateral"], secondary: ["trapecio"] },
  "elevacion-frontal": { primary: ["deltoides-anterior"], secondary: ["pecho"] },
  pajaros: { primary: ["deltoides-posterior"], secondary: ["trapecio", "dorsal"] },
  "face-pull": { primary: ["deltoides-posterior"], secondary: ["trapecio"] },
  "press-militar": PRESS_HOMBRO,
  "press-hombros-mancuernas": PRESS_HOMBRO,
  "encogimiento-hombros": { primary: ["trapecio"], secondary: ["deltoides-lateral"] },
  plancha: CORE,
  "plancha-lateral": { primary: ["oblicuos"], secondary: ["abdomen"] },
  "dead-bug": CORE,
  pallof: CORE,
  "crunch-polea": CORE,
  "paseo-granjero": { primary: ["antebrazos", "trapecio"], secondary: ["abdomen", "oblicuos"] },
};

export function atlasRole(objectName: string, cue: MuscleCue | null): "primary" | "secondary" | "rest" {
  // El GLB trae biceps_brachii, no "biceps brachii". Sin esto el músculo del ejercicio no cambia de color.
  const low = objectName.toLowerCase().replace(/_/g, " ");
  let id: string | null = null;
  if (low.includes("pectoralis major")) id = "pecho";
  else if (low.includes("clavicular part of deltoid")) id = "deltoides-anterior";
  else if (low.includes("acromial part of deltoid")) id = "deltoides-lateral";
  else if (low.includes("scapular spinal part of deltoid")) id = "deltoides-posterior";
  else if (low.includes("triceps")) id = "triceps";
  else if (low.includes("biceps brachii") || low.includes("brachialis")) id = "biceps";
  else if (low.includes("latissimus")) id = "dorsal";
  else if (low.includes("trapezius")) id = "trapecio";
  else if (low.includes("rectus abdominis") || low.includes("external abdominal oblique")) id = "abdomen";
  else if (low.includes("internal abdominal oblique")) id = "oblicuos";
  else if (low.includes("rectus femoris") || low.includes("vastus")) id = "cuadriceps";
  else if (low.includes("biceps femoris") || low.includes("semitendinosus") || low.includes("semimembranosus")) id = "isquiotibiales";
  else if (low.includes("gluteus maximus")) id = "gluteos";
  else if (low.includes("gastrocnemius") || low.includes("soleus")) id = "pantorrillas";
  else if (low.includes("adductor")) id = "aductores";
  else if (low.includes("brachioradialis") || low.includes("flexor carpi") || low.includes("extensor carpi")) id = "antebrazos";
  if (!id || !cue) return "rest";
  if (cue.primary.includes(id)) return "primary";
  if (cue.secondary.includes(id)) return "secondary";
  return "rest";
}

export function muscleCueFor(clipKey: string): MuscleCue | null {
  return MUSCLE_CUES[clipKey] ?? null;
}

export function muscleId(objectName: string): string | null {
  const mark = objectName.startsWith("musculo_")
    ? "musculo_"
    : objectName.startsWith("superficie_")
      ? "superficie_"
      : null;
  if (!mark) return null;
  return objectName.slice(mark.length).replace(/_[lr]$/, "");
}

export type AnatomyMode = "superficie" | "anatomia" | "esqueleto";

export const MUSCLE_NAMES: Record<string, string> = {
  pecho: "Pectoral mayor",
  "deltoides-anterior": "Deltoides anterior",
  "deltoides-lateral": "Deltoides lateral",
  "deltoides-posterior": "Deltoides posterior",
  triceps: "Tríceps",
  biceps: "Bíceps",
  antebrazos: "Antebrazo",
  trapecio: "Trapecio",
  dorsal: "Dorsal ancho",
  erectores: "Erectores",
  abdomen: "Abdomen",
  oblicuos: "Oblicuos",
  cuadriceps: "Cuádriceps",
  isquiotibiales: "Isquiotibiales",
  aductores: "Aductores",
  gluteos: "Glúteo mayor",
  pantorrillas: "Gastrocnemio",
};

export const MUSCLE_NOTES: Record<string, string> = {
  pecho: "Acerca el brazo al tronco.",
  "deltoides-anterior": "Eleva el brazo hacia el frente.",
  "deltoides-lateral": "Eleva el brazo hacia el costado.",
  "deltoides-posterior": "Lleva el brazo hacia atrás.",
  triceps: "Extiende el codo.",
  biceps: "Flexiona el codo.",
  antebrazos: "Sujeta la barra o la mancuerna.",
  trapecio: "Eleva y estabiliza el omóplato.",
  dorsal: "Acerca el brazo al tronco.",
  erectores: "Sostiene la espalda en la bisagra.",
  abdomen: "Flexiona y estabiliza el tronco.",
  oblicuos: "Estabilizan el tronco de lado.",
  cuadriceps: "Extiende la rodilla.",
  isquiotibiales: "Flexiona la rodilla y extiende la cadera.",
  aductores: "Acerca el muslo a la línea media.",
  gluteos: "Extiende la cadera.",
  pantorrillas: "Extiende el tobillo.",
};

export function muscleNote(id: string) {
  return MUSCLE_NOTES[id] ?? "";
}

export function muscleName(id: string) {
  return MUSCLE_NAMES[id] ?? id;
}
