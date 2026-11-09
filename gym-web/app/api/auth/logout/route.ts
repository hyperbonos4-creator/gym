import { NextResponse } from "next/server";
import { userFromRequest } from "../../../../lib/authServer";
import { clearSessionCookie, cookieSecureFromRequest } from "../../../../lib/sessionToken";
import { bumpSessionVersion } from "../../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = userFromRequest(req);
  if (user) {
    try {
      bumpSessionVersion(user.username);
    } catch {
      /* ignore */
    }
  }
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", clearSessionCookie(cookieSecureFromRequest(req)));
  return res;
}
