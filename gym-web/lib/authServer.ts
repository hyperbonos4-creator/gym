import { NextResponse } from "next/server";
import { cuentaAbierta, cuentaDeGym } from "./cuentas";
import type { Role, SessionUser } from "./session";
import { verifySessionTokenSync } from "./sessionToken";
import { canAccessGym, getUserByUsername, toSession } from "./usersStore";

export function userFromRequest(req: Request): SessionUser | null {
  const raw = req.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)gym_session=([^;]+)/);
  if (!m) return null;
  const token = decodeURIComponent(m[1] || "").trim();
  if (!token) return null;
  const claims = verifySessionTokenSync(token);
  if (!claims) return null;
  const rec = getUserByUsername(claims.u);
  if (!rec) return null;
  if ((rec.sessionVersion || 1) !== claims.v) return null;
  if (rec.role !== claims.r) return null;
  return toSession(rec);
}

export function guardGym(req: Request, gymId: string): SessionUser | NextResponse {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  if (!canAccessGym(user, gymId)) {
    return NextResponse.json({ ok: false, error: "gym_prohibido" }, { status: 403 });
  }
  const method = req.method.toUpperCase();
  if (user.role !== "superadmin" && method !== "GET" && method !== "HEAD" && !cuentaAbierta(cuentaDeGym(gymId))) {
    return NextResponse.json(
      {
        ok: false,
        error: "La prueba de esta cuenta terminó. Activa el plan en Cuenta para seguir registrando.",
      },
      { status: 402 },
    );
  }
  return user;
}

export function gymFromQuery(req: Request, fallback = "fuerza-elite"): string {
  const asked = new URL(req.url).searchParams.get("gym");
  if (asked) return asked;
  const user = userFromRequest(req);
  if (user && user.gymIds !== "all" && user.gymIds[0]) return user.gymIds[0];
  return fallback;
}

export function requireSuperadmin(req: Request): SessionUser | NextResponse {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  if (user.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "solo_superadmin" }, { status: 403 });
  }
  return user;
}

export function requireRoles(req: Request, roles: Role[]): SessionUser | NextResponse {
  const user = userFromRequest(req);
  if (!user) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  if (!roles.includes(user.role) && user.role !== "superadmin") {
    return NextResponse.json({ ok: false, error: "sin_permiso" }, { status: 403 });
  }
  return user;
}
