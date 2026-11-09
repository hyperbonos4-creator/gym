import { NextResponse } from "next/server";
import { isDemoMode } from "../../../../lib/demo";
import { getBrand } from "../../../../lib/brand";

export const dynamic = "force-dynamic";

export async function GET() {
  const brand = getBrand();
  return NextResponse.json({
    ok: true,
    demo: isDemoMode(),
    brand: { name: brand.name, tagline: brand.tagline },
  });
}