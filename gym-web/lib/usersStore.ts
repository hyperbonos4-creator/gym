import fs from "fs";
import path from "path";
import type { Role, SessionUser } from "./session";
import { hashPassword } from "./passwords";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "users.json");

export type StoredUser = {
  username: string;
  password: string;
  nombre: string;
  role: Role;
  gymIds: string[] | "all";
};

const SEED: StoredUser[] = [
  {
    username: "admin",
    password: "admin",
    nombre: "Administrador",
    role: "superadmin",
    gymIds: "all",
  },
];

function readAll(): StoredUser[] {
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {
    /* seed */
  }
  writeAll(SEED);
  return [...SEED];
}

function writeAll(list: StoredUser[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2), "utf-8");
}

export function listUsers(): StoredUser[] {
  return readAll();
}

export function getUserByUsername(username: string): StoredUser | undefined {
  const u = username.trim().toLowerCase();
  return readAll().find((x) => x.username === u);
}

export function toSession(u: StoredUser): SessionUser {
  return { username: u.username, nombre: u.nombre, role: u.role, gymIds: u.gymIds };
}

export function canAccessGym(user: SessionUser, gymId: string): boolean {
  if (user.role === "superadmin" || user.gymIds === "all") return true;
  return Array.isArray(user.gymIds) && user.gymIds.includes(gymId);
}

export function grantGym(username: string, gymId: string) {
  const list = readAll();
  const i = list.findIndex((u) => u.username === username.trim().toLowerCase());
  if (i < 0 || list[i].gymIds === "all") return;
  if (!list[i].gymIds.includes(gymId)) list[i].gymIds = [...list[i].gymIds, gymId];
  writeAll(list);
}

export function createUser(input: {
  username: string;
  password: string;
  nombre: string;
  role: Role;
  gymIds: string[];
}): StoredUser {
  const username = input.username.trim().toLowerCase();
  if (!username) throw new Error("usuario_requerido");
  if (getUserByUsername(username)) throw new Error("usuario_existe");
  if (!input.password || input.password.length < 4) throw new Error("clave_corta");
  if (!input.gymIds.length && input.role !== "superadmin") throw new Error("gym_requerido");
  const user: StoredUser = {
    username,
    password: hashPassword(input.password),
    nombre: input.nombre.trim() || username,
    role: input.role === "superadmin" ? "admin" : input.role,
    gymIds: input.role === "superadmin" ? "all" : input.gymIds,
  };
  const list = readAll();
  list.push(user);
  writeAll(list);
  return user;
}
