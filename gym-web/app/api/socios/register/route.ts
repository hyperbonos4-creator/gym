import { NextResponse } from "next/server";
import { guardGym } from "../../../../lib/authServer";
import { gymInstance } from "../../../../lib/gymsStore";
import { createSubject, ensureAccessSubject, grantConsent, resetFaceForReenroll } from "../../../../lib/accessBackend";
import { retargetInvitationOwner } from "../../../../lib/invitations";
import { retargetMembershipSocio } from "../../../../lib/memberships";
import { waSendText } from "../../../../lib/evolution";
import { addSocio, findArchivedByDoc, findSocioByDoc, findSocioByPhone, releaseArchivedPhone, restoreSocio, retargetSocio, updateSocio, type Socio } from "../../../../lib/sociosStore";
import { isLocalBase } from "../../../../lib/publicUrl";
import { appWelcomeMessage, buildEnrollLink } from "../../../../lib/enrollLink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function digits(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

export async function POST(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }

  const nombre = String(b?.nombre || "").trim();
  const cel = digits(b?.celular);
  const cc = digits(b?.codigoPais) || "57";
  const gymId = String(b?.gym || "fuerza-elite");
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const instance = gymInstance(gymId);

  if (!nombre) return NextResponse.json({ ok: false, error: "nombre_requerido" }, { status: 400 });
  if (cel.length < 10) return NextResponse.json({ ok: false, error: "celular_invalido" }, { status: 400 });

  const telE164 = cel.length === 10 ? cc + cel : cel;
  const docNumero = String(b?.docNumero || "").trim();

  const dupDoc = docNumero ? findSocioByDoc(gymId, docNumero) : undefined;
  const dupPhone = findSocioByPhone(gymId, cel);
  if (dupDoc && !dupDoc.deletedAt) {
    return NextResponse.json(
      { ok: false, error: "documento_duplicado", socioId: dupDoc.id, nombre: dupDoc.nombre },
      { status: 409 },
    );
  }
  if (dupPhone && !dupPhone.deletedAt) {
    return NextResponse.json(
      { ok: false, error: "celular_duplicado", socioId: dupPhone.id, nombre: dupPhone.nombre },
      { status: 409 },
    );
  }
  const archived = docNumero ? findArchivedByDoc(gymId, docNumero) : null;
  if (archived) {
    try {
      let subjectId = archived.id;
      const alive = await resetFaceForReenroll(subjectId);
      if (!alive) {
        try {
          await ensureAccessSubject(subjectId, nombre || archived.nombre, docNumero || undefined);
        } catch {
          const subject = await createSubject(nombre || archived.nombre, docNumero || undefined);
          try {
            await grantConsent(subject.id);
          } catch {
            /* si ya existe, continuar */
          }
          retargetSocio(subjectId, subject.id);
          retargetMembershipSocio(subjectId, subject.id);
          retargetInvitationOwner(subjectId, subject.id);
          subjectId = subject.id;
        }
      }
      const link = await buildEnrollLink(req, subjectId, nombre || archived.nombre);
      const socio = restoreSocio(subjectId);
      if (socio) {
        const saved = updateSocio(subjectId, {
          nombre,
          docTipo: String(b?.docTipo || socio.docTipo || "CC"),
          docNumero,
          codigoPais: cc,
          celular: cel,
          email: String(b?.email || socio.email || "").trim(),
          enrollLink: link,
          estado: "pendiente_enrolamiento",
        }) || socio;
        const wa = await waSendText(instance, telE164, appWelcomeMessage(saved.nombre));
        return NextResponse.json({ ok: true, restored: true, socio: saved, link, wa });
      }
      return NextResponse.json({ ok: false, error: "no_se_pudo_restaurar" }, { status: 400 });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
    }
  }
  releaseArchivedPhone(gymId, cel);

  try {
    // 1) Crear socio en el backend de acceso (id biométrico). El documento se
    //    guarda como employeeCode para referencia cruzada.
    const subject = await createSubject(nombre, docNumero || undefined);
    // La ficha entra ya, antes de cualquier otra espera, para que un listado
    // paralelo no tome este sujeto como huérfano.
    const socio: Socio = {
      id: subject.id,
      gymId,
      createdAt: new Date().toISOString(),
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
      estado: "pendiente_enrolamiento",
      enrollLink: "",
    };
    addSocio(socio);
    // 2) Consentimiento (necesario para enrolar el rostro).
    let consent = false;
    try {
      await grantConsent(subject.id);
      consent = true;
    } catch {
      /* si ya existe, continuar */
    }
    // 3) Link corto de enrolamiento (el JWT no viaja por WhatsApp).
    const link = await buildEnrollLink(req, subject.id, nombre);
    if (isLocalBase(link)) {
      console.warn("[socios/register] el link quedó en localhost: el celular no podrá abrirlo. Levanta ngrok.");
    }
    const saved = updateSocio(subject.id, { enrollLink: link }) || { ...socio, enrollLink: link };

    const wa = await waSendText(instance, telE164, appWelcomeMessage(nombre));

    return NextResponse.json({ ok: true, socio: saved, link, wa, consent });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
