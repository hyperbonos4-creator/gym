import { NextResponse } from "next/server";
import { setTurnstileController } from "../../../../lib/accessBackend";
import { claimFor, finishJob } from "../../../../lib/turnstileJobs";
import { announceDevice, tokenKnown } from "../../../../lib/turnstiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(req: Request) {
  return (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

/** El torniquete llama aquí desde la red del gimnasio. No pasa por el PC de la casa. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  const ip = url.searchParams.get("ip") || "";
  const fw = url.searchParams.get("fw") || "";
  const rssi = Number(url.searchParams.get("rssi"));
  const token = bearer(req);
  if (id.length < 8 || !ip || token.length < 8) return NextResponse.json({ ok: false }, { status: 400 });
  const row = announceDevice({ id, token, ip, fw, rssi });
  if (!row) return NextResponse.json({ ok: false }, { status: 401 });
  if (row.changed && row.pointId) {
    try {
      await setTurnstileController(row.pointId, ip, token);
    } catch {
      /* el aviso quedó. La puerta se alinea en el siguiente. */
    }
  }
  const job = claimFor(token);
  return NextResponse.json({ ok: true, open: Boolean(job), id: job?.id || "" });
}

export async function POST(req: Request) {
  const token = bearer(req);
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!tokenKnown(token) || id.length < 8) return NextResponse.json({ ok: false }, { status: 401 });
  if (!finishJob(id, body.ok === true, token)) {
    return NextResponse.json({ ok: false }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
