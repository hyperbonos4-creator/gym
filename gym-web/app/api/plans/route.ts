import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import { createPlan, planCatalog, updatePlan, type AccessWindow } from "../../../lib/memberships";
import { enteros } from "../../../lib/money";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const catalog = planCatalog(gymId);
  return NextResponse.json({ items: catalog.plans, ...catalog });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const plan = createPlan(gymId, {
      name: String(body.name || ""),
      description: String(body.description || ""),
      benefits: Array.isArray(body.benefits) ? body.benefits.map(String) : String(body.benefits || "").split("\n"),
      price: enteros(String(body.price ?? "")),
      durationDays: Number(body.durationDays),
      accessWindow: body.accessWindow as AccessWindow,
      accessDays: Array.isArray(body.accessDays) ? body.accessDays.map(Number) : null,
      accessFrom: body.accessFrom ? String(body.accessFrom) : null,
      accessTo: body.accessTo ? String(body.accessTo) : null,
      active: body.active !== false,
      kind: body.kind === "tiquetera" ? "tiquetera" : "membresia",
      guestCredits: body.kind === "tiquetera" ? Number(body.guestCredits) : undefined,
    });
    return NextResponse.json({ ok: true, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "no_se_pudo" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const plan = updatePlan(gymId, String(body.id || ""), {
      name: body.name != null ? String(body.name) : undefined,
      description: body.description != null ? String(body.description) : undefined,
      benefits: body.benefits != null ? (Array.isArray(body.benefits) ? body.benefits.map(String) : String(body.benefits).split("\n")) : undefined,
      price: body.price != null ? enteros(String(body.price)) : undefined,
      durationDays: body.durationDays != null ? Number(body.durationDays) : undefined,
      accessWindow: body.accessWindow as AccessWindow | undefined,
      accessDays: body.accessDays !== undefined ? (Array.isArray(body.accessDays) ? body.accessDays.map(Number) : null) : undefined,
      accessFrom: body.accessFrom !== undefined ? (body.accessFrom ? String(body.accessFrom) : null) : undefined,
      accessTo: body.accessTo !== undefined ? (body.accessTo ? String(body.accessTo) : null) : undefined,
      active: body.active != null ? !!body.active : undefined,
      kind: body.kind === "tiquetera" ? "tiquetera" : body.kind === "membresia" ? "membresia" : undefined,
      guestCredits: body.guestCredits != null ? Number(body.guestCredits) : undefined,
      nextPrice: body.nextPrice === null ? null : body.nextPrice ? { price: enteros(String(body.nextPrice.price ?? "")), from: String(body.nextPrice.from || "") } : undefined,
    });
    return NextResponse.json({ ok: true, plan });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "no_se_pudo" }, { status: 400 });
  }
}
