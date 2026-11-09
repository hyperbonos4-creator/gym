import { NextResponse } from "next/server";
import { userFromRequest } from "../../../../lib/authServer";
import { cuentaAbierta, cuentaDeGym } from "../../../../lib/cuentas";
import type { Role } from "../../../../lib/session";
import { createUser } from "../../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["admin", "operador", "recepcion", "caja", "entrenador"];

export async function POST(req: Request) {
  const auth = userFromRequest(req);
  if (!auth) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  if (auth.role !== "superadmin" && auth.role !== "admin") {
    return NextResponse.json({ ok: false, error: "solo_admin" }, { status: 403 });
  }
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const gymIds = Array.isArray(body.gymIds) ? body.gymIds.map(String) : [];
  if (!gymIds.length) return NextResponse.json({ ok: false, error: "Elige la sede de esta persona." }, { status: 400 });
  if (auth.role !== "superadmin") {
    const own = new Set(auth.gymIds === "all" ? gymIds : auth.gymIds);
    if (gymIds.some((id) => !own.has(id))) return NextResponse.json({ ok: false, error: "gym_prohibido" }, { status: 403 });
    if (gymIds.some((id) => !cuentaAbierta(cuentaDeGym(id)))) {
      return NextResponse.json({ ok: false, error: "La prueba de esta cuenta terminó." }, { status: 402 });
    }
  }
  const role = (ROLES.includes(String(body.role)) ? String(body.role) : "recepcion") as Role;
  try {
    const user = createUser({
      username: String(body.username || ""),
      password: String(body.password || ""),
      nombre: String(body.nombre || ""),
      role,
      gymIds,
    });
    return NextResponse.json({ ok: true, user: { username: user.username, nombre: user.nombre, role: user.role, gymIds: user.gymIds } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const text = code === "usuario_existe" ? "Ese usuario ya existe." : code === "clave_corta" ? "La contraseña necesita al menos 4 caracteres." : "No se pudo crear el usuario.";
    return NextResponse.json({ ok: false, error: text }, { status: 400 });
  }
}
