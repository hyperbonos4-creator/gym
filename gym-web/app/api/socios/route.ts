import { NextResponse } from "next/server";
import { guardGym } from "../../../lib/authServer";
import { allSocioIds, archiveSocio, findSocioByDoc, findSocioByPhone, getSocio, listSocios, updateSocio } from "../../../lib/sociosStore";
import { ensureAccessSubject, listSubjects, purgeOrphanSubjects, resetFaceForReenroll, updateSubjectProfile } from "../../../lib/accessBackend";
import { buildEnrollLink, isLegacyEnrollLink } from "../../../lib/enrollLink";
import { confirmGuestRegistrations } from "../../../lib/guestRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gymId = searchParams.get("gym") || "fuerza-elite";
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  await confirmGuestRegistrations().catch(() => undefined);
  const socios = listSocios(gymId);

  let subjects: any[] = [];
  try {
    await purgeOrphanSubjects(allSocioIds());
    subjects = await listSubjects();
  } catch {
    subjects = [];
  }
  const byId = new Map(subjects.map((s) => [s.id, s]));

  const items = await Promise.all(socios.map(async (s) => {
    const bio = byId.get(s.id);
    const enrolado = !!bio?.hasBiometrics;
    if (enrolado && s.estado !== "enrolado") updateSocio(s.id, { estado: "enrolado" });
    if (!enrolado && s.estado === "enrolado") updateSocio(s.id, { estado: "pendiente_enrolamiento" });
    let enrollLink = s.enrollLink;
    if (isLegacyEnrollLink(enrollLink)) {
      try {
        enrollLink = await buildEnrollLink(req, s.id, s.nombre);
        updateSocio(s.id, { enrollLink });
      } catch {
        /* se queda el link largo hasta el próximo intento */
      }
    }
    return {
      ...s,
      enrollLink,
      estado: enrolado ? "enrolado" : "pendiente_enrolamiento",
      facial: bio
        ? {
            hasBiometrics: !!bio.hasBiometrics,
            templateCount: bio.templateCount ?? 0,
            hasPortrait: !!bio.hasPortrait,
            hasConsent: !!bio.hasConsent,
            lastAccessAt: bio.lastAccessAt ?? null,
          }
        : { hasBiometrics: false, templateCount: 0, hasPortrait: false, hasConsent: false, lastAccessAt: null },
    };
  }));

  return NextResponse.json(
    {
      items,
      totals: {
        total: items.length,
        enrolados: items.filter((s) => s.estado === "enrolado").length,
        pendientes: items.filter((s) => s.estado !== "enrolado").length,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function digits(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

/** Actualiza la ficha. No envía WhatsApp ni toca la membresía. */
export async function PATCH(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  const id = String(b?.id || "").trim();
  const socio = id ? getSocio(id) : undefined;
  if (!socio || socio.deletedAt) {
    return NextResponse.json({ ok: false, error: "cliente_no_encontrado" }, { status: 404 });
  }
  const auth = guardGym(req, socio.gymId || "fuerza-elite");
  if (auth instanceof NextResponse) return auth;
  const nombre = String(b?.nombre || "").trim();
  const cel = digits(b?.celular);
  const cc = digits(b?.codigoPais) || "57";
  const docNumero = String(b?.docNumero || "").trim();
  if (!nombre) return NextResponse.json({ ok: false, error: "nombre_requerido" }, { status: 400 });
  if (cel.length < 10) return NextResponse.json({ ok: false, error: "celular_invalido" }, { status: 400 });
  const gymId = socio.gymId || "fuerza-elite";
  const dupDoc = docNumero ? findSocioByDoc(gymId, docNumero) : undefined;
  const dupPhone = findSocioByPhone(gymId, cel);
  if (dupDoc && dupDoc.id !== id && !dupDoc.deletedAt) {
    return NextResponse.json({ ok: false, error: "documento_duplicado", nombre: dupDoc.nombre }, { status: 409 });
  }
  if (dupPhone && dupPhone.id !== id && !dupPhone.deletedAt) {
    return NextResponse.json({ ok: false, error: "celular_duplicado", nombre: dupPhone.nombre }, { status: 409 });
  }
  const saved = updateSocio(id, {
    docTipo: String(b?.docTipo || "CC"),
    docNumero,
    nombre,
    fechaNac: String(b?.fechaNac || ""),
    genero: String(b?.genero || ""),
    codigoPais: cc,
    celular: cel,
    email: String(b?.email || "").trim(),
    enviarEmails: !!b?.enviarEmails,
    direccion: String(b?.direccion || "").trim(),
    prospecto: !!b?.prospecto,
    empresa: String(b?.empresa || "").trim(),
    contactoRespaldoNombre: String(b?.contactoRespaldoNombre || "").trim(),
    contactoRespaldoTel: digits(b?.contactoRespaldoTel),
    observaciones: String(b?.observaciones || "").trim(),
  });
  let door = true;
  try {
    await ensureAccessSubject(id, nombre, docNumero);
  } catch {
    try {
      await updateSubjectProfile(id, nombre, docNumero);
    } catch {
      door = false;
    }
  }
  return NextResponse.json({ ok: true, socio: saved, door });
}

/** Archiva el cliente: borra el rostro, oculta la ficha, conserva el registro (pagos/subs). */
export async function DELETE(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  const id = String(b?.id || new URL(req.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "id_requerido" }, { status: 400 });
  const socio = getSocio(id);
  if (!socio || socio.deletedAt) {
    return NextResponse.json({ ok: false, error: "cliente_no_encontrado" }, { status: 404 });
  }
  const auth = guardGym(req, socio.gymId || "fuerza-elite");
  if (auth instanceof NextResponse) return auth;
  try {
    await resetFaceForReenroll(id);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
  archiveSocio(id);
  return NextResponse.json({ ok: true, kept: true });
}
