import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { readJsonFile, writeJsonFile, updateJsonFileSync } from "./jsonStore";
import { createGym, deleteGym, updateGym } from "./gymsStore";
import { createUser, grantGym, listUsers } from "./usersStore";

const FILE = path.join(dataDir(), "cuentas.json");
const TRIAL_DAYS = 14;

export type PlanId = "inicio" | "operacion" | "red";
export type AccountStatus = "prueba" | "activa" | "suspendida";

export type Cuenta = {
  id: string;
  name: string;
  owner: string;
  plan: PlanId;
  status: AccountStatus;
  trialEndsAt: string;
  gymIds: string[];
  createdAt: string;
};

export const PLANS: Record<PlanId, { label: string; sedes: number; precio: number }> = {
  inicio: { label: "Inicio", sedes: 1, precio: 180000 },
  operacion: { label: "Operación", sedes: 3, precio: 420000 },
  red: { label: "Red", sedes: 10, precio: 900000 },
};

function readAll(): Cuenta[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(list: Cuenta[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  writeJsonFile(FILE, list);
}

export function listCuentas() {
  return readAll();
}

export function getCuenta(id: string) {
  return readAll().find((c) => c.id === id) || null;
}

export function cuentaDeGym(gymId: string) {
  return readAll().find((c) => c.gymIds.includes(gymId)) || null;
}

export function cuentaAbierta(cuenta: Cuenta | null) {
  if (!cuenta) return true;
  if (cuenta.status === "suspendida") return false;
  if (cuenta.status === "activa") return true;
  return Date.parse(cuenta.trialEndsAt) > Date.now();
}

export function diasDePrueba(cuenta: Cuenta) {
  return Math.ceil((Date.parse(cuenta.trialEndsAt) - Date.now()) / 86400000);
}

function planId(value: string): PlanId {
  return value === "operacion" || value === "red" ? value : "inicio";
}

export function registrarCuenta(input: {
  cuenta: string;
  gymName: string;
  city?: string;
  username: string;
  password: string;
  nombre: string;
}) {
  const name = input.cuenta.trim();
  const gymName = input.gymName.trim();
  if (name.length < 2 || gymName.length < 2) throw new Error("nombre_corto");
  const gym = createGym({ name: gymName, city: input.city || "" });
  const cuenta: Cuenta = {
    id: gym.id,
    name,
    owner: input.username.trim().toLowerCase(),
    plan: "inicio",
    status: "prueba",
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
    gymIds: [gym.id],
    createdAt: new Date().toISOString(),
  };
  try {
    createUser({
      username: input.username,
      password: input.password,
      nombre: input.nombre || name,
      role: "admin",
      gymIds: [gym.id],
    });
  } catch (error) {
    deleteGym(gym.id);
    throw error;
  }
  updateGym(gym.id, { accountId: cuenta.id });
  const list = readAll();
  list.push(cuenta);
  writeAll(list);
  return { cuenta, gym };
}

export function agregarSede(cuentaId: string, input: { name: string; city?: string }) {
  const list = readAll();
  const i = list.findIndex((c) => c.id === cuentaId);
  if (i < 0) throw new Error("cuenta_no_encontrada");
  const cuenta = list[i];
  if (!cuentaAbierta(cuenta)) throw new Error("cuenta_suspendida");
  const max = PLANS[cuenta.plan].sedes;
  if (cuenta.gymIds.length >= max) throw new Error("limite_sedes");
  const gym = createGym({ name: input.name, city: input.city || "" });
  updateGym(gym.id, { accountId: cuenta.id });
  list[i] = { ...cuenta, gymIds: [...cuenta.gymIds, gym.id] };
  writeAll(list);
  for (const user of listUsers()) {
    if (user.role === "admin" && user.gymIds !== "all" && user.gymIds.some((id) => cuenta.gymIds.includes(id))) grantGym(user.username, gym.id);
  }
  return { cuenta: list[i], gym };
}

export function cambiarCuenta(id: string, patch: { status?: AccountStatus; plan?: PlanId }) {
  const list = readAll();
  const i = list.findIndex((c) => c.id === id);
  if (i < 0) throw new Error("cuenta_no_encontrada");
  list[i] = {
    ...list[i],
    status: patch.status || list[i].status,
    plan: patch.plan ? planId(patch.plan) : list[i].plan,
  };
  writeAll(list);
  return list[i];
}
