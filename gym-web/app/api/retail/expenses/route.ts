import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { addExpense, daySummary, listExpenses, queryExpenses } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  if (url.searchParams.get("historial") === "1") {
    const book = queryExpenses(gymId, url.searchParams.get("from") || undefined, url.searchParams.get("to") || undefined);
    return NextResponse.json({ ok: true, ...book, summary: daySummary(gymId) });
  }
  return NextResponse.json({ ok: true, items: listExpenses(gymId), summary: daySummary(gymId) });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || "");
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const expense = addExpense(gymId, {
      category: String(b?.category || "Otros"),
      amount: Number(b?.amount || 0),
      note: String(b?.note || ""),
      by: auth.nombre,
    });
    return NextResponse.json({ ok: true, expense, items: listExpenses(gymId), summary: daySummary(gymId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
