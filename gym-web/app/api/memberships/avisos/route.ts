import { NextResponse } from "next/server";
import { guardGym, gymFromQuery } from "../../../../lib/authServer";
import { gymInstance } from "../../../../lib/gymsStore";
import { bogotaToday, currentMembership, dueNotices, markNoticed } from "../../../../lib/memberships";
import { getSocio } from "../../../../lib/sociosStore";
import { waSendText } from "../../../../lib/evolution";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const gymId = String(body.gym || gymFromQuery(req));
  const auth = guardGym(req, gymId);
  if (auth instanceof NextResponse) return auth;
  const only = String(body.socioId || "");
  const due = only
    ? [currentMembership(gymId, only)].filter((m): m is NonNullable<typeof m> => !!m && m.live === "activa" && m.days >= 0 && m.days <= 7 && m.lastNoticeOn !== bogotaToday())
    : dueNotices(gymId);
  if (only && !due.length) {
    const current = currentMembership(gymId, only);
    return NextResponse.json({
      ok: true,
      due: 0,
      sent: 0,
      failed: [],
      already: current?.lastNoticeOn === bogotaToday(),
    });
  }
  const instance = gymInstance(gymId);
  let sent = 0;
  const failed: string[] = [];
  for (const m of due) {
    const socio = getSocio(m.socioId);
    if (!socio || socio.gymId !== gymId) continue;
    const phone = `${socio.codigoPais || ""}${socio.celular || ""}`;
    const when = m.days === 0 ? "hoy" : m.days === 1 ? "mañana" : `en ${m.days} días`;
    const text = `Hola ${socio.nombre.split(" ")[0]}. Tu plan ${m.planName} vence ${when} (${m.endsOn}). Renueva en recepción para seguir entrando.`;
    const res = await waSendText(instance, phone, text);
    if (res.ok) {
      markNoticed(gymId, m.id);
      sent += 1;
    } else {
      failed.push(socio.nombre);
    }
  }
  return NextResponse.json({ ok: true, due: due.length, sent, failed });
}
