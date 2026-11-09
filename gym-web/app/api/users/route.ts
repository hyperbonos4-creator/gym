import { NextResponse } from "next/server";
import { requireSuperadmin } from "../../../lib/authServer";
import { listGyms } from "../../../lib/gymsStore";
import { createUser, listUsers } from "../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = requireSuperadmin(req);
  if (auth instanceof NextResponse) return auth;
  const items = listUsers().map(({ password: _p, ...u }) => u);
  return NextResponse.json({ ok: true, items, gyms: listGyms() });
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
  try {
    const user = createUser({
      username: String(b?.username || ""),
      password: String(b?.password || ""),
      nombre: String(b?.nombre || ""),
      role: ["operador", "recepcion", "caja", "entrenador", "admin"].includes(b?.role) ? b.role : "admin",
      gymIds: Array.isArray(b?.gymIds) ? b.gymIds.map(String) : [],
    });
    const { password: _p, ...safe } = user;
    return NextResponse.json({ ok: true, user: safe });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
