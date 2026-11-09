import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { cancelOrder, createOrder, listOrders, receiveOrder } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, items: listOrders(gymId) });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    if (b?.action === "recibir") {
      return NextResponse.json({ ok: true, order: receiveOrder(gymId, String(b.id || "")), items: listOrders(gymId) });
    }
    if (b?.action === "anular") {
      return NextResponse.json({ ok: true, order: cancelOrder(gymId, String(b.id || "")), items: listOrders(gymId) });
    }
    const order = createOrder({
      gymId,
      supplierId: String(b.supplierId || ""),
      note: String(b.note || ""),
      by: auth.nombre,
      lines: Array.isArray(b.lines) ? b.lines : [],
    });
    return NextResponse.json({ ok: true, order, items: listOrders(gymId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
