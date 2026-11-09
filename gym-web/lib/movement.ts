import { EXERCISES, type Exercise } from "./exercisesCatalog";
import { SETUPS } from "./exerciseDemos";
import { studioKeyFor } from "./exerciseLibrary";
import { approvedModel, mediaOf, ownedVideo } from "./exerciseMedia";
import { MUSCLE_BY_ID } from "./muscles";

/** Fases que el reproductor puede señalar. Una fase sin archivo no inventa una imagen. */
export type MovePhase = "preparacion" | "ejecucion" | "regreso";

export type FrameShot = {
  src: string;
  phase: Exclude<MovePhase, "regreso">;
  label: string;
};

/** Primera tanda del estudio. El medio de hoy sigue siendo la secuencia fotográfica. */
export const STUDIO_FIRST = ["sentadilla", "press-banca", "curl-mancuernas", "remo-barra", "peso-muerto-rumano"] as const;

export type MovementClip =
  | { kind: "model"; src: string }
  | { kind: "video"; src: string; poster?: string }
  | { kind: "frames"; shots: FrameShot[] }
  | { kind: "none" };

export type MovementView = {
  exerciseId: string;
  name: string;
  clip: MovementClip;
  /** Segunda cámara. Solo existe si hay un archivo distinto; hoy no hay. */
  secondAngle: null;
  returnStep: { label: string; text: string } | null;
  machine: string;
  place: string;
  grip: string;
  primary: string;
  secondary: string[];
  mistakes: string[];
  studio: "primera" | "catalogo";
  review: "pendiente";
  mediumNote: string;
  licenseNote: string;
};

function shotsOf(exerciseId: string): FrameShot[] {
  const images = mediaOf(exerciseId)?.images || [];
  return images.slice(0, 2).map((src, i) => ({
    src,
    phase: i === 0 ? "preparacion" : "ejecucion",
    label: i === 0 ? "Preparación" : "Ejecución",
  }));
}

/** Elige el medio de este ejercicio. Un GLB o un vídeo ajenos no se publican. */
export function clipFor(exerciseId: string): MovementClip {
  const media = mediaOf(exerciseId);
  const model = approvedModel(media);
  if (model) return { kind: "model", src: model };
  const video = ownedVideo(media);
  if (video) return { kind: "video", src: video.src, poster: video.poster || media?.poster };
  const shots = shotsOf(exerciseId);
  if (shots.length) return { kind: "frames", shots };
  return { kind: "none" };
}

export function movementOf(exerciseId: string): MovementView | null {
  const exercise = EXERCISES.find((e) => e.id === exerciseId);
  if (!exercise) return null;
  const setup = SETUPS[exerciseId];
  const clip = clipFor(exerciseId);
  const last = exercise.steps[exercise.steps.length - 1];
  const firstWave = (STUDIO_FIRST as readonly string[]).includes(exerciseId);
  const mediumNote = noteFor(clip, firstWave);
  return {
    exerciseId,
    name: exercise.name,
    clip,
    secondAngle: null,
    returnStep: last ? { label: "Regreso", text: `${last.title}. ${last.text}` } : null,
    machine: setup?.machine || exercise.equipment,
    place: setup?.place || "",
    grip: setup?.grip || "",
    primary: MUSCLE_BY_ID[exercise.primary]?.name || exercise.primary,
    secondary: exercise.secondary.map((id) => MUSCLE_BY_ID[id]?.name || id),
    mistakes: exercise.mistakes,
    studio: firstWave ? "primera" : "catalogo",
    review: "pendiente",
    mediumNote,
    licenseNote: licenseFor(clip),
  };
}

function noteFor(clip: MovementClip, firstWave: boolean): string {
  const wave = firstWave ? "Primera fase del estudio. " : "";
  if (clip.kind === "model") return `${wave}Modelo 3D de este ejercicio.`;
  if (clip.kind === "video") return `${wave}Vídeo propio de este ejercicio. El modelo 3D todavía no está.`;
  if (clip.kind === "frames") {
    return `${wave}Secuencia de ${clip.shots.length} fotografías de este ejercicio. Vídeo propio y modelo 3D: sin archivo.`;
  }
  return `${wave}Este ejercicio no tiene demostración. No se muestra el movimiento de otro.`;
}

function licenseFor(clip: MovementClip): string {
  if (clip.kind === "model" || clip.kind === "video") {
    return "Archivo declarado para este ejercicio. La validación del entrenador sigue pendiente hasta que quede registrada.";
  }
  if (clip.kind === "frames") {
    return "Fotografías ya publicadas en el catálogo. No hay una cesión nueva ni un vídeo filmado. La validación del entrenador no está registrada.";
  }
  return "Sin medio que licenciar.";
}

export function movementPayload(exercise: Exercise) {
  const view = movementOf(exercise.id);
  const studioKey = studioKeyFor(exercise.id);
  const shots = !studioKey && view && view.clip.kind === "frames" ? view.clip.shots : [];
  return {
    id: exercise.id,
    name: exercise.name,
    classification: exercise.classification,
    equipment: exercise.equipment,
    level: exercise.level,
    tempo: exercise.tempo,
    why: exercise.why,
    muscle: view?.primary || "",
    secondary: view?.secondary || [],
    machine: view?.machine || exercise.equipment,
    place: view?.place || "",
    grip: view?.grip || "",
    frames: shots.map((s) => s.src),
    shots,
    video: !studioKey && view && view.clip.kind === "video" ? view.clip.src : null,
    model: view?.clip.kind === "model" ? view.clip.src : null,
    studioKey,
    returnStep: view?.returnStep || null,
    secondAngle: null,
    review: "pendiente" as const,
    studio: view?.studio || "catalogo",
    mediumNote: studioKey
      ? "Maniquí 3D de este ejercicio. El recorrido no certifica la técnica."
      : view?.mediumNote || "",
    cues: exercise.cues,
    mistakes: exercise.mistakes,
    steps: exercise.steps.map((s) => ({ title: s.title, text: s.text })),
  };
}
