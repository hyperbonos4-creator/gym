/**
 * Verificación HMAC de sesión para Edge middleware (solo Web Crypto).
 * No importar crypto de Node aquí.
 */
export type EdgeSessionClaims = {
  u: string;
  r: string;
  v: number;
  exp: number;
};

const ENC = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function secret(): string {
  const s = String(process.env.SESSION_SECRET || "").trim();
  if (s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") return "";
  return "dev-only-session-secret-min-32-chars!!";
}

export async function verifySessionTokenEdge(token: string): Promise<EdgeSessionClaims | null> {
  const raw = String(token || "").trim();
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const sec = secret();
  if (!sec) return null;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      ENC.encode(sec),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, ENC.encode(body)));
    const got = fromB64url(sig);
    if (!timingSafeEqual(expected, got)) return null;
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(body))) as EdgeSessionClaims;
    if (!claims?.u || !claims?.r || typeof claims.v !== "number" || typeof claims.exp !== "number") return null;
    if (claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
