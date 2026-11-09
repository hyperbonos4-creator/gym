import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference") || "";
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0A0F1C;color:white;font-family:sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px"><div><div style="letter-spacing:.2em;color:#38BDF8;font-size:12px">VISIONYX</div><h1>Pago enviado a Wompi</h1><p>Vuelve a la app y desliza hacia abajo. El plan queda activo solo si Wompi lo aprueba.</p><p style="color:#94a3b8">${reference}</p></div></body>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}