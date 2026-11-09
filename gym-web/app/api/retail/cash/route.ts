import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { closeCash, daySummary, openCash, openSession } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, session: openSession(gymId), summary: daySummary(gymId) });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || "");
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    if (b?.action === "close") {
      const session = closeCash(gymId, Number(b?.counted || 0));
      return NextResponse.json({ ok: true, session, summary: daySummary(gymId) });
    }
    const session = openCash(gymId, Number(b?.float || 0), auth.nombre);
    return NextResponse.json({ ok: true, session, summary: daySummary(gymId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
