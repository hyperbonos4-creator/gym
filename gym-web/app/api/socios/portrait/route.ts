import { NextResponse } from "next/server";
import { guardGym } from "../../../../lib/authServer";
import { fetchPortrait } from "../../../../lib/accessBackend";
import { getSocio } from "../../../../lib/sociosStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "id_requerido" }, { status: 400 });
  const socio = getSocio(id);
  if (!socio || socio.deletedAt) return NextResponse.json({ error: "cliente_no_encontrado" }, { status: 404 });
  const auth = guardGym(req, socio.gymId || "fuerza-elite");
  if (auth instanceof NextResponse) return auth;

  try {
    const jpeg = await fetchPortrait(id);
    if (!jpeg) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(jpeg), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
}
