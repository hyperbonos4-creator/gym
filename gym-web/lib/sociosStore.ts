/**
 * Almacén de SOCIOS de la plataforma (datos ricos del cliente). El backend de
 * acceso solo guarda la identidad biométrica mínima (id + nombre); aquí vive la
 * ficha completa del socio, asociada por `id` (= subjectId del backend de
 * acceso), de modo que la captura facial del enrolamiento queda ligada a su id.
 *
 * Persistencia simple en archivo JSON (suficiente para esta etapa; luego se
 * migra a la base de datos del gym). Multi-tenant: cada registro lleva `gymId`.
 */

import path from "path";
import { dataDir } from "./dataDir";
import { readJsonFile, updateJsonFileSync, writeJsonFile } from "./jsonStore";

const DATA_DIR = dataDir();
const FILE = path.join(DATA_DIR, "socios.json");

export type Socio = {
  id: string; // = subjectId del backend de acceso
  gymId: string | null;
  createdAt: string;
  // Identificación
  docTipo: string; // CC | TI | CE | PAS | NIT
  docNumero: string;
  nombre: string;
  fechaNac: string; // YYYY-MM-DD
  genero: string; // "" | F | M | O
  // Contacto
  codigoPais: string;
  celular: string;
  email: string;
  enviarEmails: boolean;
  direccion: string;
  // Extras
  prospecto: boolean;
  empresa: string;
  contactoRespaldoNombre: string;
  contactoRespaldoTel: string;
  observaciones: string;
  // Estado de enrolamiento facial
  estado: "pendiente_enrolamiento" | "enrolado";
  enrollLink: string;
  /** miembro = plan del gimnasio. invitado = visita de un pase de invitados. */
  rol?: "miembro" | "invitado";
  invitaSocioId?: string;
  invitaNombre?: string;
  /** Si existe, la ficha está archivada: no sale en el listado, pero se conserva (pagos/subs). */
  deletedAt?: string | null;
};

function readAll(): Socio[] {
  const arr = readJsonFile<Socio[]>(FILE, []);
  return Array.isArray(arr) ? arr : [];
}

function writeAll(list: Socio[]) {
  writeJsonFile(FILE, list);
}

function mutate(mutator: (list: Socio[]) => void) {
  updateJsonFileSync<Socio[]>(FILE, [], mutator);
}

export function addSocio(s: Socio) {
  mutate((list) => {
    list.push(s);
  });
  return s;
}

export function updateSocio(id: string, patch: Partial<Socio>) {
  let updated: Socio | null = null;
  mutate((list) => {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) {
      list[i] = { ...list[i], ...patch };
      updated = list[i];
    }
  });
  return updated;
}

export function getSocio(id: string): Socio | undefined {
  return readAll().find((s) => s.id === id);
}

export function listSocios(gymId: string | null, opts?: { includeDeleted?: boolean }): Socio[] {
  const list = readAll();
  const filtered = gymId ? list.filter((s) => s.gymId === gymId) : list;
  const visible = opts?.includeDeleted ? filtered : filtered.filter((s) => !s.deletedAt);
  return visible.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** IDs de todas las fichas (también archivadas). Lo demás en acceso es huérfano. */
export function allSocioIds(): string[] {
  return readAll().map((s) => s.id);
}

export function archiveSocio(id: string): Socio | null {
  return updateSocio(id, { deletedAt: new Date().toISOString() });
}

export function restoreSocio(id: string): Socio | null {
  return updateSocio(id, { deletedAt: null, estado: "pendiente_enrolamiento" });
}

export function findSocioByDoc(gymId: string, docNumero: string): Socio | undefined {
  const doc = String(docNumero || "").trim();
  if (!doc) return undefined;
  const hits = readAll().filter((s) => s.gymId === gymId && s.docNumero === doc && !s.deletedAt);
  return hits.find((s) => s.rol !== "invitado") || hits[0];
}

export function findSocioByPhone(gymId: string, celular: string): Socio | undefined {
  const cel = String(celular || "").replace(/[^\d]/g, "");
  if (cel.length < 10) return undefined;
  return readAll().find((s) => s.gymId === gymId && s.celular === cel);
}

/** Ficha archivada con el mismo documento. Es la misma persona, no un alta nueva. */
export function findArchivedByDoc(gymId: string, docNumero: string): Socio | undefined {
  const doc = String(docNumero || "").trim();
  if (!doc) return undefined;
  return readAll().find((s) => s.gymId === gymId && !!s.deletedAt && s.docNumero === doc && s.rol !== "invitado");
}

/** El celular de una ficha archivada no bloquea a otra persona. */
export function releaseArchivedPhone(gymId: string, celular: string) {
  const cel = String(celular || "").replace(/[^\d]/g, "");
  if (cel.length < 10) return;
  const list = readAll();
  let changed = false;
  for (const s of list) {
    if (s.gymId === gymId && s.deletedAt && s.celular === cel) {
      s.celular = "";
      changed = true;
    }
  }
  if (changed) writeAll(list);
}

/** La puerta olvidó al sujeto. La ficha pasa a usar el id nuevo. */
export function retargetSocio(oldId: string, newId: string): Socio | null {
  if (!oldId || !newId || oldId === newId) return getSocio(oldId) || null;
  const list = readAll();
  const i = list.findIndex((s) => s.id === oldId);
  if (i < 0 || list.some((s) => s.id === newId)) return null;
  list[i] = { ...list[i], id: newId };
  writeAll(list);
  return list[i];
}
