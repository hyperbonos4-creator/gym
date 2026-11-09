import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { readJsonFile, writeJsonFile, updateJsonFileSync } from "./jsonStore";
import type { Gym } from "./tenants";

const DATA_DIR = dataDir();
const FILE = path.join(DATA_DIR, "gyms.json");

const SEED: Gym[] = [
  {
    id: "fuerza-elite",
    name: "Fuerza Élite Madera Silvestre",
    city: "Sede principal",
    whatsapp: "conectado",
    waInstance: "gym",
    short: "FE",
  },
];

function readAll(): Gym[] {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {
    /* seed */
  }
  writeAll(SEED);
  return SEED;
}

function writeAll(list: Gym[]) {
  writeJsonFile(FILE, list);
}

export function listGyms(): Gym[] {
  return readAll();
}

export function getGymById(id: string | null): Gym | null {
  const list = readAll();
  if (!id) return list[0] ?? null;
  return list.find((g) => g.id === id) ?? null;
}

export function gymInstance(id: string | null): string {
  return getGymById(id)?.waInstance ?? "gym";
}

export function deleteGym(id: string) {
  const list = readAll().filter((g) => g.id !== id);
  writeAll(list);
}

export function updateGym(id: string, patch: Partial<Pick<Gym, "brandName" | "logo" | "accountId" | "name" | "city">>): Gym {
  const list = readAll();
  const i = list.findIndex((g) => g.id === id);
  if (i < 0) throw new Error("gym_no_encontrado");
  list[i] = { ...list[i], ...patch };
  writeAll(list);
  return list[i];
}

export function slugify(name: string) {
  const s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || `gym-${Date.now().toString(36)}`;
}

export function createGym(input: { name: string; city?: string; short?: string }): Gym {
  const list = readAll();
  let id = slugify(input.name);
  if (list.some((g) => g.id === id)) id = `${id}-${Date.now().toString(36)}`;
  const name = input.name.trim();
  const gym: Gym = {
    id,
    name,
    city: (input.city || "Nueva sede").trim(),
    whatsapp: "desconectado",
    waInstance: id,
    short: (input.short || name.slice(0, 2)).trim().toUpperCase().slice(0, 3) || "GY",
  };
  list.push(gym);
  writeAll(list);
  return gym;
}
