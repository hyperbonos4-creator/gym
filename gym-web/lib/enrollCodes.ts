/**
 * Códigos cortos de enrolamiento. El WhatsApp no lleva el JWT: el socio abre
 * `/e/xxxx` y ahí se resuelve un token fresco acotado al sujeto.
 */
import { randomBytes } from "crypto";
import path from "path";
import { readJsonFile, updateJsonFileSync, writeJsonFile } from "./jsonStore";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "enroll-codes.json");
/** TTL corto del código de invitación (horas). */
const TTL_MS = Number(process.env.ENROLL_CODE_TTL_HOURS || "24") * 60 * 60 * 1000;

export type EnrollCode = {
  code: string;
  subjectId: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  usedAt?: string | null;
};

function readAll(): EnrollCode[] {
  const arr = readJsonFile<EnrollCode[]>(FILE, []);
  return Array.isArray(arr) ? arr : [];
}

function writeAll(list: EnrollCode[]) {
  writeJsonFile(FILE, list);
}

function prune(list: EnrollCode[], now = Date.now()): EnrollCode[] {
  return list.filter((x) => new Date(x.expiresAt).getTime() > now && !x.usedAt);
}

function randomCode(): string {
  return randomBytes(6).toString("base64url");
}

export function issueEnrollCode(subjectId: string, name: string): string {
  const now = Date.now();
  let code = "";
  updateJsonFileSync<EnrollCode[]>(FILE, [], (list) => {
    const kept = prune(list, now).filter((x) => x.subjectId !== subjectId);
    code = randomCode();
    while (kept.some((x) => x.code === code)) code = randomCode();
    kept.push({
      code,
      subjectId,
      name,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + TTL_MS).toISOString(),
      usedAt: null,
    });
    list.length = 0;
    list.push(...kept);
  });
  return code;
}

export function getEnrollCode(code: string): EnrollCode | null {
  const rec = prune(readAll()).find((x) => x.code === code);
  return rec ?? null;
}

/** Marca el código como usado (un solo uso). */
export function consumeEnrollCode(code: string) {
  updateJsonFileSync<EnrollCode[]>(FILE, [], (list) => {
    const i = list.findIndex((x) => x.code === code);
    if (i >= 0) list[i]!.usedAt = new Date().toISOString();
  });
}
