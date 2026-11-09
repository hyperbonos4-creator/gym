/**
 * Cookie de sesión firmada (HMAC-SHA256) para route handlers Node.
 * El middleware Edge usa sessionTokenEdge.ts.
 */
import { createHmac, timingSafeEqual } from "crypto";
import type { Role } from "./session";

export type SessionClaims = {
  u: string;
  r: Role;
  v: number;
  exp: number;
};

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function getSessionSecret(): string {
  const secret = String(process.env.SESSION_SECRET || "").trim();
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET_requerido");
  }
  return "dev-only-session-secret-min-32-chars!!";
}

export function sessionTtlMs(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS || "24");
  const h = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return Math.floor(h * 60 * 60 * 1000);
}

export function mintSessionTokenSync(input: {
  username: string;
  role: Role;
  sessionVersion: number;
  ttlMs?: number;
}): string {
  const secret = getSessionSecret();
  const claims: SessionClaims = {
    u: input.username.trim().toLowerCase(),
    r: input.role,
    v: input.sessionVersion | 0,
    exp: Date.now() + (input.ttlMs ?? sessionTtlMs()),
  };
  const body = b64url(Buffer.from(JSON.stringify(claims), "utf-8"));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySessionTokenSync(token: string): SessionClaims | null {
  const raw = String(token || "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }
  try {
    const expected = createHmac("sha256", secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    const claims = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionClaims;
    if (!claims?.u || !claims?.r || typeof claims.v !== "number" || typeof claims.exp !== "number") return null;
    if (claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export function serializeSessionCookie(token: string, maxAgeSec: number): string {
  const secure = process.env.NODE_ENV === "production";
  const parts = [
    `gym_session=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAgeSec}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `gym_session=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`;
}
