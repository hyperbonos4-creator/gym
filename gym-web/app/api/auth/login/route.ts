import { NextResponse } from "next/server";
import { verifyPassword } from "../../../../lib/passwords";
import { getUserByUsername, toSession } from "../../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let b: any = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  const username = String(b?.username || "").trim().toLowerCase();
  const password = String(b?.password || "");
  const rec = getUserByUsername(username);
  if (!rec || !verifyPassword(rec.password, password)) {
    return NextResponse.json({ ok: false, error: "credenciales" }, { status: 401 });
  }
  const user = toSession(rec);
  const res = NextResponse.json({ ok: true, user });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.headers.append(
    "Set-Cookie",
    `gym_session=${encodeURIComponent(user.username)}; Path=/; Max-Age=86400; SameSite=Lax${secure}`,
  );
  return res;
}
