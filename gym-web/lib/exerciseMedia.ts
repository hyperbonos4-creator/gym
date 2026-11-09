import { SETUPS } from "./exerciseDemos";

/** Medios de un ejercicio. El id de la rutina no cambia cuando entra un vídeo o un GLB. */
export type ExerciseMedia = {
  poster?: string;
  images?: string[];
  video?: {
    src: string;
    poster?: string;
  };
  model3d?: {
    src: string;
    poster: string;
    format: "glb";
    approved: boolean;
  };
  rightsStatus: "unverified" | "owned" | "licensed";
};

function photos(pack: string): ExerciseMedia {
  return {
    poster: `/demos/${pack}/0.jpg`,
    images: [`/demos/${pack}/0.jpg`, `/demos/${pack}/1.jpg`],
    rightsStatus: "unverified",
  };
}

/** Las fotos actuales quedan como alternativa. Ninguna está marcada como propia ni licenciada. */
export const EXERCISE_MEDIA: Partial<Record<string, ExerciseMedia>> = Object.fromEntries(
  Object.entries(SETUPS).map(([id, setup]) => [id, photos(setup.pack)]),
);

export function mediaOf(exerciseId: string): ExerciseMedia | null {
  return EXERCISE_MEDIA[exerciseId] || null;
}

/** Un GLB solo se muestra si es de este ejercicio, está aprobado y los derechos no están en duda. */
export function approvedModel(media: ExerciseMedia | null): string | null {
  if (!media?.model3d?.approved || media.model3d.format !== "glb") return null;
  if (media.rightsStatus !== "owned" && media.rightsStatus !== "licensed") return null;
  return media.model3d.src;
}

/** Un vídeo solo se muestra si los derechos de este ejercicio están claros. */
export function ownedVideo(media: ExerciseMedia | null): { src: string; poster?: string } | null {
  if (!media?.video?.src) return null;
  if (media.rightsStatus !== "owned" && media.rightsStatus !== "licensed") return null;
  return media.video;
}
