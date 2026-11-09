import type { MuscleId } from "./muscles";

export type AtlasView = "front" | "back";

export type AtlasStructure = {
  id: string;
  name: string;
  latin: string;
  action: string;
  group: MuscleId;
  /** Grupo del catálogo. `null` significa que esta estructura no tiene ejercicio propio. */
  catalog?: MuscleId | null;
  view: AtlasView;
  note?: string;
  box: { t: number; l: number; w: number; h: number };
};

/** Músculos que se pueden señalar en las dos imágenes que ya tiene la sede.
 *  El grupo es el del catálogo: varios músculos comparten ejercicios. */
export const ATLAS_STRUCTURES: AtlasStructure[] = [
  { id: "deltoides-anterior", name: "Deltoides anterior", latin: "Deltoideus, pars clavicularis", action: "Eleva el brazo hacia el frente.", group: "deltoides", view: "front", box: { t: 23.5, l: 27, w: 13, h: 7.5 } },
  { id: "deltoides-anterior", name: "Deltoides anterior", latin: "Deltoideus, pars clavicularis", action: "Eleva el brazo hacia el frente.", group: "deltoides", view: "front", box: { t: 23.5, l: 60, w: 13, h: 7.5 } },
  { id: "pectoral-mayor", name: "Pectoral mayor", latin: "Pectoralis major", action: "Acerca el brazo a la línea media y empuja hacia adelante.", group: "pectorales", view: "front", box: { t: 26.5, l: 37, w: 26, h: 8.5 } },
  { id: "biceps-braquial", name: "Bíceps braquial", latin: "Biceps brachii", action: "Flexiona el codo y supina el antebrazo.", group: "biceps", view: "front", box: { t: 31, l: 23, w: 11, h: 9 } },
  { id: "biceps-braquial", name: "Bíceps braquial", latin: "Biceps brachii", action: "Flexiona el codo y supina el antebrazo.", group: "biceps", view: "front", box: { t: 31, l: 66, w: 11, h: 9 } },
  { id: "braquiorradial", name: "Braquiorradial", latin: "Brachioradialis", action: "Flexiona el codo con el pulgar hacia arriba.", group: "antebrazos", view: "front", box: { t: 41, l: 18, w: 11, h: 10 } },
  { id: "braquiorradial", name: "Braquiorradial", latin: "Brachioradialis", action: "Flexiona el codo con el pulgar hacia arriba.", group: "antebrazos", view: "front", box: { t: 41, l: 71, w: 11, h: 10 } },
  { id: "recto-abdominal", name: "Recto abdominal", latin: "Rectus abdominis", action: "Flexiona el tronco y contiene las costillas.", group: "abdomen", view: "front", box: { t: 35.5, l: 40, w: 20, h: 12 } },
  { id: "oblicuo", name: "Oblicuo externo", latin: "Obliquus externus abdominis", action: "Rota el tronco y lo flexiona de lado.", group: "core", view: "front", box: { t: 35, l: 32, w: 8, h: 14 } },
  { id: "oblicuo", name: "Oblicuo externo", latin: "Obliquus externus abdominis", action: "Rota el tronco y lo flexiona de lado.", group: "core", view: "front", box: { t: 35, l: 60, w: 8, h: 14 } },
  { id: "cuadriceps", name: "Cuádriceps", latin: "Quadriceps femoris", action: "Extiende la rodilla. El recto femoral también flexiona la cadera.", group: "cuadriceps", view: "front", box: { t: 51, l: 33, w: 15, h: 16 } },
  { id: "cuadriceps", name: "Cuádriceps", latin: "Quadriceps femoris", action: "Extiende la rodilla. El recto femoral también flexiona la cadera.", group: "cuadriceps", view: "front", box: { t: 51, l: 52, w: 15, h: 16 } },
  { id: "aductores", name: "Aductores", latin: "Musculi adductores", action: "Acercan el muslo a la línea media.", group: "aductores", view: "front", box: { t: 54, l: 44, w: 12, h: 12 } },
  { id: "tibial-anterior", name: "Tibial anterior", latin: "Tibialis anterior", action: "Levanta la punta del pie.", group: "pantorrillas", catalog: null, view: "front", note: "No es el gemelo. La elevación de pantorrilla trabaja la cara posterior y no se lista aquí.", box: { t: 73, l: 35, w: 12, h: 13 } },
  { id: "tibial-anterior", name: "Tibial anterior", latin: "Tibialis anterior", action: "Levanta la punta del pie.", group: "pantorrillas", catalog: null, view: "front", note: "No es el gemelo. La elevación de pantorrilla trabaja la cara posterior y no se lista aquí.", box: { t: 73, l: 53, w: 12, h: 13 } },

  { id: "trapecio", name: "Trapecio", latin: "Trapezius", action: "Eleva y junta las escápulas.", group: "deltoides", view: "back", note: "El encogimiento del catálogo está archivado en hombros.", box: { t: 16, l: 40, w: 20, h: 8 } },
  { id: "deltoides-posterior", name: "Deltoides posterior", latin: "Deltoideus, pars spinalis", action: "Lleva el brazo hacia atrás.", group: "deltoides", view: "back", box: { t: 22, l: 28, w: 12, h: 7 } },
  { id: "deltoides-posterior", name: "Deltoides posterior", latin: "Deltoideus, pars spinalis", action: "Lleva el brazo hacia atrás.", group: "deltoides", view: "back", box: { t: 22, l: 60, w: 12, h: 7 } },
  { id: "dorsal-ancho", name: "Dorsal ancho", latin: "Latissimus dorsi", action: "Tira del brazo hacia el cuerpo y hacia abajo.", group: "espalda", view: "back", box: { t: 26, l: 34, w: 32, h: 14 } },
  { id: "triceps", name: "Tríceps braquial", latin: "Triceps brachii", action: "Extiende el codo.", group: "triceps", view: "back", box: { t: 30, l: 22, w: 11, h: 12 } },
  { id: "triceps", name: "Tríceps braquial", latin: "Triceps brachii", action: "Extiende el codo.", group: "triceps", view: "back", box: { t: 30, l: 67, w: 11, h: 12 } },
  { id: "erector", name: "Erector de la columna", latin: "Erector spinae", action: "Mantiene el tronco erguido.", group: "core", view: "back", box: { t: 40, l: 42, w: 16, h: 8 } },
  { id: "gluteo-mayor", name: "Glúteo mayor", latin: "Gluteus maximus", action: "Extiende la cadera.", group: "gluteos", view: "back", box: { t: 48, l: 36, w: 28, h: 9 } },
  { id: "isquiotibiales", name: "Isquiotibiales", latin: "Musculi ischiocrurales", action: "Flexionan la rodilla y extienden la cadera.", group: "isquiotibiales", view: "back", box: { t: 57, l: 34, w: 14, h: 14 } },
  { id: "isquiotibiales", name: "Isquiotibiales", latin: "Musculi ischiocrurales", action: "Flexionan la rodilla y extienden la cadera.", group: "isquiotibiales", view: "back", box: { t: 57, l: 52, w: 14, h: 14 } },
  { id: "gemelo", name: "Gemelo", latin: "Gastrocnemius", action: "Empuja con la punta del pie. El sóleo sigue trabajando con la rodilla flexionada.", group: "pantorrillas", view: "back", box: { t: 74, l: 35, w: 12, h: 12 } },
  { id: "gemelo", name: "Gemelo", latin: "Gastrocnemius", action: "Empuja con la punta del pie. El sóleo sigue trabajando con la rodilla flexionada.", group: "pantorrillas", view: "back", box: { t: 74, l: 53, w: 12, h: 12 } },
];

export function structuresOn(view: AtlasView) {
  const seen = new Set<string>();
  return ATLAS_STRUCTURES.filter((s) => s.view === view && (seen.has(s.id) ? false : (seen.add(s.id), true)));
}

export function structureById(id: string) {
  return ATLAS_STRUCTURES.find((s) => s.id === id) || null;
}

/** `null`: la estructura se puede señalar, pero no abre ejercicios de otro músculo. */
export function catalogOf(structure: AtlasStructure): MuscleId | null {
  return structure.catalog === undefined ? structure.group : structure.catalog;
}
