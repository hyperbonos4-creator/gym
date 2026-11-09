import fs from "fs";
import path from "path";
import { dataDir } from "./dataDir";
import { randomUUID } from "crypto";
import { getSocio } from "./sociosStore";
import { getRoutine } from "./routinesStore";
import { latestPublished } from "./routineTypes";

const FILE = path.join(dataDir(), "routine-assignments.json");

export type RoutineAssignment = {
  id: string;
  gymId: string;
  socioId: string;
  templateId: string;
  versionId: string;
  versionNumber: number;
  startDate: string;
  status: "vigente" | "cerrada";
  note: string;
  assignedAt: string;
  assignedBy: string;
  closedAt: string | null;
};

function readAll(): RoutineAssignment[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows: RoutineAssignment[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), "utf-8");
}

function text(v: unknown, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

function dateOnly(v: unknown) {
  const s = text(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("fecha_invalida");
  return s;
}

export function listAssignments(gymId: string) {
  return readAll()
    .filter((row) => row.gymId === gymId)
    .sort((a, b) => (a.assignedAt < b.assignedAt ? 1 : -1));
}

export function activeAssignment(gymId: string, socioId: string) {
  return listAssignments(gymId).find((row) => row.socioId === socioId && row.status === "vigente") || null;
}

export function presentAssignment(row: RoutineAssignment) {
  const socio = getSocio(row.socioId);
  const template = getRoutine(row.gymId, row.templateId);
  const version = template?.versions.find((v) => v.id === row.versionId) || null;
  const latest = template ? latestPublished(template) : null;
  return {
    ...row,
    socioNombre: socio?.nombre || "Socio archivado",
    templateName: template?.name || "Plantilla eliminada",
    versionAlive: Boolean(version),
    latestNumber: latest?.number ?? null,
    canUpdate: Boolean(row.status === "vigente" && latest && latest.id !== row.versionId),
  };
}

export function assignRoutine(input: {
  gymId: string;
  socioId: string;
  templateId: string;
  startDate: string;
  note?: string;
  by: string;
}) {
  const socio = getSocio(text(input.socioId, 80));
  if (!socio || socio.gymId !== input.gymId || socio.deletedAt) throw new Error("socio_no_encontrado");
  const template = getRoutine(input.gymId, text(input.templateId, 80));
  const version = template ? latestPublished(template) : null;
  if (!template || !version) throw new Error("sin_version_publicada");
  const now = new Date().toISOString();
  const rows = readAll().map((row) => {
    if (row.gymId === input.gymId && row.socioId === socio.id && row.status === "vigente") {
      return { ...row, status: "cerrada" as const, closedAt: now };
    }
    return row;
  });
  const created: RoutineAssignment = {
    id: randomUUID(),
    gymId: input.gymId,
    socioId: socio.id,
    templateId: template.id,
    versionId: version.id,
    versionNumber: version.number,
    startDate: dateOnly(input.startDate),
    status: "vigente",
    note: text(input.note, 280),
    assignedAt: now,
    assignedBy: input.by || "entrenador",
    closedAt: null,
  };
  rows.push(created);
  writeAll(rows);
  return created;
}

export function closeAssignment(gymId: string, id: string) {
  const rows = readAll();
  const i = rows.findIndex((row) => row.gymId === gymId && row.id === id);
  if (i < 0) throw new Error("asignacion_no_encontrada");
  if (rows[i].status === "cerrada") return rows[i];
  rows[i] = { ...rows[i], status: "cerrada", closedAt: new Date().toISOString() };
  writeAll(rows);
  return rows[i];
}

export function updateAssignmentVersion(gymId: string, id: string) {
  const rows = readAll();
  const i = rows.findIndex((row) => row.gymId === gymId && row.id === id);
  if (i < 0) throw new Error("asignacion_no_encontrada");
  if (rows[i].status !== "vigente") throw new Error("asignacion_cerrada");
  const template = getRoutine(gymId, rows[i].templateId);
  const latest = template ? latestPublished(template) : null;
  if (!latest) throw new Error("sin_version_publicada");
  if (latest.id === rows[i].versionId) throw new Error("ya_actualizada");
  rows[i] = { ...rows[i], versionId: latest.id, versionNumber: latest.number };
  writeAll(rows);
  return rows[i];
}

export function closeAssignmentsForTemplate(gymId: string, templateId: string) {
  const now = new Date().toISOString();
  const rows = readAll().map((row) => {
    if (row.gymId === gymId && row.templateId === templateId && row.status === "vigente") {
      return { ...row, status: "cerrada" as const, closedAt: now };
    }
    return row;
  });
  writeAll(rows);
}
