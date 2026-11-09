import { NextResponse } from "next/server";
import { gymFromQuery, guardGym } from "../../../../lib/authServer";
import { gymInstance } from "../../../../lib/gymsStore";
import { waDisconnect } from "../../../../lib/evolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const instance = gymInstance(gymId);
  const result = await waDisconnect(instance);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
