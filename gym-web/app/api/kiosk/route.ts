import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { guardGym, gymFromQuery } from "../../../lib/authServer";
import {
  createKioskPairingCode,
  createPoint,
  listKioskDevices,
  listPoints,
  revokeKioskDevice,
} from "../../../lib/accessBackend";
import { accessScope } from "../../../lib/accessScope";
import { rateLimit } from "../../../lib/rateLimit";
import { resolvePublicBase, isLocalBase } from "../../../lib/publicUrl";

export const dynamic = "force-dynamic";

async function resolvePointId(gymId: string, asked?: string | null): Promise<string | null> {
  const scope = accessScope(gymId);
  const points = await listPoints();
  const scoped = points.filter(
    (p: { id: string }) => scope.ownDoors.has(String(p.id)) || (!scope.foreignDoors.has(String(p.id)) && scope.legacy),
  );
  if (asked) {
    const hit = scoped.find((p: { id: string }) => p.id === asked) || points.find((p: { id: string }) => p.id === asked);
    if (hit && (scope.ownDoors.has(hit.id) || !scope.foreignDoors.has(hit.id))) return hit.id;
    return null;
  }
  if (scoped[0]?.id) return scoped[0].id;
  // Sede sin puerta: crea una por defecto para poder vincular.
  try {
    const created = await createPoint("Entrada principal");
    return created?.id || null;
  } catch {
    return points[0]?.id || null;
  }
}

export async function GET(req: Request) {
  const gymId = gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const devices = await listKioskDevices(gymId, true);
  return NextResponse.json({ ok: true, devices });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;

  const rl = rateLimit(`kiosk-pair-create:${auth.username}:${gymId}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited", retryAfterSec: rl.retryAfterSec }, { status: 429 });
  }

  if (body.action === "revoke") {
    const id = String(body.deviceId || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "deviceId" }, { status: 400 });
    try {
      const row = await revokeKioskDevice(id, gymId);
      return NextResponse.json({ ok: true, device: row });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 502 });
    }
  }

  const pointId = await resolvePointId(gymId, body.accessPointId ? String(body.accessPointId) : null);
  if (!pointId) {
    return NextResponse.json({ ok: false, error: "sin_puerta" }, { status: 400 });
  }

  try {
    const pairing = await createKioskPairingCode({
      gymId,
      accessPointId: pointId,
      deviceName: String(body.deviceName || "Kiosko").trim() || "Kiosko",
    });
    const publicBase = await resolvePublicBase(req);
    // Fragmento #code= no viaja al servidor ni queda en Referer/logs de access.
    const pairUrl =
      publicBase.replace(/\/$/, "") +
      "/kiosk/index.html?source=webcam#code=" +
      encodeURIComponent(pairing.code);
    if (isLocalBase(publicBase) && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "public_base_localhost", hint: "Define ENROLL_PUBLIC_BASE con la URL HTTPS publica" },
        { status: 500 },
      );
    }
    const qrDataUrl = await QRCode.toDataURL(pairUrl, { margin: 1, width: 280, errorCorrectionLevel: "M" });
    return NextResponse.json({
      ok: true,
      code: pairing.code,
      expiresAt: pairing.expiresAt,
      accessPointId: pairing.accessPointId,
      deviceName: pairing.deviceName,
      qrDataUrl,
      pairUrl,
      publicBase,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const gymId = url.searchParams.get("gym") || gymFromQuery(req);
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const id = url.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ ok: false, error: "deviceId" }, { status: 400 });
  try {
    const row = await revokeKioskDevice(id, gymId);
    return NextResponse.json({ ok: true, device: row });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 502 });
  }
}
