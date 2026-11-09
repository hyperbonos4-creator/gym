import { issueEnrollAccessToken } from "./accessBackend";
import { consumeEnrollCode, issueEnrollCode, type EnrollCode } from "./enrollCodes";
import { resolvePublicBase } from "./publicUrl";

const GYM_BRAND = "Fuerza Élite";

/** Aviso de alta. La ficha se abre en la app, no en una página. */
export function appWelcomeMessage(nombre: string, gymName = GYM_BRAND) {
  const first = nombre.split(/\s+/)[0];
  return (
    `Hola, ${first}.\n\n` +
    `Bienvenido a ${gymName}.\n\n` +
    `Tu ficha ya está en la aplicación. Ábrela y entra con tu documento y este WhatsApp.`
  );
}

/** El registro del rostro sigue siendo la cámara del celular. Solo se manda si recepción lo pide. */
export function enrollMessage(nombre: string, link: string, gymName = GYM_BRAND) {
  const first = nombre.split(/\s+/)[0];
  return (
    `Hola, ${first}.\n\n` +
    `${gymName} necesita tu rostro para la puerta.\n\n` +
    `Abre este paso en el celular:\n${link}\n\n` +
    `Listo en menos de un minuto.`
  );
}

export function isLegacyEnrollLink(link: string) {
  return /#token=|\/kiosk\/enroll\.html/i.test(link || "");
}

export async function buildEnrollLink(req: Request, subjectId: string, nombre: string): Promise<string> {
  const code = issueEnrollCode(subjectId, nombre);
  const base = await resolvePublicBase(req);
  return `${base}/e/${code}`;
}

/**
 * Redirección al kiosko de enrolamiento.
 * El token es un JWT acotado al sujeto (purpose=enroll), NO el admin token.
 */
export async function enrollRedirectUrl(rec: EnrollCode): Promise<string> {
  const tok = await issueEnrollAccessToken(rec.subjectId);
  consumeEnrollCode(rec.code);
  const q = `subjectId=${encodeURIComponent(rec.subjectId)}&name=${encodeURIComponent(rec.name)}`;
  return `/kiosk/enroll.html?${q}#token=${encodeURIComponent(tok)}`;
}
