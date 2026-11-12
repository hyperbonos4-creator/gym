import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionTokenEdge } from "./lib/sessionTokenEdge";
import { demoBlockedResponse, demoBlocksPath } from "./lib/demo";

/**
 * Protege páginas del panel. Valida firma HMAC de gym_session (Edge-safe).
 * Las rutas API sensibles también deben llamar guardGym/requireRoles.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname.startsWith("/login");
  const isApi = pathname.startsWith("/api/");
  const raw = req.cookies.get("gym_session")?.value || "";
  const claims = raw ? await verifySessionTokenEdge(raw) : null;
  const authed = Boolean(claims);

  if (demoBlocksPath(pathname)) {
    return demoBlockedResponse();
  }

  const res = (() => {
    if (!authed && !isLogin) {
      // Las APIs deben responder JSON 401 (no HTML de /login).
      if (isApi) {
        return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
      }
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (authed && isLogin) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  })();

  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|brand|logo.svg|kiosk|atlas|demos|models|api/v1|api/e/|api/auth/|api/cuenta/registro|api/turnstiles/heartbeat|api/turnstiles/jobs|api/turnstiles/pulse|api/turnstiles/inbox|api/invitaciones|api/mobile|invitar|ingreso|instalar|registro|maniqui|gemelo|e/|x/).*)",
  ],
};
