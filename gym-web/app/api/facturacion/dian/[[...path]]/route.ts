import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../../lib/authServer";
import { dianSendBlocked, getFacturacionSede } from "../../../../../lib/facturacionSede";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function target(path: string[]) {
  const base = (process.env.DIAN_URL || "http://127.0.0.1:8091").replace(/\/$/, "");
  const clean = path.filter(Boolean).join("/");
  if (!clean || clean.includes("..")) return null;
  return { base, clean, url: `${base}/api/${clean}` };
}

async function forward(req: Request, path: string[], method: string) {
  const url = new URL(req.url);
  const gymId = url.searchParams.get("gym") || gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const dest = target(path);
  if (!dest) return NextResponse.json({ ok: false, error: "Ruta no válida." }, { status: 400 });
  const sede = getFacturacionSede(gymId);
  const blocked = dianSendBlocked(dest.clean, sede);
  if (blocked) return NextResponse.json({ ok: false, error: blocked }, { status: 400 });
  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType && method !== "GET") headers.set("content-type", contentType);
  if (sede.nit) headers.set("x-company-nit", sede.nit);
  let res: Response;
  try {
    res = await fetch(dest.url, {
      method,
      headers,
      body: method === "GET" ? undefined : await req.arrayBuffer(),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ ok: false, error: "El motor de facturación no está encendido." }, { status: 503 });
  }
  const out = new Headers();
  const type = res.headers.get("content-type");
  if (type) out.set("content-type", type);
  const disposition = res.headers.get("content-disposition");
  if (disposition) out.set("content-disposition", disposition);
  return new NextResponse(await res.arrayBuffer(), { status: res.status, headers: out });
}

export async function GET(req: Request, { params }: { params: { path?: string[] } }) {
  return forward(req, params.path || [], "GET");
}

export async function POST(req: Request, { params }: { params: { path?: string[] } }) {
  return forward(req, params.path || [], "POST");
}
