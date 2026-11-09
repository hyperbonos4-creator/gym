import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { bringToFloor, createProduct, deleteProduct, listProducts, listRestock, loadStarterCatalog, updateProduct } from "../../../../lib/retailStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, items: listProducts(gymId, { includeInactive: true }), restock: listRestock(gymId) });
}

export async function POST(req: Request) {
  let b: any = {};
  try { b = await req.json(); } catch { /* ignore */ }
  const gymId = String(b?.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  try {
    if (b?.action === "seed") {
      const added = loadStarterCatalog(gymId);
      return NextResponse.json({ ok: true, added, items: listProducts(gymId, { includeInactive: true }), restock: listRestock(gymId) });
    }
    if (b?.action === "bajar") {
      const brought = bringToFloor(gymId, b?.productId ? String(b.productId) : undefined);
      return NextResponse.json({ ok: true, brought, items: listProducts(gymId, { includeInactive: true }), restock: listRestock(gymId) });
    }
    const product = createProduct(gymId, b);
    return NextResponse.json({ ok: true, product });
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
    const removed = deleteProduct(gymId, String(b?.id || ""));
    return NextResponse.json({
      ok: true,
      removed,
      items: listProducts(gymId, { includeInactive: true }),
      restock: listRestock(gymId),
    });
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
    const product = updateProduct(gymId, String(b?.id || ""), b);
    return NextResponse.json({ ok: true, product });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 400 });
  }
}
