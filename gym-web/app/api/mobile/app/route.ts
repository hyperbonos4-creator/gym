import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "releases", "fuerza-elite.apk");

export async function GET() {
  try {
    const info = await stat(FILE);
    const stream = Readable.toWeb(createReadStream(FILE)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Length": String(info.size),
        "Content-Disposition": 'attachment; filename="VISIONYX.apk"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "La app todavía no está publicada." }, { status: 404 });
  }
}
