import { NextResponse } from "next/server";
import { setTurnstileController } from "../../../../lib/accessBackend";
import { markSynced, noteSeen } from "../../../../lib/turnstiles";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const key = process.env.ESP_AGENT_KEY || "";
  if (!key || req.headers.get("x-esp-agent") !== key) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const ip = String(body.ip || "");
  if (id.length < 8 || !ip) return NextResponse.json({ ok: false }, { status: 400 });
  const sync = noteSeen({
    id,
    name: body.name ? String(body.name) : undefined,
    ip,
    fw: body.fw ? String(body.fw) : undefined,
    rssi: typeof body.rssi === "number" ? body.rssi : null,
  });
  if (sync?.pointId && sync.token && sync.lastIp) {
    try {
      await setTurnstileController(sync.pointId, sync.lastIp, sync.token);
      markSynced(sync.id, sync.lastIp);
    } catch {
      /* la puerta se actualiza en el siguiente aviso */
    }
  }
  return NextResponse.json({ ok: true });
}
