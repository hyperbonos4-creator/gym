import { NextResponse } from "next/server";
import { registrarCuenta } from "../../../../lib/cuentas";
import { clientIp, rateLimit } from "../../../../lib/rateLimit";
import { mintSessionTokenSync, serializeSessionCookie, sessionTtlMs } from "../../../../lib/sessionToken";
import { getUserByUsername, toSession } from "../../../../lib/usersStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function registroHabilitado() {
  const flag = String(process.env.ALLOW_PUBLIC_REGISTRO || "").trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export async function POST(req: Request) {
  if (!registroHabilitado()) {
    return NextResponse.json(
      { ok: false, error: "El registro público está desactivado. Pide una invitación al administrador." },
      { status: 403 },
    );
  }

  const limited = rateLimit(`registro:${clientIp(req)}`, 5, 60 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "demasiados_intentos" }, { status: 429 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* vacío */
  }
  try {
    const { cuenta, gym } = registrarCuenta({
      cuenta: String(body.cuenta || ""),
      gymName: String(body.gymName || ""),
      city: String(body.city || ""),
      username: String(body.username || ""),
      password: String(body.password || ""),
      nombre: String(body.nombre || ""),
    });
    const stored = getUserByUsername(cuenta.owner)!;
    // Nunca elevar a staff privilegiado desde registro público
    if (stored.role === "superadmin") {
      return NextResponse.json({ ok: false, error: "No se pudo crear la cuenta." }, { status: 400 });
    }
    const user = toSession(stored);
    const token = mintSessionTokenSync({
      username: user.username,
      role: user.role,
      sessionVersion: stored.sessionVersion || 1,
    });
    const res = NextResponse.json({
      ok: true,
      user,
      gym,
      cuenta: { id: cuenta.id, plan: cuenta.plan, trialEndsAt: cuenta.trialEndsAt },
    });
    res.headers.append("Set-Cookie", serializeSessionCookie(token, Math.floor(sessionTtlMs() / 1000)));
    return res;
  } catch (error) {
    const code = error instanceof Error ? error.message : "no_se_pudo";
    const text =
      code === "usuario_existe"
        ? "Ese usuario ya existe."
        : code === "clave_corta"
          ? "La contraseña necesita al menos 8 caracteres."
          : code === "nombre_corto"
            ? "Escribe el nombre de la cuenta y el de la sede."
            : "No se pudo crear la cuenta.";
    return NextResponse.json({ ok: false, error: text }, { status: 400 });
  }
}
