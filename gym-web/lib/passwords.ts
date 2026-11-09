import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(stored: string, password: string) {
  if (!stored.startsWith("scrypt:")) return stored === password;
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const got = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
