import { NextResponse } from "next/server";
import { demoSimulateOpen, isDemoMode } from "../../../../lib/demo";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";

export const dynamic = "force-dynamic";

/** Apertura simulada solo en demo. */
export async function POST(req: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ ok: false, error: "solo_demo" }, { status: 403 });
  }
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  const pointId = String(body.pointId || "demo-point");
  return NextResponse.json(demoSimulateOpen(pointId));
}