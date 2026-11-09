import path from "path";
import { dataDir } from "./dataDir";
import type { Role, SessionUser } from "./session";
import { hashPassword, passwordPolicyOk } from "./passwords";
import { readJsonFile, updateJsonFileSync, writeJsonFile } from "./jsonStore";

const DATA_DIR = dataDir();
const FILE = path.join(DATA_DIR, "users.json");

export type StoredUser = {
  username: string;
  password: string;
  nombre: string;
  role: Role;
  gymIds: string[] | "all";
  /** Incrementar invalida cookies firmadas previas. */
  sessionVersion?: number;
};

function isProd() {
  return process.env.NODE_ENV === "production";
}

function bootstrapFromEnv(): StoredUser[] | null {
  const username = String(process.env.GYM_BOOTSTRAP_ADMIN_USER || "").trim().toLowerCase();
  const password = String(process.env.GYM_BOOTSTRAP_ADMIN_PASSWORD || "");
  const nombre = String(process.env.GYM_BOOTSTRAP_ADMIN_NAME || "Administrador").trim() || "Administrador";
  if (!username || !password) return null;
  if (!passwordPolicyOk(password)) {
    throw new Error("GYM_BOOTSTRAP_ADMIN_PASSWORD debe tener al menos 8 caracteres");
  }
  return [
    {
      username,
      password: hashPassword(password),
      nombre,
      role: "superadmin",
      gymIds: "all",
      sessionVersion: 1,
    },
  ];
}

function ensureUsers(): StoredUser[] {
  const existing = readJsonFile<StoredUser[]>(FILE, []);
  if (Array.isArray(existing) && existing.length) {
    return existing.map((u) => ({
      ...u,
      sessionVersion: u.sessionVersion ?? 1,
    }));
  }
  const seeded = bootstrapFromEnv();
  if (seeded) {
    writeJsonFile(FILE, seeded);
    return seeded;
  }
  if (isProd()) {
    throw new Error(
      "Sin usuarios y sin GYM_BOOTSTRAP_ADMIN_USER/PASSWORD. Configura el bootstrap o restaura data/users.json.",
    );
  }
  // Dev: no crear admin/admin. Dejar vacío y fallar en login hasta bootstrap.
  writeJsonFile(FILE, []);
  return [];
}

function readAll(): StoredUser[] {
  return ensureUsers();
}

function writeAll(list: StoredUser[]) {
  writeJsonFile(FILE, list);
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
  updateJsonFileSync<StoredUser[]>(FILE, [], (list) => {
    const i = list.findIndex((u) => u.username === username.trim().toLowerCase());
    if (i < 0 || list[i]!.gymIds === "all") return;
    if (!list[i]!.gymIds.includes(gymId)) list[i]!.gymIds = [...list[i]!.gymIds, gymId];
  });
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
  if (!passwordPolicyOk(input.password)) throw new Error("clave_corta");
  if (!input.gymIds.length && input.role !== "superadmin") throw new Error("gym_requerido");
  const user: StoredUser = {
    username,
    password: hashPassword(input.password),
    nombre: input.nombre.trim() || username,
    role: input.role === "superadmin" ? "admin" : input.role,
    gymIds: input.role === "superadmin" ? "all" : input.gymIds,
    sessionVersion: 1,
  };
  updateJsonFileSync<StoredUser[]>(FILE, [], (list) => {
    list.push(user);
  });
  return user;
}

export function rehashUserPassword(username: string, password: string) {
  updateJsonFileSync<StoredUser[]>(FILE, [], (list) => {
    const i = list.findIndex((u) => u.username === username.trim().toLowerCase());
    if (i < 0) return;
    list[i]!.password = hashPassword(password);
  });
}

export function bumpSessionVersion(username: string): number {
  let next = 1;
  updateJsonFileSync<StoredUser[]>(FILE, [], (list) => {
    const i = list.findIndex((u) => u.username === username.trim().toLowerCase());
    if (i < 0) return;
    next = (list[i]!.sessionVersion || 1) + 1;
    list[i]!.sessionVersion = next;
  });
  return next;
}

export function sessionVersionOf(username: string): number {
  return getUserByUsername(username)?.sessionVersion || 1;
}

/** Roles con acceso al panel de personal (no el registro público). */
export const STAFF_ROLES: Role[] = ["superadmin", "admin", "operador", "recepcion", "caja", "entrenador"];
