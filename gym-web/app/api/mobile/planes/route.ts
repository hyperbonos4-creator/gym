import { NextResponse } from "next/server";
import { socioFromMobileRequest } from "../../../../lib/mobileSession";
import { listPlans } from "../../../../lib/memberships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = socioFromMobileRequest(req);
  if (!session) return NextResponse.json({ ok: false, error: "Sesión vencida." }, { status: 401 });
  const plans = listPlans(session.gymId)
    .filter((p) => p.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      benefits: p.benefits || [],
      price: p.price,
      durationDays: p.durationDays,
      kind: p.kind === "tiquetera" ? "tiquetera" : "membresia",
      guestCredits: p.guestCredits || 0,
    }));
  return NextResponse.json({ ok: true, plans });
}
