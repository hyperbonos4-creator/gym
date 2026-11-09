/**
 * URL pública para links que abre el socio en su celular.
 * localhost no sirve fuera de este PC. Prioridad:
 *  1) ENROLL_PUBLIC_BASE
 *  2) túnel ngrok (API local :4040)
 *  3) host de la petición (último recurso)
 */

export async function resolvePublicBase(req: Request): Promise<string> {
  const env = (process.env.ENROLL_PUBLIC_BASE || "").replace(/\/$/, "");
  if (env && !/localhost|127\.0\.0\.1/i.test(env)) return env;

  try {
    const r = await fetch("http://127.0.0.1:4040/api/tunnels", { cache: "no-store" });
    const data: any = await r.json();
    const https = (data?.tunnels || []).find((t: any) => String(t?.public_url || "").startsWith("https://"));
    if (https?.public_url) return String(https.public_url).replace(/\/$/, "");
  } catch {
    /* ngrok no está */
  }

  const h = req.headers;
  const proto = (h.get("x-forwarded-proto") || "http").split(",")[0];
  const host = (h.get("x-forwarded-host") || h.get("host") || "localhost:3100").split(",")[0];
  return `${proto}://${host}`;
}

export function isLocalBase(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}
