import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { retailReport } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  return NextResponse.json({
    ok: true,
    report: retailReport(gymId, url.searchParams.get("from") || undefined, url.searchParams.get("to") || undefined),
  });
}
