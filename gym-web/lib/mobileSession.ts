/**
 * Sesión del cliente en la app. No usa la cookie del panel.
 * El token viaja como Bearer y solo identifica al titular de un gimnasio.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { findSocioByDoc, getSocio, type Socio } from "./sociosStore";

const KEY_FILE = path.join(process.cwd(), "data", "mobile.key");
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

function key(): string {
  if (!fs.existsSync(KEY_FILE)) {
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
    fs.writeFileSync(KEY_FILE, randomBytes(32).toString("hex"), "utf-8");
  }
  return fs.readFileSync(KEY_FILE, "utf-8").trim();
}

function sign(body: string) {
  return createHmac("sha256", key()).update(body).digest("base64url");
}

export function issueMobileToken(socioId: string, gymId: string): string {
  const body = Buffer.from(JSON.stringify({ socioId, gymId, exp: Date.now() + MONTH_MS })).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function socioFromMobileRequest(req: Request): { socio: Socio; gymId: string } | null {
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: { socioId?: string; gymId?: string; exp?: number };
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
  if (!payload.socioId || !payload.gymId || !payload.exp || payload.exp < Date.now()) return null;
  const socio = getSocio(payload.socioId);
  if (!socio || socio.deletedAt || socio.gymId !== payload.gymId) return null;
  return { socio, gymId: payload.gymId };
}

export function samePhone(stored: string, given: string) {
  const a = String(stored || "").replace(/\D/g, "");
  const b = String(given || "").replace(/\D/g, "");
  return a.length >= 10 && b.length >= 10 && a.slice(-10) === b.slice(-10);
}

export function loginMobile(gymId: string, doc: string, phone: string): { socio: Socio; token: string } | null {
  const socio = findSocioByDoc(gymId, doc.trim());
  if (!socio || socio.deletedAt || !samePhone(socio.celular, phone)) return null;
  return { socio, token: issueMobileToken(socio.id, gymId) };
}
