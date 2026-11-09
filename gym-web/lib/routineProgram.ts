import { EXERCISES } from "./exercisesCatalog";
import { movementPayload } from "./movement";
import { activeAssignment } from "./routineAssignments";
import type { RoutineBlock, RoutineDay } from "./routineTypes";
import { getRoutine } from "./routinesStore";

export function calendarDate(timeZone = "America/Bogota", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function daysBetween(start: string, today: string) {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

function itemsOfDay(day: RoutineDay) {
  if (day.rest) return [];
  return day.blocks.flatMap((block: RoutineBlock) => block.items.flatMap((item) => {
    const exercise = EXERCISES.find((entry) => entry.id === item.exerciseId);
    if (!exercise) return [];
    const alternative = EXERCISES.find((entry) => entry.id === item.alternativeId);
    return [{
      ...movementPayload(exercise),
      block: block.kind,
      sets: item.sets,
      reps: item.reps,
      restSec: item.restSec,
      load: item.load,
      effort: item.effort,
      tempo: item.tempo || exercise.tempo,
      note: item.note,
      alternativeName: alternative?.name || "",
      dayLabel: day.label,
      dayTitle: day.title,
      source: "rutina" as const,
    }];
  }));
}

/** La sesión que le toca hoy al socio, tomada de la versión asignada. */
export function programForSocio(gymId: string, socioId: string, today = calendarDate()) {
  const assignment = activeAssignment(gymId, socioId);
  if (!assignment) return null;
  const template = getRoutine(gymId, assignment.templateId);
  const version = template?.versions.find((item) => item.id === assignment.versionId) || null;
  if (!template || !version) {
    return {
      assignmentId: assignment.id,
      name: template?.name || "Rutina",
      goal: template?.goal || "",
      level: template?.level || "",
      version: assignment.versionNumber,
      startDate: assignment.startDate,
      today,
      missing: true,
      upcoming: false,
      rest: false,
      todayLabel: "",
      todayTitle: "",
      items: [],
      feed: [],
      week: [],
    };
  }
  const offset = daysBetween(assignment.startDate, today);
  const upcoming = offset < 0 || version.days.length === 0;
  const index = upcoming ? -1 : offset % version.days.length;
  const day = index >= 0 ? version.days[index] : null;
  const items = day ? itemsOfDay(day) : [];
  return {
    assignmentId: assignment.id,
    name: template.name,
    goal: template.goal,
    level: template.level,
    version: version.number,
    startDate: assignment.startDate,
    today,
    missing: false,
    upcoming,
    rest: Boolean(day?.rest),
    todayLabel: day?.label || "",
    todayTitle: day?.rest ? "Descanso" : day?.title || "",
    items,
    feed: version.days.flatMap((entry) => itemsOfDay(entry).map((item) => ({ ...item, sentAt: assignment.assignedAt }))),
    week: version.days.map((entry, i) => ({
      label: entry.label,
      title: entry.rest ? "Descanso" : entry.title,
      rest: entry.rest,
      count: entry.blocks.reduce((n, block) => n + block.items.length, 0),
      today: i === index,
      items: itemsOfDay(entry),
    })),
  };
}
