/**
 * Cliente server-side del backend de Control de Acceso (proyecto `access`,
 * NestJS en :3010). Se usa SOLO desde route handlers. Cachea el token admin
 * (obtenido con las credenciales del kiosko) y lo renueva ante 401.
 *
 * Endpoints (prefijo global /api/v1, controller `access`):
 *  - POST   /access/kiosk/session         { email, password } → { token }
 *  - POST   /access/subjects              { fullName, employeeCode? } → subject
 *  - POST   /access/subjects/:id/consent  { purpose, policyVersion }
 *  - GET    /access/points                → puntos de acceso (kioscos/puertas)
 *  - GET    /access/points/:id/door-status
 *  - POST   /access/points/:id/door/test-open
 *  - GET    /access/events?limit=         → eventos recientes
 *  - GET    /access/health                → salud del Vision Service
 */

const ACCESS_URL = (process.env.ACCESS_URL || "http://127.0.0.1:3010").replace(/\/$/, "");
const ADMIN_EMAIL = process.env.ACCESS_ADMIN_EMAIL || "admin@office.local";
const ADMIN_PASS = process.env.ACCESS_ADMIN_PASS || "ChangeMe123!";

let cachedToken: string | null = null;

async function getToken(force = false): Promise<string> {
  if (cachedToken && !force) return cachedToken;
  const res = await fetch(`${ACCESS_URL}/api/v1/access/kiosk/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`login_backend_${res.status}`);
  const data = await res.json();
  cachedToken = data.token;
  return cachedToken as string;
}

export async function accessApi<T = any>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const doCall = async (tok: string) =>
    fetch(`${ACCESS_URL}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${tok}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  let tok = await getToken(false);
  let res = await doCall(tok);
  if (res.status === 401) {
    tok = await getToken(true);
    res = await doCall(tok);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new Error(`backend_${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data as T;
}

/** Token admin actual (para construir el link de enrolamiento con #token=). */
export async function adminToken(): Promise<string> {
  return getToken(false);
}

export async function updateSubjectProfile(subjectId: string, fullName: string, employeeCode?: string) {
  return accessApi("PATCH", `/access/subjects/${subjectId}`, {
    fullName: fullName.trim(),
    employeeCode: (employeeCode || "").trim(),
  });
}

/**
 * La ficha y la puerta comparten el mismo id. Si la fila de la puerta se perdió,
 * la vuelve a crear (con consentimiento) para que el enlace de registro sirva.
 */
export async function ensureAccessSubject(id: string, fullName: string, employeeCode?: string) {
  return accessApi("POST", "/access/subjects/ensure", {
    id,
    fullName: fullName.trim(),
    ...(employeeCode && employeeCode.trim() ? { employeeCode: employeeCode.trim() } : {}),
  });
}

export async function createSubject(fullName: string, employeeCode?: string) {
  return accessApi<any>("POST", "/access/subjects", {
    fullName: fullName.trim(),
    ...(employeeCode && employeeCode.trim() ? { employeeCode: employeeCode.trim() } : {}),
  });
}

export async function grantConsent(subjectId: string) {
  return accessApi("POST", `/access/subjects/${subjectId}/consent`, {
    purpose: "Control de acceso facial — gimnasio",
    policyVersion: "1.0",
  });
}

function subjectMissing(e: unknown) {
  const msg = String((e as { message?: string })?.message || e);
  return msg.includes("enrolled_subject_not_found") || msg.includes("backend_404");
}

/**
 * Borra plantillas + retrato y deja al sujeto listo para volver a enrolar.
 * Si la puerta ya no tiene a esa persona, devuelve false y no tumba el alta.
 */
export async function resetFaceForReenroll(subjectId: string): Promise<boolean> {
  try {
    await accessApi("DELETE", `/access/subjects/${subjectId}/biometrics`);
  } catch (e) {
    if (subjectMissing(e)) return false;
    throw e;
  }
  try {
    await accessApi("PATCH", `/access/subjects/${subjectId}`, { status: "ACTIVE" });
  } catch (e) {
    if (subjectMissing(e)) return false;
    throw e;
  }
  try {
    await grantConsent(subjectId);
  } catch {
    /* consentimiento ya activo */
  }
  return true;
}

export async function listSubjects(): Promise<any[]> {
  try {
    const p = await accessApi<any>("GET", "/access/subjects");
    return Array.isArray(p) ? p : p?.items ?? [];
  } catch {
    return [];
  }
}

/**
 * Borra biometría de sujetos que no tienen ficha de socio. Evita rostros
 * huérfanos (pruebas del panel viejo) que bloquean el enrolamiento.
 */
export async function purgeOrphanSubjects(keepIds: string[]): Promise<{ erased: string[]; disabled: string[] }> {
  const keep = new Set(keepIds.filter(Boolean));
  const subjects = await listSubjects();
  const erased: string[] = [];
  const disabled: string[] = [];
  for (const s of subjects) {
    if (!s?.id || keep.has(s.id)) continue;
    if (String(s.employeeCode || "").startsWith("guest:")) continue;
    if (s.hasBiometrics) {
      try {
        await accessApi("DELETE", `/access/subjects/${s.id}/biometrics`);
        erased.push(`${s.fullName || s.id}`);
      } catch (e) {
        if (!subjectMissing(e)) throw e;
      }
      continue;
    }
    if (s.status !== "DISABLED") {
      await accessApi("PATCH", `/access/subjects/${s.id}`, { status: "DISABLED" });
      disabled.push(`${s.fullName || s.id}`);
    }
  }
  return { erased, disabled };
}

/** Crea una puerta de la sede. No abre el torniquete ni le asigna controlador. */
export async function createPoint(name: string) {
  return accessApi<any>("POST", "/access/points", {
    name: name.trim(),
    kind: "PEDESTRIAN",
    controllerKind: "NONE",
  });
}

export async function listPoints(): Promise<any[]> {
  try {
    const p = await accessApi<any>("GET", "/access/points");
    return Array.isArray(p) ? p : p?.items ?? [];
  } catch {
    return [];
  }
}

/**
 * Escribe en cada puerta hasta cuándo puede entrar esta persona.
 * Una fecha pasada hace que el próximo reconocimiento niegue, sin abrir el torniquete.
 */
export async function setDoorUntil(
  subjectId: string,
  validUntil: string,
  schedule?: { days?: number[]; from?: string; to?: string } | null,
): Promise<number> {
  const points = await listPoints();
  for (const p of points) {
    if (!p?.id) continue;
    const body: Record<string, unknown> = { subjectId, accessPointId: p.id, validUntil };
    if (schedule) body.schedule = schedule;
    else body.schedule = null;
    await accessApi("POST", "/access/authorizations", body);
  }
  return points.length;
}

/** La puerta deja de tener controlador. No envía el pulso de apertura. */
export async function clearTurnstileController(pointId: string) {
  return accessApi("PATCH", `/access/points/${encodeURIComponent(pointId)}`, {
    controllerKind: "NONE",
    controllerRef: "",
  });
}

/**
 * La puerta queda apuntando al puente del gimnasio, no a la IP privada.
 * El servidor no alcanza la red AVE FENIX; el computador del local sí.
 * No envía el pulso de apertura.
 */
export async function setTurnstileController(pointId: string, ip: string, token: string) {
  if (!ip || token.length < 8) throw new Error("sin_red");
  const base = (process.env.TURNSTILE_PULSE_BASE || "http://gym_web:3100").replace(/\/$/, "");
  const ref = `POST ${base}/api/turnstiles/pulse?point=${encodeURIComponent(pointId)}|||Authorization: Bearer ${token}`;
  return accessApi("PATCH", `/access/points/${encodeURIComponent(pointId)}`, {
    controllerKind: "RELAY",
    controllerRef: ref,
  });
}

export async function doorTestOpen(pointId: string) {
  return accessApi("POST", `/access/points/${pointId}/door/test-open`, {});
}

export async function visionHealth(): Promise<{ ok: boolean; detail?: any }> {
  try {
    const h = await accessApi<any>("GET", "/access/health");
    return { ok: true, detail: h };
  } catch (e: any) {
    return { ok: false, detail: String(e?.message || e) };
  }
}

/** ¿Responde el backend de acceso? Cualquier respuesta HTTP = arriba. */
export async function backendUp(): Promise<boolean> {
  try {
    await fetch(`${ACCESS_URL}/kiosk/`, { redirect: "manual", cache: "no-store" });
    return true;
  } catch {
    return false;
  }
}

export async function listEvents(limit = 40, subjectId?: string): Promise<any[]> {
  try {
    const cap = 2000;
    const q = new URLSearchParams({ limit: String(Math.min(Math.max(limit, 1), cap)) });
    if (subjectId) q.set("subjectId", subjectId);
    const rows = await accessApi<any>("GET", `/access/events?${q.toString()}`);
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

/** JPEG del frame frontal del socio, o null si aún no hay captura. */
export async function fetchPortrait(subjectId: string): Promise<Buffer | null> {
  const doCall = async (tok: string) =>
    fetch(`${ACCESS_URL}/api/v1/access/subjects/${encodeURIComponent(subjectId)}/portrait`, {
      headers: { Authorization: `Bearer ${tok}` },
      cache: "no-store",
    });
  let tok = await getToken(false);
  let res = await doCall(tok);
  if (res.status === 401) {
    tok = await getToken(true);
    res = await doCall(tok);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`portrait_${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
