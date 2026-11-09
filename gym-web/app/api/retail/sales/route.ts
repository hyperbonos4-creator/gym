import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { checkout, daySummary, listSales, querySales, topSellerIds, voidSale } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const historial = url.searchParams.get("historial") === "1";
  if (historial) {
    const book = querySales(gymId, {
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      q: url.searchParams.get("q") || undefined,
      estado: url.searchParams.get("estado") || undefined,
      medio: url.searchParams.get("medio") || undefined,
    });
    return NextResponse.json({ ok: true, ...book });
  }
  const day = url.searchParams.get("day") || undefined;
  return NextResponse.json({ ok: true, items: listSales(gymId, day), summary: daySummary(gymId), top: topSellerIds(gymId) });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || "");
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const sale = checkout({
      gymId,
      cashier: auth.nombre,
      items: Array.isArray(b?.items) ? b.items : [],
      discount: Number(b?.discount || 0),
      payments: Array.isArray(b?.payments) ? b.payments : [],
      note: String(b?.note || ""),
    });
    return NextResponse.json({ ok: true, sale, summary: daySummary(gymId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const sale = voidSale(gymId, String(b?.id || ""), auth.nombre, String(b?.reason || ""));
    return NextResponse.json({ ok: true, sale, summary: daySummary(gymId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
