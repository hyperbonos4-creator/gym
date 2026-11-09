import { NextResponse } from "next/server";
import { socioFromMobileRequest } from "../../../../lib/mobileSession";
import { approveMobilePayment, createMobilePayment, listMobilePayments, rejectMobilePayment } from "../../../../lib/mobilePayments";
import { checkoutUrl, lookupTransaction, wompiConfig } from "../../../../lib/wompi";
import { resolvePublicBase } from "../../../../lib/publicUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sync(reference: string) {
  const found = await lookupTransaction(reference).catch(() => null);
  if (!found) return null;
  if (found.status === "APPROVED") return approveMobilePayment(reference, found.id);
  if (found.status === "DECLINED" || found.status === "ERROR" || found.status === "VOIDED") return rejectMobilePayment(reference, found.id);
  return null;
}

export async function GET(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  const reference = new URL(req.url).searchParams.get("reference");
  const pending = listMobilePayments(session.gymId, session.socio.id).filter((p) => p.status === "pendiente").slice(0, 3);
  const refs = new Set(pending.map((p) => p.reference));
  if (reference) refs.add(reference);
  for (const ref of refs) await sync(ref);
  return NextResponse.json({
    ok: true,
    wompi: wompiConfig().ready,
    payments: listMobilePayments(session.gymId, session.socio.id),
  });
}

export async function POST(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  if (!wompiConfig().ready) {
    return NextResponse.json({
      ok: false,
      error: "Wompi aún no está conectado en el gimnasio. El plan no se cobró.",
    }, { status: 409 });
  }
  const body = await req.json().catch(() => ({}));
  let payment;
  try {
    payment = createMobilePayment(session.gymId, session.socio.id, String(body.planId || ""));
  } catch (e: any) {
    const code = String(e?.message || "");
    const error = code === "plan_no_disponible"
      ? "Ese plan no está disponible."
      : code === "monto_invalido"
        ? "Ese plan está por debajo de $50. Wompi no abre el cobro."
        : "No se pudo abrir el pago.";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
  const base = await resolvePublicBase(req);
  const url = checkoutUrl({
    reference: payment.reference,
    amountInCents: payment.amount * 100,
    name: session.socio.nombre,
    phone: session.socio.celular,
    email: session.socio.email || "",
    redirect: `${base}/api/mobile/pagos/retorno?reference=${encodeURIComponent(payment.reference)}`,
  });
  return NextResponse.json({
    ok: true,
    reference: payment.reference,
    amount: payment.amount,
    planName: payment.planName,
    checkoutUrl: url,
  });
}
