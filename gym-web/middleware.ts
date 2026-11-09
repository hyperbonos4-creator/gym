import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Protege toda la app salvo /login y estáticos. La sesión se marca con la
 * cookie `gym_session` (ver lib/session.ts). Cuando exista backend real, aquí
 * se validará el JWT.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isLogin = pathname.startsWith("/login");
  const authed = req.cookies.get("gym_session")?.value;

  if (!authed && !isLogin) {
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
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|brand|logo.svg|kiosk|atlas|demos|models|api/v1|api/e/|api/auth/|api/cuenta/registro|api/turnstiles/heartbeat|api/turnstiles/jobs|api/turnstiles/pulse|api/turnstiles/inbox|api/invitaciones|api/mobile|invitar|ingreso|instalar|registro|maniqui|e/|x/).*)"],
};
