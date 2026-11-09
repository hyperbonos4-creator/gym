import { cuentaDeGym } from "./cuentas";
import { invitationSubjectGyms } from "./invitations";
import { listSocios } from "./sociosStore";
import { turnstileDoors } from "./turnstiles";

export type AccessScope = {
  ownSubjects: Set<string>;
  foreignSubjects: Set<string>;
  ownDoors: Set<string>;
  foreignDoors: Set<string>;
  /** Sede anterior a las cuentas: conserva el registro de la puerta física que no está asignada. */
  legacy: boolean;
};

export function accessScope(gymId: string): AccessScope {
  const ownSubjects = new Set<string>();
  const foreignSubjects = new Set<string>();
  for (const socio of listSocios(null, { includeDeleted: true })) {
    if (socio.gymId === gymId) ownSubjects.add(socio.id);
    else foreignSubjects.add(socio.id);
  }
  for (const row of invitationSubjectGyms()) {
    if (row.gymId === gymId) ownSubjects.add(row.subjectId);
    else foreignSubjects.add(row.subjectId);
  }
  const ownDoors = new Set<string>();
  const foreignDoors = new Set<string>();
  for (const door of turnstileDoors()) {
    if (door.gymId === gymId) ownDoors.add(door.pointId);
    else foreignDoors.add(door.pointId);
  }
  return { ownSubjects, foreignSubjects, ownDoors, foreignDoors, legacy: !cuentaDeGym(gymId) };
}

export function eventBelongsToGym(
  ev: { subjectId?: string | null; subject_id?: string | null; accessPointId?: string | null; access_point_id?: string | null },
  scope: AccessScope,
) {
  const subjectId = String(ev.subjectId || ev.subject_id || "");
  if (subjectId && scope.ownSubjects.has(subjectId)) return true;
  if (subjectId && scope.foreignSubjects.has(subjectId)) return false;
  const pointId = String(ev.accessPointId || ev.access_point_id || "");
  if (pointId && scope.ownDoors.has(pointId)) return true;
  if (pointId && scope.foreignDoors.has(pointId)) return false;
  return scope.legacy;
}
