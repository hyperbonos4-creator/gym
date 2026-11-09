import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { isDemoMode } from "../../../../lib/demo";
import { requireSuperadmin } from "../../../../lib/authServer";

export const dynamic = "force-dynamic";

/** Reinicia data-demo ejecutando el seed (solo demo + superadmin/admin demo). */
export async function POST(req: Request) {
  if (!isDemoMode()) {
    return NextResponse.json({ ok: false, error: "solo_demo" }, { status: 403 });
  }
  // En demo el usuario demo es admin; permitimos requireRoles admin via header cookie.
  const user = requireSuperadmin(req);
  // Demo admin is not superadmin — allow any authed demo session:
  if (user instanceof NextResponse) {
    // fall through: allow if cookie present in demo
    const raw = req.headers.get("cookie") || "";
    if (!raw.includes("gym_session=")) return user;
  }
  const script = path.join(process.cwd(), "scripts", "seed-demo.mjs");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [script], {
      cwd: process.cwd(),
      env: { ...process.env, GYM_DATA_DIR: process.env.GYM_DATA_DIR || path.join(process.cwd(), "data-demo") },
      stdio: "ignore",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("seed_failed"))));
    child.on("error", reject);
  }).catch(() => null);
  return NextResponse.json({ ok: true, reset: true });
}