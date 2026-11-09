/**
 * Códigos cortos de enrolamiento. El WhatsApp no lleva el JWT: el socio abre
 * `/e/xxxx` y ahí se resuelve el token fresco contra el backend de acceso.
 */

import { randomBytes } from "crypto";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "enroll-codes.json");
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type EnrollCode = {
  code: string;
  subjectId: string;
  name: string;
  createdAt: string;
  expiresAt: string;
};

function readAll(): EnrollCode[] {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: EnrollCode[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), "utf-8");
}

function prune(list: EnrollCode[], now = Date.now()): EnrollCode[] {
  return list.filter((x) => new Date(x.expiresAt).getTime() > now);
}

function randomCode(): string {
  return randomBytes(6).toString("base64url");
}

export function issueEnrollCode(subjectId: string, name: string): string {
  const now = Date.now();
  const list = prune(readAll(), now).filter((x) => x.subjectId !== subjectId);
  let code = randomCode();
  while (list.some((x) => x.code === code)) code = randomCode();
  list.push({
    code,
    subjectId,
    name,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  });
  writeAll(list);
  return code;
}

export function getEnrollCode(code: string): EnrollCode | null {
  const rec = prune(readAll()).find((x) => x.code === code);
  return rec ?? null;
}
