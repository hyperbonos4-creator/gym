import { NextResponse } from "next/server";
import { registrarCuenta } from "../../../../lib/cuentas";
import { toSession, getUserByUsername } from "../../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  try {
    const { cuenta, gym } = registrarCuenta({
      cuenta: String(body.cuenta || ""),
      gymName: String(body.gymName || ""),
      city: String(body.city || ""),
      username: String(body.username || ""),
      password: String(body.password || ""),
      nombre: String(body.nombre || ""),
    });
    const user = toSession(getUserByUsername(cuenta.owner)!);
    const res = NextResponse.json({ ok: true, user, gym, cuenta: { id: cuenta.id, plan: cuenta.plan, trialEndsAt: cuenta.trialEndsAt } });
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.headers.append("Set-Cookie", `gym_session=${encodeURIComponent(user.username)}; Path=/; Max-Age=86400; SameSite=Lax${secure}`);
    return res;
  } catch (error) {
    const code = error instanceof Error ? error.message : "no_se_pudo";
    const text = code === "usuario_existe" ? "Ese usuario ya existe." : code === "clave_corta" ? "La contraseña necesita al menos 4 caracteres." : code === "nombre_corto" ? "Escribe el nombre de la cuenta y el de la sede." : "No se pudo crear la cuenta.";
    return NextResponse.json({ ok: false, error: text }, { status: 400 });
  }
}
