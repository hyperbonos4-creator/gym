import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { getSocio } from "./sociosStore";
import { activeAssignment } from "./routineAssignments";
import { getRoutine } from "./routinesStore";
import {
  emptyMeasures,
  type Assessment,
  type AssessmentKind,
  type AssessmentPhoto,
  type BodyMeasures,
  type PerformanceTest,
  type PhotoView,
} from "./assessmentTypes";

const FILE = path.join(process.cwd(), "data", "assessments.json");
const MEDIA = path.join(process.cwd(), "data", "assessment-media");

function readAll(): Assessment[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(rows: Assessment[]) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), "utf-8");
}

function text(value: unknown, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function dateOnly(value: unknown) {
  const raw = text(value, 10);
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("fecha_invalida");
  return raw;
}

function optionalNumber(value: unknown) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 500) throw new Error("medida_invalida");
  return Math.round(n * 10) / 10;
}

function measuresOf(input: unknown): BodyMeasures {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const base = emptyMeasures();
  (Object.keys(base) as (keyof BodyMeasures)[]).forEach((key) => {
    if (key === "compositionMethod" || key === "compositionValue" || key === "compositionNote" || key === "note") return;
    base[key] = optionalNumber(raw[key]);
  });
  base.compositionMethod = text(raw.compositionMethod, 80);
  base.compositionValue = text(raw.compositionValue, 40);
  base.compositionNote = text(raw.compositionNote, 400);
  base.note = text(raw.note, 800);
  return base;
}

function testsOf(input: unknown): PerformanceTest[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 40).map((row) => {
    const item = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const category: PerformanceTest["category"] = item.category === "resistencia" || item.category === "movilidad" ? item.category : "muscular";
    return {
      id: text(item.id, 80) || randomUUID(),
      category,
      exerciseId: text(item.exerciseId, 80),
      name: text(item.name, 120),
      protocol: text(item.protocol, 240),
      result: text(item.result, 40),
      unit: text(item.unit, 20),
      note: text(item.note, 400),
    };
  }).filter((item) => item.name || item.result || item.exerciseId);
}

function routineSnapshot(gymId: string, socioId: string) {
  const link = activeAssignment(gymId, socioId);
  if (!link) return { routineTemplateId: "", routineName: "", routineVersion: null as number | null };
  const template = getRoutine(gymId, link.templateId);
  return {
    routineTemplateId: link.templateId,
    routineName: template?.name || "",
    routineVersion: link.versionNumber,
  };
}

export function listAssessments(gymId: string) {
  return readAll()
    .filter((row) => row.gymId === gymId)
    .sort((a, b) => (a.measuredAt < b.measuredAt ? 1 : -1));
}

export function assessmentsForSocio(gymId: string, socioId: string) {
  return listAssessments(gymId).filter((row) => row.socioId === socioId);
}

export function getAssessment(gymId: string, id: string) {
  return readAll().find((row) => row.gymId === gymId && row.id === id) || null;
}

export function createAssessment(input: { gymId: string; socioId: string; kind?: AssessmentKind; by: string }) {
  const socio = getSocio(text(input.socioId, 80));
  if (!socio || socio.deletedAt || socio.gymId !== input.gymId || socio.rol === "invitado") throw new Error("socio_no_encontrado");
  const now = new Date().toISOString();
  const kind: AssessmentKind = input.kind === "seguimiento" || input.kind === "cierre" ? input.kind : "inicial";
  const row: Assessment = {
    id: randomUUID(),
    gymId: input.gymId,
    socioId: socio.id,
    kind,
    status: "borrador",
    createdAt: now,
    updatedAt: now,
    measuredAt: now.slice(0, 10),
    measuredBy: text(input.by, 80),
    goal: "",
    notes: "",
    limitations: "",
    screeningChecked: false,
    measures: emptyMeasures(),
    tests: [],
    photos: [],
    photoConsent: false,
    objectives: "",
    nextReview: "",
    routineNote: "",
    ...routineSnapshot(input.gymId, socio.id),
  };
  const all = readAll();
  all.push(row);
  writeAll(all);
  return row;
}

export function updateAssessment(gymId: string, id: string, patch: Record<string, unknown>) {
  const all = readAll();
  const index = all.findIndex((row) => row.gymId === gymId && row.id === id);
  if (index < 0) throw new Error("valoracion_no_encontrada");
  const current = all[index];
  if (current.status === "cerrada") throw new Error("valoracion_cerrada");
  const kind = patch.kind === "seguimiento" || patch.kind === "cierre" || patch.kind === "inicial" ? patch.kind : current.kind;
  const next: Assessment = {
    ...current,
    kind,
    measuredAt: patch.measuredAt == null ? current.measuredAt : dateOnly(patch.measuredAt),
    goal: patch.goal == null ? current.goal : text(patch.goal, 120),
    notes: patch.notes == null ? current.notes : text(patch.notes, 1200),
    limitations: patch.limitations == null ? current.limitations : text(patch.limitations, 1200),
    screeningChecked: patch.screeningChecked == null ? current.screeningChecked : Boolean(patch.screeningChecked),
    measures: patch.measures == null ? current.measures : measuresOf(patch.measures),
    tests: patch.tests == null ? current.tests : testsOf(patch.tests),
    photoConsent: patch.photoConsent == null ? current.photoConsent : Boolean(patch.photoConsent),
    objectives: patch.objectives == null ? current.objectives : text(patch.objectives, 1200),
    nextReview: patch.nextReview == null ? current.nextReview : dateOnly(patch.nextReview),
    routineNote: patch.routineNote == null ? current.routineNote : text(patch.routineNote, 800),
    updatedAt: new Date().toISOString(),
  };
  if (patch.close === true) {
    if (!next.screeningChecked) throw new Error("sin_cribado");
    if (!next.measuredAt) throw new Error("fecha_invalida");
    next.status = "cerrada";
    Object.assign(next, routineSnapshot(gymId, next.socioId));
  }
  all[index] = next;
  writeAll(all);
  return next;
}

export function deleteDraft(gymId: string, id: string) {
  const all = readAll();
  const row = all.find((item) => item.gymId === gymId && item.id === id);
  if (!row) throw new Error("valoracion_no_encontrada");
  if (row.status !== "borrador") throw new Error("valoracion_cerrada");
  for (const photo of row.photos) removePhotoFile(row, photo.id);
  writeAll(all.filter((item) => item.id !== id));
}

function mediaPath(row: Assessment, photoId: string, ext: string) {
  return path.join(MEDIA, row.gymId, row.id, `${photoId}.${ext}`);
}

function removePhotoFile(row: Assessment, photoId: string) {
  for (const ext of ["jpg", "png", "webp"]) {
    const file = mediaPath(row, photoId, ext);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

const MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function addPhoto(gymId: string, id: string, input: { view: PhotoView; note: string; mime: string; bytes: Buffer }) {
  const ext = MIME[input.mime];
  if (!ext) throw new Error("archivo_invalido");
  if (input.bytes.length < 32 || input.bytes.length > 4_000_000) throw new Error("archivo_invalido");
  const all = readAll();
  const index = all.findIndex((row) => row.gymId === gymId && row.id === id);
  if (index < 0) throw new Error("valoracion_no_encontrada");
  const row = all[index];
  if (row.status === "cerrada") throw new Error("valoracion_cerrada");
  if (!row.photoConsent) throw new Error("sin_consentimiento");
  const photo: AssessmentPhoto = {
    id: randomUUID(),
    view: input.view === "lateral" || input.view === "posterior" ? input.view : "frontal",
    at: new Date().toISOString(),
    note: text(input.note, 240),
  };
  const file = mediaPath(row, photo.id, ext);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, input.bytes);
  row.photos = [...row.photos, photo];
  row.updatedAt = photo.at;
  all[index] = row;
  writeAll(all);
  return row;
}

export function readPhoto(gymId: string, id: string, photoId: string) {
  const row = getAssessment(gymId, id);
  const photo = row?.photos.find((item) => item.id === photoId);
  if (!row || !photo) return null;
  for (const ext of ["jpg", "png", "webp"]) {
    const file = mediaPath(row, photo.id, ext);
    if (!fs.existsSync(file)) continue;
    const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { bytes: fs.readFileSync(file), type };
  }
  return null;
}
