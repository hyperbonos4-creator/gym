import { NextResponse } from "next/server";
import { requireSuperadmin, userFromRequest } from "../../../lib/authServer";
import { createGym, listGyms } from "../../../lib/gymsStore";
import { canAccessGym } from "../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  const items = listGyms().filter((g) => canAccessGym(user, g.id));
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  const auth = requireSuperadmin(req);
  if (auth instanceof NextResponse) return auth;
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  const name = String(b?.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "nombre_requerido" }, { status: 400 });
  const gym = createGym({ name, city: String(b?.city || ""), short: String(b?.short || "") });
  return NextResponse.json({ ok: true, gym });
}
