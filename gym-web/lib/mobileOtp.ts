import { randomInt } from "crypto";
import path from "path";
import { updateJsonFileSync, readJsonFile } from "./jsonStore";
import { rateLimit } from "./rateLimit";
import { findSocioByDoc, type Socio } from "./sociosStore";
import { samePhone } from "./mobileSession";

export type WaSender = (instance: string, to: string, text: string) => Promise<{ ok: boolean; error?: string }>;

const FILE = path.join(process.cwd(), "data", "mobile-otp.json");
const TTL_MS = 10 * 60 * 1000;

type OtpRow = {
  key: string;
  codeHash: string;
  gymId: string;
  socioId: string;
  phone: string;
  expiresAt: number;
  attempts: number;
};

type Db = { rows: OtpRow[] };

function hashCode(code: string) {
  // No es password; basta con no guardar el OTP en claro.
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return String(h);
}

function keyOf(gymId: string, doc: string, phone: string) {
  return `${gymId}:${doc.trim()}:${String(phone).replace(/\D/g, "").slice(-10)}`;
}

/** Compatibilidad: MOBILE_OTP_REQUIRED=false permite login doc+tel (solo transición). */
export function mobileOtpRequired(): boolean {
  const v = String(process.env.MOBILE_OTP_REQUIRED || "true").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

export function requestMobileOtp(input: {
  gymId: string;
  doc: string;
  phone: string;
  instance?: string;
  send: WaSender;
}): Promise<{ ok: true; socio: Socio; demoCode?: string } | { ok: false; error: string }> {
  const limited = rateLimit(`otp-req:${input.gymId}:${input.doc}`, 5, 15 * 60 * 1000);
  if (!limited.ok) return Promise.resolve({ ok: false, error: "demasiados_intentos" });

  const socio = findSocioByDoc(input.gymId, input.doc.trim());
  if (!socio || socio.deletedAt || !samePhone(socio.celular, input.phone)) {
    return Promise.resolve({ ok: false, error: "credenciales" });
  }

  const code = String(randomInt(100000, 999999));
  const key = keyOf(input.gymId, input.doc, input.phone);
  updateJsonFileSync<Db>(FILE, { rows: [] }, (db) => {
    db.rows = db.rows.filter((r) => r.expiresAt > Date.now() && r.key !== key);
    db.rows.push({
      key,
      codeHash: hashCode(code),
      gymId: input.gymId,
      socioId: socio.id,
      phone: input.phone,
      expiresAt: Date.now() + TTL_MS,
      attempts: 0,
    });
  });

  const text = `Tu código de acceso al gimnasio es ${code}. Vence en 10 minutos.`;
  const instance = input.instance || input.gymId;
  return input.send(instance, socio.celular || input.phone, text).then((sent) => {
    if (!sent.ok) {
      // En desarrollo permitir ver el código si WhatsApp no está conectado
      if (process.env.NODE_ENV !== "production") {
        return { ok: true as const, socio, demoCode: code };
      }
      return { ok: false as const, error: sent.error || "whatsapp_no_conectado" };
    }
    return { ok: true as const, socio };
  });
}

export function verifyMobileOtp(input: {
  gymId: string;
  doc: string;
  phone: string;
  code: string;
}): { ok: true; socio: Socio } | { ok: false; error: string } {
  const limited = rateLimit(`otp-ver:${input.gymId}:${input.doc}`, 20, 15 * 60 * 1000);
  if (!limited.ok) return { ok: false, error: "demasiados_intentos" };

  const key = keyOf(input.gymId, input.doc, input.phone);
  const db = readJsonFile<Db>(FILE, { rows: [] });
  const row = db.rows.find((r) => r.key === key);
  if (!row || row.expiresAt < Date.now()) return { ok: false, error: "otp_invalido" };
  if (row.attempts >= 5) return { ok: false, error: "otp_bloqueado" };

  const ok = row.codeHash === hashCode(String(input.code || "").trim());
  updateJsonFileSync<Db>(FILE, { rows: [] }, (d) => {
    const i = d.rows.findIndex((r) => r.key === key);
    if (i < 0) return;
    if (ok) d.rows.splice(i, 1);
    else d.rows[i]!.attempts += 1;
  });
  if (!ok) return { ok: false, error: "otp_invalido" };

  const socio = findSocioByDoc(input.gymId, input.doc.trim());
  if (!socio || socio.id !== row.socioId) return { ok: false, error: "otp_invalido" };
  return { ok: true, socio };
}
