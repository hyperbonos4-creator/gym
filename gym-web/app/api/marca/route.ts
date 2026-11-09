import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { guardGym, gymFromQuery } from "../../../lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  if (!/^[a-z0-9-]{1,80}$/.test(gymId)) return new NextResponse(null, { status: 404 });
  const file = path.join(process.cwd(), "data", "brands", `${gymId}.img`);
  if (!fs.existsSync(file)) return new NextResponse(null, { status: 404 });
  const bytes = fs.readFileSync(file);
  const type = bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : bytes[0] === 0x52 && bytes[1] === 0x49 ? "image/webp" : "image/png";
  return new NextResponse(bytes, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=60" } });
}
