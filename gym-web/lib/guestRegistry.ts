import { listSubjects } from "./accessBackend";
import { markGuestEnrolled } from "./invitations";
import { addSocio, getSocio, updateSocio, type Socio } from "./sociosStore";
import type { Invitation } from "./invitations";

function upsertGuest(row: Invitation) {
  if (!row.subjectId || !row.enrolledAt) return;
  const existing = getSocio(row.subjectId);
  if (existing) {
    updateSocio(existing.id, {
      rol: "invitado",
      estado: "enrolado",
      invitaSocioId: row.ownerSocioId,
      invitaNombre: row.ownerName,
      nombre: row.guestName || existing.nombre,
      docNumero: row.guestDoc || existing.docNumero,
    });
    return;
  }
  const socio: Socio = {
    id: row.subjectId,
    gymId: row.gymId,
    createdAt: new Date().toISOString(),
    docTipo: "CC",
    docNumero: row.guestDoc,
    nombre: row.guestName,
    fechaNac: "",
    genero: "",
    codigoPais: "57",
    celular: "",
    email: "",
    enviarEmails: false,
    direccion: "",
    prospecto: false,
    empresa: "",
    contactoRespaldoNombre: row.ownerName,
    contactoRespaldoTel: "",
    observaciones: `Invitado de ${row.ownerName}`,
    estado: "enrolado",
    enrollLink: row.enrollUrl || "",
    rol: "invitado",
    invitaSocioId: row.ownerSocioId,
    invitaNombre: row.ownerName,
  };
  addSocio(socio);
}

export async function confirmGuestSubject(subjectId: string) {
  const subjects = await listSubjects();
  const subject = subjects.find((s) => String(s?.id || "") === subjectId);
  if (!subject?.hasBiometrics) return null;
  const row = markGuestEnrolled(subjectId);
  if (row?.enrolledAt) upsertGuest(row);
  return row;
}

export async function confirmGuestRegistrations() {
  const subjects = await listSubjects();
  for (const subject of subjects) {
    if (!subject?.hasBiometrics || !subject?.id) continue;
    const row = markGuestEnrolled(String(subject.id));
    if (row?.enrolledAt) upsertGuest(row);
  }
}
