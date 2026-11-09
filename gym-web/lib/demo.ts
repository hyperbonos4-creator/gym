import { NextResponse } from "next/server";

/** Entorno de demostración aislado (GYM_DEMO_MODE=1 + GYM_DATA_DIR=data-demo). */
export function isDemoMode(): boolean {
  return (
    String(process.env.GYM_DEMO_MODE || "").trim() === "1" ||
    String(process.env.NEXT_PUBLIC_GYM_DEMO_MODE || "").trim() === "1"
  );
}

/** Rutas / acciones que no deben ejecutarse en demo (hardware, WhatsApp, pagos reales, DIAN). */
const BLOCKED_PREFIXES = [
  "/api/whatsapp",
  "/api/wompi",
  "/api/dian",
  "/api/turnstiles/pulse",
  "/api/access/test-open",
];

export function demoBlocksPath(pathname: string): boolean {
  if (!isDemoMode()) return false;
  return BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function demoBlockedResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "demo_solo_lectura",
      message:
        "En el entorno de demostración esta acción está simulada. No se envían mensajes ni se mueve hardware real.",
      simulated: true,
    },
    { status: 200 },
  );
}

/** Simula apertura de torniquete en demo. */
export function demoSimulateOpen(pointId: string) {
  return {
    ok: true,
    simulated: true,
    actuated: true,
    pointId,
    detail: "Apertura simulada en entorno de demostración",
    at: new Date().toISOString(),
  };
}
