import { NextResponse } from "next/server";
import { confirmGuestSubject } from "../../../../lib/guestRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** El registro facial avisa aquí. Solo descuenta si el rostro ya quedó guardado. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const subjectId = String(body.subjectId || "").trim();
  if (!subjectId) return NextResponse.json({ ok: false }, { status: 400 });
  const row = await confirmGuestSubject(subjectId).catch(() => null);
  return NextResponse.json({ ok: Boolean(row?.enrolledAt) });
}
