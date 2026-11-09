import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "../../../../lib/rateLimit";
import { verifyPassword } from "../../../../lib/passwords";
import { cookieSecureFromRequest, mintSessionTokenSync, serializeSessionCookie, sessionTtlMs } from "../../../../lib/sessionToken";
import { getUserByUsername, rehashUserPassword, toSession } from "../../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = clientIp(req);
  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {
    /* ignore */
  }
  const username = String(b?.username || "").trim().toLowerCase();
  const password = String(b?.password || "");
  const rec = getUserByUsername(username);
  const fail = () => {
    const limited = rateLimit(`login-fail:${ip}`, 10, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "demasiados_intentos" },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
      );
    }
    return NextResponse.json({ ok: false, error: "credenciales" }, { status: 401 });
  };
  if (!rec) return fail();
  const check = verifyPassword(rec.password, password);
  if (!check.ok) return fail();
  if (check.needsRehash) {
    try {
      rehashUserPassword(username, password);
    } catch {
      /* si la clave legacy es corta, igual deja entrar una vez y fuerza cambio luego */
    }
  }
  const fresh = getUserByUsername(username) || rec;
  const user = toSession(fresh);
  const token = mintSessionTokenSync({
    username: user.username,
    role: user.role,
    sessionVersion: fresh.sessionVersion || 1,
  });
  const maxAge = Math.floor(sessionTtlMs() / 1000);
  const res = NextResponse.json({ ok: true, user });
  res.headers.append("Set-Cookie", serializeSessionCookie(token, maxAge, cookieSecureFromRequest(req)));
  return res;
}
