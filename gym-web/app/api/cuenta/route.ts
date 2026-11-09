import { NextResponse } from "next/server";
import { guardGym, requireSuperadmin, userFromRequest } from "../../../lib/authServer";
import { agregarSede, cambiarCuenta, cuentaAbierta, cuentaDeGym, diasDePrueba, listCuentas, PLANS } from "../../../lib/cuentas";
import { getGymById, updateGym } from "../../../lib/gymsStore";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function view(gymId: string) {
  const cuenta = cuentaDeGym(gymId);
  const gym = getGymById(gymId);
  return {
    gym,
    cuenta,
    plan: cuenta ? PLANS[cuenta.plan] : null,
    abierta: cuentaAbierta(cuenta),
    dias: cuenta?.status === "prueba" ? diasDePrueba(cuenta) : null,
    planes: PLANS,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gymId = url.searchParams.get("gym") || "";
  if (!gymId) {
    const auth = requireSuperadmin(req);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({ ok: true, items: listCuentas(), planes: PLANS });
  }
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, ...view(gymId) });
}

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const action = String(body.action || "");
  if (action === "activar" || action === "suspender" || action === "plan") {
    const auth = requireSuperadmin(req);
    if (auth instanceof NextResponse) return auth;
    try {
      const cuenta = cambiarCuenta(String(body.id || ""), {
        status: action === "activar" ? "activa" : action === "suspender" ? "suspendida" : undefined,
        plan: action === "plan" ? String(body.plan || "inicio") as "inicio" | "operacion" | "red" : undefined,
      });
      return NextResponse.json({ ok: true, cuenta });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo actualizar la cuenta.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }
  if (action === "sede") {
    const gymId = String(body.gym || "");
    const gate = guardGym(req, gymId);
    if (gate instanceof NextResponse) return gate;
    if (gate.role !== "superadmin" && gate.role !== "admin") return NextResponse.json({ ok: false, error: "solo_admin" }, { status: 403 });
    const cuenta = cuentaDeGym(gymId);
    if (!cuenta) return NextResponse.json({ ok: false, error: "Esta sede no tiene una cuenta de software." }, { status: 400 });
    try {
      const created = agregarSede(cuenta.id, { name: String(body.name || ""), city: String(body.city || "") });
      return NextResponse.json({ ok: true, ...created });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const text = code === "limite_sedes" ? "Este plan ya no admite otra sede." : code === "cuenta_suspendida" ? "La cuenta está suspendida." : "No se pudo crear la sede.";
      return NextResponse.json({ ok: false, error: text }, { status: 400 });
    }
  }
  const gymId = String(body.gym || "");
  const auth = userFromRequest(req);
  if (!auth) return NextResponse.json({ ok: false, error: "no_auth" }, { status: 401 });
  if (auth.role !== "superadmin" && auth.role !== "admin") {
    return NextResponse.json({ ok: false, error: "solo_admin" }, { status: 403 });
  }
  const gate = guardGym(req, gymId);
  if (gate instanceof NextResponse) return gate;
  const brandName = String(body.brandName || "").trim().slice(0, 80);
  let logo = getGymById(gymId)?.logo;
  const raw = String(body.logoBase64 || "");
  if (raw) {
    const match = raw.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return NextResponse.json({ ok: false, error: "El logo tiene que ser PNG, JPG o WebP." }, { status: 400 });
    const bytes = Buffer.from(match[2], "base64");
    if (bytes.length > 350000) return NextResponse.json({ ok: false, error: "El logo pesa más de 350 KB." }, { status: 400 });
    if (!/^[a-z0-9-]{1,80}$/.test(gymId)) return NextResponse.json({ ok: false, error: "sede_invalida" }, { status: 400 });
    const dir = path.join(process.cwd(), "data", "brands");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${gymId}.img`), bytes);
    logo = true;
  }
  const gym = updateGym(gymId, { brandName, logo });
  return NextResponse.json({ ok: true, gym });
}
