import { demoBlockedResponse, isDemoMode } from "../../../../lib/demo";
import { NextResponse } from "next/server";
import { deviceForPulse } from "../../../../lib/turnstiles";
import { requestOpen } from "../../../../lib/turnstileJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** La llama el control de acceso. El pulso lo hace el puente, en la red del gimnasio. */
export async function POST(req: Request) {
  if (isDemoMode()) return demoBlockedResponse();

  const point = new URL(req.url).searchParams.get("point") || "";
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const device = deviceForPulse(point, token);
  if (!device) return NextResponse.json({ ok: false }, { status: 404 });
  const ok = await requestOpen(device.ip, token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 502 });
}
