import { NextResponse } from "next/server";
import { waSendText } from "../../../../lib/evolution";
import { guestWallet } from "../../../../lib/memberships";
import { openHolds } from "../../../../lib/invitations";
import { issueMobileToken, loginMobile } from "../../../../lib/mobileSession";
import { mobileOtpRequired, requestMobileOtp, verifyMobileOtp } from "../../../../lib/mobileOtp";
import { clientIp, rateLimit } from "../../../../lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionPayload(gymId: string, socioId: string, socioName: string, doc: string, token: string) {
  const wallet = guestWallet(gymId, socioId);
  const apartados = openHolds(gymId, socioId);
  return {
    ok: true,
    token,
    ownerName: socioName,
    doc,
    left: wallet.left,
    disponibles: Math.max(0, wallet.left - apartados),
    apartados,
    total: wallet.total,
    until: wallet.until,
  };
}

export async function POST(req: Request) {
  const limited = rateLimit(`mobile-login:${clientIp(req)}`, 30, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "demasiados_intentos" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || "fuerza-elite");
  const doc = String(body.doc || "");
  const phone = String(body.phone || "");
  const code = String(body.code || body.otp || "").trim();
  const action = String(body.action || (code ? "verify" : "request")).toLowerCase();

  if (!mobileOtpRequired()) {
    const session = loginMobile(gymId, doc, phone);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "El documento y el WhatsApp no coinciden con un titular." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      sessionPayload(gymId, session.socio.id, session.socio.nombre, session.socio.docNumero, session.token),
    );
  }

  if (action === "verify") {
    const verified = verifyMobileOtp({ gymId, doc, phone, code });
    if (!verified.ok) {
      return NextResponse.json({ ok: false, error: "Código inválido o vencido." }, { status: 401 });
    }
    const token = issueMobileToken(verified.socio.id, gymId);
    return NextResponse.json(
      sessionPayload(gymId, verified.socio.id, verified.socio.nombre, verified.socio.docNumero, token),
    );
  }

  const sent = await requestMobileOtp({
    gymId,
    doc,
    phone,
    instance: gymId,
    send: async (instance, to, text) => waSendText(instance, to, text),
  });
  if (!sent.ok) {
    const msg =
      sent.error === "whatsapp_no_conectado"
        ? "WhatsApp del gimnasio no está conectado."
        : sent.error === "demasiados_intentos"
          ? "Demasiados intentos. Espera unos minutos."
          : "El documento y el WhatsApp no coinciden con un titular.";
    return NextResponse.json({ ok: false, error: msg }, { status: sent.error === "demasiados_intentos" ? 429 : 401 });
  }
  return NextResponse.json({
    ok: true,
    otpSent: true,
    ...(sent.demoCode ? { demoCode: sent.demoCode } : {}),
  });
}
