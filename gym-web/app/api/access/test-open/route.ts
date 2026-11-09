import { NextResponse } from "next/server";
import { userFromRequest } from "../../../../lib/authServer";
import { doorTestOpen } from "../../../../lib/accessBackend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!userFromRequest(req)) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const point = searchParams.get("point");
  if (!point) return NextResponse.json({ ok: false, error: "point_requerido" }, { status: 400 });
  try {
    const result = await doorTestOpen(point);
    const actuated = result?.actuated === true;
    return NextResponse.json({ ok: actuated }, { status: actuated ? 200 : 502 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
