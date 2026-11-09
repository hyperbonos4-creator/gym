import { NextResponse } from "next/server";
import { backendUp, visionHealth, listPoints } from "../../../../lib/accessBackend";
import { gymFromQuery, guardGym } from "../../../../lib/authServer";
import { gymInstance } from "../../../../lib/gymsStore";
import { waStatus } from "../../../../lib/evolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const instance = gymInstance(gymId);

  const [up, vision, points, wa] = await Promise.all([
    backendUp(),
    visionHealth(),
    listPoints(),
    waStatus(instance),
  ]);

  return NextResponse.json(
    {
      backend: up,
      vision: vision.ok,
      whatsapp: wa.state === "open",
      points: points.map((p: any) => ({
        id: p.id,
        name: p.name ?? p.nombre ?? "Punto de acceso",
        online: p.online ?? p.actuatorOnline ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
