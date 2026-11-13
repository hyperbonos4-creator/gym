/**
 * Curva real del codo del clip "Curl con mancuernas" del maniquí (public/models/motion-studio/estudio.glb,
 * huesos lowerarm_l / lowerarm_r, ciclo de 5 s, ambos brazos a la vez). Muestreada cada 0,125 s en grados
 * de flexión. Valentina en el mundo 3D usa esta misma curva, así hace exactamente el ejercicio del maniquí.
 */
export const CURL_CYCLE = 5;
const STEP = 0.125;
const FLEX = [0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 8, 16, 32, 52, 70, 81, 88, 93, 96, 99, 100, 102, 102, 103, 103, 103, 103, 102, 101, 97, 89, 72, 36, 9, 2, 1, 0, 0, 0, 0, 0];

/** Flexión del codo (radianes) en el segundo `t` del ciclo. */
export function curlElbow(t: number): number {
  const c = ((t % CURL_CYCLE) + CURL_CYCLE) % CURL_CYCLE;
  const i = Math.min(FLEX.length - 2, Math.floor(c / STEP));
  const k = c / STEP - i;
  return ((FLEX[i] + (FLEX[i + 1] - FLEX[i]) * k) * Math.PI) / 180;
}
