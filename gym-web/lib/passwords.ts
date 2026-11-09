import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const MIN_LEN = 8;

export function passwordPolicyOk(password: string): boolean {
  return typeof password === "string" && password.length >= MIN_LEN;
}

export function hashPassword(password: string) {
  if (!passwordPolicyOk(password)) throw new Error("clave_corta");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function isHashedPassword(stored: string) {
  return String(stored || "").startsWith("scrypt:");
}

/** Solo acepta scrypt. El plaintext legacy se migra en login (rehash). */
export function verifyPassword(stored: string, password: string): { ok: boolean; needsRehash: boolean } {
  if (!stored || !password) return { ok: false, needsRehash: false };
  if (!isHashedPassword(stored)) {
    // Compatibilidad de un solo paso: si aún hay plaintext en disco, comparar
    // en tiempo constante aproximado y marcar rehash. No se permiten seeds nuevos en plaintext.
    const a = Buffer.from(stored);
    const b = Buffer.from(password);
    if (a.length !== b.length) return { ok: false, needsRehash: false };
    return { ok: timingSafeEqual(a, b), needsRehash: true };
  }
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return { ok: false, needsRehash: false };
  const got = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (got.length !== expected.length) return { ok: false, needsRehash: false };
  return { ok: timingSafeEqual(got, expected), needsRehash: false };
}
