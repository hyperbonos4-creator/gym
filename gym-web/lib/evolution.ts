/**
 * Cliente server-side de Evolution API (gateway WhatsApp). Se usa SOLO desde
 * route handlers (server): la apikey nunca llega al navegador. Evolution corre
 * en loopback (127.0.0.1:8080). Cada gimnasio tiene su propia instancia.
 *
 * Contrato Evolution v2:
 *  - POST   /instance/create                { instanceName, qrcode, integration }
 *  - GET    /instance/connect/{instance}    → { base64 } (QR data URL)
 *  - GET    /instance/connectionState/{i}   → { instance: { state } }  open|connecting|close
 *  - DELETE /instance/logout/{instance}     → desvincula
 *  - GET    /instance/fetchInstances?instanceName={i} → dueño (número)
 */

import { deflateSync, inflateSync } from "zlib";

const EVOLUTION_URL = (process.env.EVOLUTION_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || "gym-evolution-key";

export type WaState = "open" | "connecting" | "qr" | "close";

export interface WaStatus {
  state: WaState;
  /** QR (data URL PNG) cuando hay que escanear; null si ya está conectado. */
  qr: string | null;
  /** Número vinculado (solo dígitos, E.164) cuando state === 'open'. */
  numero: string | null;
}

function digits(v: string): string {
  return String(v || "").split("@")[0].replace(/[^\d]/g, "");
}

async function call(
  path: string,
  method: "GET" | "POST" | "DELETE",
  body?: unknown,
): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(`${EVOLUTION_URL}${path}`, {
    method,
    headers: {
      apikey: EVOLUTION_KEY,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let parsed: any = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

function inst(instance: string): string {
  return encodeURIComponent(instance);
}

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}

function crc32buf(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const name = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32buf(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, sum]);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Evolution pinta el QR en azul. El lector del celular lo ignora; en negro sí lo toma. */
function toBlackQr(dataUrl: string): string {
  const b64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const png = Buffer.from(b64, "base64");
  if (png.length < 8 || png[0] !== 0x89) return dataUrl;
  let width = 0;
  let height = 0;
  let color = 0;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= png.length) {
    const len = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      color = data[9];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  if (!width || !height || color !== 6 || width > 1024 || height > 1024) return dataUrl;
  const bpp = 4;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const rows: Buffer[] = [];
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos];
    pos += 1;
    const row = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    const recon = Buffer.alloc(stride);
    const painted = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? recon[i - bpp] : 0;
      const up = prev[i];
      const ul = i >= bpp ? prev[i - bpp] : 0;
      const v = row[i];
      if (filter === 1) recon[i] = (v + left) & 255;
      else if (filter === 2) recon[i] = (v + up) & 255;
      else if (filter === 3) recon[i] = (v + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) recon[i] = (v + paeth(left, up, ul)) & 255;
      else recon[i] = v;
    }
    for (let x = 0; x < width; x++) {
      const i = x * bpp;
      const ink = recon[i + 3] > 40 && (recon[i] < 245 || recon[i + 1] < 245 || recon[i + 2] < 245);
      painted[i] = ink ? 0 : 255;
      painted[i + 1] = ink ? 0 : 255;
      painted[i + 2] = ink ? 0 : 255;
      painted[i + 3] = 255;
    }
    rows.push(painted);
    prev = recon;
  }
  const packed = Buffer.alloc(height * (1 + stride));
  rows.forEach((row, y) => {
    packed[y * (1 + stride)] = 0;
    row.copy(packed, y * (1 + stride) + 1);
  });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const out = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(packed)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${out.toString("base64")}`;
}

function normalizeQr(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.startsWith("data:image")) return null;
  try {
    return toBlackQr(raw);
  } catch {
    return raw;
  }
}

async function fetchOwnerNumber(instance: string): Promise<string | null> {
  try {
    const res = await call(`/instance/fetchInstances?instanceName=${inst(instance)}`, "GET");
    const item = Array.isArray(res.body) ? res.body[0] : res.body;
    const raw =
      item?.ownerJid ?? item?.owner ?? item?.instance?.owner ?? item?.instance?.ownerJid ?? "";
    const d = digits(raw);
    return d || null;
  } catch {
    return null;
  }
}

/** Estado de conexión (+ número si está abierto). */
export async function waStatus(instance: string): Promise<WaStatus> {
  let state: WaState = "close";
  try {
    const res = await call(`/instance/connectionState/${inst(instance)}`, "GET");
    const raw = res.body?.instance?.state ?? res.body?.state;
    state = raw === "open" ? "open" : raw === "connecting" ? "connecting" : "close";
  } catch {
    state = "close";
  }
  if (state === "open") {
    return { state, qr: null, numero: await fetchOwnerNumber(instance) };
  }
  if (state === "connecting") {
    try {
      const res = await call(`/instance/connect/${inst(instance)}`, "GET");
      const qr = normalizeQr(res.body?.base64 ?? res.body?.qrcode?.base64);
      if (qr) return { state: "qr", qr, numero: null };
    } catch {
      /* el estado sigue en connecting */
    }
  }
  return { state, qr: null, numero: null };
}

/** Asegura la instancia y devuelve el QR para vincular. */
export async function waConnect(instance: string): Promise<WaStatus> {
  // Crear instancia (idempotente: si ya existe, Evolution responde error y seguimos).
  try {
    await call("/instance/create", "POST", {
      instanceName: instance,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    });
  } catch {
    /* ya existe o gateway iniciando */
  }
  // Estado actual: si ya está abierto, no hace falta QR.
  const st = await waStatus(instance);
  if (st.state === "open") return st;
  // Pedir el QR.
  try {
    const res = await call(`/instance/connect/${inst(instance)}`, "GET");
    const qr = normalizeQr(res.body?.base64 ?? res.body?.qrcode?.base64);
    if (qr) return { state: "qr", qr, numero: null };
  } catch {
    /* fallthrough */
  }
  return { state: st.state, qr: null, numero: null };
}

/** Desvincula el número (cierra la sesión en Evolution). */
export async function waDisconnect(instance: string): Promise<{ ok: boolean }> {
  try {
    await call(`/instance/logout/${inst(instance)}`, "DELETE");
  } catch {
    /* best-effort */
  }
  return { ok: true };
}

const DEFAULT_COUNTRY = process.env.COUNTRY_CODE || "57"; // Colombia

/** Normaliza a E.164: 10 dígitos → prefijo país; si ya trae indicativo, se deja. */
export function toE164(numero: string): string {
  const d = digits(numero);
  if (!d) return "";
  return d.length === 10 ? DEFAULT_COUNTRY + d : d;
}

/** Envía un texto por WhatsApp desde la instancia del gimnasio. Best-effort. */
export async function waSendText(
  instance: string,
  numero: string,
  texto: string,
): Promise<{ ok: boolean; numero: string; error?: string }> {
  const e164 = toE164(numero);
  if (e164.length < 10) return { ok: false, numero: e164, error: "numero_invalido" };
  const st = await waStatus(instance);
  if (st.state !== "open") return { ok: false, numero: e164, error: "whatsapp_no_conectado" };
  try {
    const res = await call(`/message/sendText/${inst(instance)}`, "POST", { number: e164, text: texto });
    return { ok: res.ok, numero: e164, error: res.ok ? undefined : `evolution_${res.status}` };
  } catch (e: any) {
    return { ok: false, numero: e164, error: e?.message };
  }
}
