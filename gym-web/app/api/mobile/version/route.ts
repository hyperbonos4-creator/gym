import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "releases", "version.json");

export async function GET() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    const build = Number(raw.build) || 0;
    return NextResponse.json({
      ok: true,
      version: String(raw.version || ""),
      build,
      notes: String(raw.notes || ""),
      url: "/api/mobile/app",
    });
  } catch {
    return NextResponse.json({ ok: false, version: "", build: 0, notes: "", url: "/api/mobile/app" });
  }
}
