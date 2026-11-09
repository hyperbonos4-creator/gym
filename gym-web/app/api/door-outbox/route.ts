import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { flushDoorOutbox, listDoorOutbox } from "../../../lib/doorOutbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, items: listDoorOutbox(gymId, 100) });
}

export async function POST(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const result = await flushDoorOutbox(30);
  return NextResponse.json({ ok: true, flushed: result, items: listDoorOutbox(gymId, 100) });
}
