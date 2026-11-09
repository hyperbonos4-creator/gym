import { getBrand } from "./brand";
import { resolvePublicBase } from "./publicUrl";

export function exerciseClientPath(exerciseId: string) {
  return "/x/" + encodeURIComponent(exerciseId);
}

export async function buildExerciseClientLink(req: Request, exerciseId: string) {
  const base = await resolvePublicBase(req);
  return base + exerciseClientPath(exerciseId);
}

export function exerciseWhatsappMessage(nombre: string, exerciseName: string) {
  const first = nombre.split(/\s+/)[0];
  const brand = getBrand().name;
  return (
    "Hola, " + first + ".\n\n" +
    "Tu entrenador te dejó un ejercicio en la app de " + brand + ":\n" +
    exerciseName + "\n\n" +
    "Ábrela y entra a Tu entreno. Ahí está la máquina, la postura y el movimiento."
  );
}
