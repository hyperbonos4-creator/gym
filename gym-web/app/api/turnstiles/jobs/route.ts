import { NextResponse } from "next/server";
import { takeJob } from "../../../../lib/turnstileJobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowed(req: Request) {
  const key = process.env.ESP_AGENT_KEY || "";
  return Boolean(key) && req.headers.get("x-esp-agent") === key;
}

export async function GET(req: Request) {
  if (!allowed(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const job = await takeJob(20000);
  return NextResponse.json({ ok: true, job });
}

export async function POST(req: Request) {
  if (!allowed(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (id.length < 8) return NextResponse.json({ ok: false }, { status: 400 });
  return NextResponse.json({ ok: false, error: "la confirma el torniquete" }, { status: 409 });
}
