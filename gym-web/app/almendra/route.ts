import { readFile } from "node:fs/promises";
import path from "node:path";
import { isDemoMode } from "../../lib/demo";

/** Modelo 3D estático del Edificio Almendra (HTML autocontenido). Solo en el entorno demo, igual que /urban y /gemelo. */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

let html: string | null = null;

export async function GET() {
  if (!isDemoMode() && String(process.env.GEMELO_PUBLIC || "") !== "1") {
    return new Response("Not Found", { status: 404 });
  }
  html ??= await readFile(path.join(process.cwd(), "app", "almendra", "almendra.html"), "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
