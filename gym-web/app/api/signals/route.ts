import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { gymInstance } from "../../../lib/gymsStore";
import { renewalBoard } from "../../../lib/memberships";
import { daySummary } from "../../../lib/retailStore";
import { listTurnstiles } from "../../../lib/turnstiles";
import { waStatus } from "../../../lib/evolution";

export const dynamic = "force-dynamic";

const FRESH_MS = 45_000;

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const now = Date.now();
  const devices = listTurnstiles(gymId);
  const offline = devices.filter((d) => !d.lastSeen || now - Date.parse(d.lastSeen) >= FRESH_MS).length;
  const board = renewalBoard(gymId);
  let whatsapp: boolean | null = null;
  try {
    whatsapp = (await waStatus(gymInstance(gymId))).state === "open";
  } catch {
    whatsapp = null;
  }
  const caja = daySummary(gymId);
  return NextResponse.json({
    accessOffline: offline,
    accessDevices: devices.length,
    membresiasHoy: board.hoy.count,
    cajaAbierta: !!caja.session && !caja.session.closedAt,
    whatsapp,
  });
}
