import { EXERCISES, type Exercise, type MoveKind } from "./exercisesCatalog";
import { GENERATED_CLIPS } from "./motion-studio/clips.generated";

/** Patrón de movimiento. Sirve para sustituir, no para certificar la técnica. */
export type MovePattern =
  | "sentadilla"
  | "bisagra"
  | "empuje-horizontal"
  | "empuje-vertical"
  | "traccion-horizontal"
  | "traccion-vertical"
  | "curl-codo"
  | "extension-codo"
  | "extension-rodilla"
  | "flexion-rodilla"
  | "core"
  | "aislamiento";

export type StudioClip = string;

const CLIP_KEYS = new Set(GENERATED_CLIPS.map((clip) => clip.key));
const STUDIO_ALIAS: Record<string, string> = {
  "press-banca": "press",
  "curl-mancuernas": "curl",
};

/** Clave del ciclo 3D. Sentadilla, press y curl conservan su nombre de siempre. */
export function studioKeyFor(id: string): string | null {
  if (STUDIO_ALIAS[id]) return STUDIO_ALIAS[id];
  return CLIP_KEYS.has(id) ? id : null;
}

export type LibraryCard = {
  pattern: MovePattern;
  laterality: "bilateral" | "unilateral";
  mechanics: "multiarticular" | "aislado" | "isometrico";
  /** Clip del maniquí. `null` significa que todavía no hay ciclo 3D. */
  studio: StudioClip | null;
  /** 1 = primera biblioteca para armar rutinas. 2 = variante posterior. */
  priority: 1 | 2;
};

export const PATTERN_LABEL: Record<MovePattern, string> = {
  sentadilla: "Sentadilla",
  bisagra: "Bisagra de cadera",
  "empuje-horizontal": "Empuje horizontal",
  "empuje-vertical": "Empuje vertical",
  "traccion-horizontal": "Tracción horizontal",
  "traccion-vertical": "Tracción vertical",
  "curl-codo": "Flexión de codo",
  "extension-codo": "Extensión de codo",
  "extension-rodilla": "Extensión de rodilla",
  "flexion-rodilla": "Flexión de rodilla",
  core: "Core",
  aislamiento: "Aislamiento",
};

/** Los 35 que bastan para cubrir el cuerpo y dar alternativas de equipo. */
export const PRIORITY_IDS = [
  "sentadilla",
  "sentadilla-goblet",
  "prensa-piernas",
  "sentadilla-bulgara",
  "zancadas",
  "peso-muerto-rumano-mancuernas",
  "peso-muerto-rumano",
  "hip-thrust",
  "femoral-maquina",
  "extension-pierna",
  "elevacion-pantorrilla",
  "press-banca",
  "press-banca-mancuernas",
  "press-inclinado",
  "flexiones",
  "press-pecho-maquina",
  "remo-mancuerna",
  "remo-polea",
  "remo-pecho-apoyado",
  "jalon-abierto",
  "dominada-asistida",
  "face-pull",
  "press-hombros-mancuernas",
  "elevacion-lateral",
  "pajaros",
  "curl-mancuernas",
  "curl-martillo",
  "extension-triceps",
  "extension-triceps-cabeza",
  "plancha",
  "plancha-lateral",
  "dead-bug",
  "pallof",
  "crunch-polea",
  "paseo-granjero",
] as const;

const LIBRARY: Record<string, LibraryCard> = {
  sentadilla: card("sentadilla", "bilateral", "multiarticular", "sentadilla", 1),
  "sentadilla-goblet": card("sentadilla", "bilateral", "multiarticular", null, 1),
  "prensa-piernas": card("sentadilla", "bilateral", "multiarticular", null, 1),
  "sentadilla-bulgara": card("sentadilla", "unilateral", "multiarticular", null, 1),
  zancadas: card("sentadilla", "unilateral", "multiarticular", null, 1),
  "peso-muerto-rumano-mancuernas": card("bisagra", "bilateral", "multiarticular", null, 1),
  "peso-muerto-rumano": card("bisagra", "bilateral", "multiarticular", null, 1),
  "hip-thrust": card("bisagra", "bilateral", "multiarticular", null, 1),
  "femoral-maquina": card("flexion-rodilla", "bilateral", "aislado", null, 1),
  "extension-pierna": card("extension-rodilla", "bilateral", "aislado", null, 1),
  "elevacion-pantorrilla": card("aislamiento", "bilateral", "aislado", null, 1),
  "press-banca": card("empuje-horizontal", "bilateral", "multiarticular", "press", 1),
  "press-banca-mancuernas": card("empuje-horizontal", "bilateral", "multiarticular", null, 1),
  "press-inclinado": card("empuje-horizontal", "bilateral", "multiarticular", null, 1),
  flexiones: card("empuje-horizontal", "bilateral", "multiarticular", null, 1),
  "press-pecho-maquina": card("empuje-horizontal", "bilateral", "multiarticular", null, 1),
  "remo-mancuerna": card("traccion-horizontal", "unilateral", "multiarticular", null, 1),
  "remo-polea": card("traccion-horizontal", "bilateral", "multiarticular", null, 1),
  "remo-pecho-apoyado": card("traccion-horizontal", "bilateral", "multiarticular", null, 1),
  "jalon-abierto": card("traccion-vertical", "bilateral", "multiarticular", null, 1),
  "dominada-asistida": card("traccion-vertical", "bilateral", "multiarticular", null, 1),
  "face-pull": card("traccion-horizontal", "bilateral", "aislado", null, 1),
  "press-hombros-mancuernas": card("empuje-vertical", "bilateral", "multiarticular", null, 1),
  "elevacion-lateral": card("empuje-vertical", "bilateral", "aislado", null, 1),
  pajaros: card("traccion-horizontal", "bilateral", "aislado", null, 1),
  "curl-mancuernas": card("curl-codo", "bilateral", "aislado", "curl", 1),
  "curl-martillo": card("curl-codo", "bilateral", "aislado", null, 1),
  "extension-triceps": card("extension-codo", "bilateral", "aislado", null, 1),
  "extension-triceps-cabeza": card("extension-codo", "bilateral", "aislado", null, 1),
  plancha: card("core", "bilateral", "isometrico", null, 1),
  "plancha-lateral": card("core", "unilateral", "isometrico", null, 1),
  "dead-bug": card("core", "bilateral", "aislado", null, 1),
  pallof: card("core", "bilateral", "isometrico", null, 1),
  "crunch-polea": card("core", "bilateral", "aislado", null, 1),
  "paseo-granjero": card("core", "bilateral", "isometrico", null, 1),
  "jalon-cerrado": card("traccion-vertical", "bilateral", "multiarticular", null, 2),
  "remo-barra": card("traccion-horizontal", "bilateral", "multiarticular", null, 2),
  "press-militar": card("empuje-vertical", "bilateral", "multiarticular", null, 2),
  fondos: card("empuje-horizontal", "bilateral", "multiarticular", null, 2),
  aperturas: card("empuje-horizontal", "bilateral", "aislado", null, 2),
  "elevacion-frontal": card("empuje-vertical", "bilateral", "aislado", null, 2),
  "dominadas-supino": card("traccion-vertical", "bilateral", "multiarticular", null, 2),
  "encogimiento-hombros": card("aislamiento", "bilateral", "aislado", null, 2),
};

const FALLBACK: Record<MoveKind, MovePattern> = {
  squat: "sentadilla",
  lunge: "sentadilla",
  hinge: "bisagra",
  press: "empuje-horizontal",
  pull: "traccion-horizontal",
  curl: "curl-codo",
  raise: "aislamiento",
  shrug: "aislamiento",
  core: "core",
};

function card(
  pattern: MovePattern,
  laterality: LibraryCard["laterality"],
  mechanics: LibraryCard["mechanics"],
  studio: StudioClip | null,
  priority: 1 | 2,
): LibraryCard {
  return { pattern, laterality, mechanics, studio, priority };
}

export function libraryOf(exercise: Exercise): LibraryCard {
  const base = LIBRARY[exercise.id] || {
    pattern: FALLBACK[exercise.move],
    laterality: exercise.move === "lunge" ? "unilateral" : "bilateral",
    mechanics: exercise.move === "core" ? "isometrico" : "multiarticular",
    studio: null,
    priority: 2 as const,
  };
  return { ...base, studio: studioKeyFor(exercise.id) };
}

export function priorityLibrary() {
  return PRIORITY_IDS
    .map((id) => {
      const exercise = EXERCISES.find((item) => item.id === id);
      return exercise ? { exercise, card: libraryOf(exercise) } : null;
    })
    .filter((row): row is { exercise: Exercise; card: LibraryCard } => row !== null);
}

export function libraryProgress() {
  const rows = priorityLibrary();
  return {
    total: rows.length,
    animated: rows.filter((row) => row.card.studio).length,
  };
}

/**
 * Alternativas del mismo patrón y la misma mecánica.
 * Un aislamiento no reemplaza un compuesto: la extensión de pierna no es una sentadilla.
 */
export function substitutesOf(id: string): Exercise[] {
  const current = EXERCISES.find((item) => item.id === id);
  if (!current) return [];
  const cardOf = libraryOf(current);
  return EXERCISES
    .filter((item) => {
      if (item.id === id) return false;
      const meta = libraryOf(item);
      if (meta.pattern !== cardOf.pattern || meta.mechanics !== cardOf.mechanics) return false;
      if (cardOf.pattern === "aislamiento" && item.primary !== current.primary) return false;
      return true;
    })
    .sort((a, b) => rank(b, current) - rank(a, current))
    .slice(0, 4);
}

function rank(candidate: Exercise, current: Exercise) {
  const meta = libraryOf(candidate);
  let score = 0;
  if (candidate.primary === current.primary) score += 4;
  if (candidate.equipment !== current.equipment) score += 2;
  if (candidate.level === current.level) score += 1;
  if (meta.studio) score += 1;
  return score;
}
