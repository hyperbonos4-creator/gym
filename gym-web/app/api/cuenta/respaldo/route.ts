import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { exportGym } from "../../../../lib/gymBackup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  if (auth.role !== "superadmin" && auth.role !== "admin") {
    return NextResponse.json({ ok: false, error: "solo_admin" }, { status: 403 });
  }
  const body = JSON.stringify(exportGym(gymId), null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sede-${gymId}.json"`,
    },
  });
}
