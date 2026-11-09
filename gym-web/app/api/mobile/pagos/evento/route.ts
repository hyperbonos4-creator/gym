import { NextResponse } from "next/server";
import { approveMobilePayment, rejectMobilePayment } from "../../../../../lib/mobilePayments";
import { eventChecksumOk } from "../../../../../lib/wompi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!eventChecksumOk(body)) return NextResponse.json({ ok: false }, { status: 401 });
  const tx = body?.data?.transaction;
  const reference = String(tx?.reference || "");
  const status = String(tx?.status || "");
  const id = String(tx?.id || "");
  if (reference && status === "APPROVED") await approveMobilePayment(reference, id);
  if (reference && (status === "DECLINED" || status === "ERROR" || status === "VOIDED")) rejectMobilePayment(reference, id);
  return NextResponse.json({ ok: true });
}
