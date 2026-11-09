import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, items: listSuppliers(gymId) });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const supplier = createSupplier(gymId, b);
    return NextResponse.json({ ok: true, supplier, items: listSuppliers(gymId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    const supplier = updateSupplier(gymId, String(b?.id || ""), b);
    return NextResponse.json({ ok: true, supplier, items: listSuppliers(gymId) });
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
    const removed = deleteSupplier(gymId, String(b?.id || ""));
    return NextResponse.json({ ok: true, removed, items: listSuppliers(gymId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
