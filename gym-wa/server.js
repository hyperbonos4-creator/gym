/* ============================================================================
   GYM · Conector (gym-wa)

   Un solo servicio Node que:
     1) Hace de PROXY al backend de acceso (http://127.0.0.1:3010), incluido
        WebSocket, para que kiosko/admin/enrolamiento y la API queden en el
        MISMO origen (un solo tunel ngrok, un solo certificado).
     2) Anade la ruta /wa: pagina "Registrar socio" + endpoint que crea el
        sujeto en el backend y ENVIA el link de enrolamiento por WhatsApp
        (Evolution API).

   La URL publica se deduce de las cabeceras del tunel (X-Forwarded-Host/Proto),
   asi que no hay que hardcodear el dominio de ngrok.
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');

const PORT = Number(process.env.PORT || 8090);
const BACKEND = process.env.BACKEND || 'http://127.0.0.1:3010';
const EVOLUTION_URL = (process.env.EVOLUTION_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const EVOLUTION_KEY = process.env.EVOLUTION_KEY || 'gym-evolution-key';
const INSTANCE = process.env.INSTANCE || 'gym';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@office.local';
const ADMIN_PASS = process.env.ADMIN_PASS || 'ChangeMe123!';
const DEFAULT_COUNTRY = process.env.COUNTRY_CODE || '57'; // Colombia

const PUBLIC_DIR = path.join(__dirname, 'public');

const proxy = httpProxy.createProxyServer({
  target: BACKEND,
  changeOrigin: true,
  ws: true,
  xfwd: true,
  proxyTimeout: 0,
  timeout: 0,
});
proxy.on('error', (err, req, res) => {
  try {
    if (res && res.writeHead && !res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    if (res && res.end) res.end('backend no disponible: ' + err.message);
  } catch (_) {}
});

/* ── Token admin (login por kiosk/session, cacheado) ─────────────────────── */
let adminToken = null;
async function getAdminToken(force) {
  if (adminToken && !force) return adminToken;
  const res = await fetch(`${BACKEND}/api/v1/access/kiosk/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (!res.ok) throw new Error(`login_backend_${res.status}`);
  const data = await res.json();
  adminToken = data.token;
  return adminToken;
}

async function backendApi(method, apiPath, body) {
  const doCall = async (tok) =>
    fetch(`${BACKEND}/api/v1${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${tok}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  let tok = await getAdminToken(false);
  let res = await doCall(tok);
  if (res.status === 401) {
    tok = await getAdminToken(true);
    res = await doCall(tok);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(`backend_${res.status}: ${JSON.stringify(data)}`);
  return data;
}

/* ── WhatsApp (Evolution API) ────────────────────────────────────────────── */
function digits(v) { return String(v || '').replace(/[^\d]/g, ''); }
function toE164(numero) {
  const d = digits(numero);
  if (!d) return '';
  // 10 digitos (Colombia movil) → prefijo pais. Si ya trae indicativo, se deja.
  return d.length === 10 ? DEFAULT_COUNTRY + d : d;
}

async function waState() {
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/connectionState/${encodeURIComponent(INSTANCE)}`, {
      headers: { apikey: EVOLUTION_KEY },
    });
    const b = await res.json();
    return (b && b.instance && b.instance.state) || 'close';
  } catch { return 'close'; }
}

async function waSendText(numero, texto) {
  const e164 = toE164(numero);
  if (e164.length < 10) return { ok: false, numero: e164, error: 'numero_invalido' };
  const st = await waState();
  if (st !== 'open') return { ok: false, numero: e164, error: 'whatsapp_no_conectado' };
  const res = await fetch(`${EVOLUTION_URL}/message/sendText/${encodeURIComponent(INSTANCE)}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: e164, text: texto }),
  });
  const ok = res.ok;
  return { ok, numero: e164, error: ok ? undefined : `evolution_${res.status}` };
}

/* ── Registro de socio + envio del link ──────────────────────────────────── */
async function registrarSocio({ nombre, telefono, codigo }, publicBase) {
  if (!nombre || !nombre.trim()) throw new Error('nombre_requerido');
  if (!telefono || digits(telefono).length < 10) throw new Error('telefono_invalido');

  // 1) Crear sujeto
  const subject = await backendApi('POST', '/access/subjects', {
    fullName: nombre.trim(),
    ...(codigo && codigo.trim() ? { employeeCode: codigo.trim() } : {}),
  });

  // 2) Consentimiento biometrico ACTIVE (necesario para enrolar)
  try {
    await backendApi('POST', `/access/subjects/${subject.id}/consent`, {
      purpose: 'Control de acceso facial — gimnasio',
      policyVersion: '1.0',
    });
  } catch (_) { /* si ya existe, seguir */ }

  // 3) Link de enrolamiento (lleva el token admin en el fragmento #token=)
  const tok = await getAdminToken(false);
  const q = `subjectId=${encodeURIComponent(subject.id)}&name=${encodeURIComponent(nombre.trim())}`;
  const link = `${publicBase}/kiosk/enroll.html?${q}#token=${encodeURIComponent(tok)}`;

  // 4) Enviar por WhatsApp
  const nombreCorto = nombre.trim().split(/\s+/)[0];
  const texto =
    `Hola ${nombreCorto}! 💪 Bienvenido al gym.\n\n` +
    `Para activar tu acceso con reconocimiento facial, abre este enlace desde tu celular y sigue las instrucciones (mira al frente, gira la cara y parpadea):\n\n` +
    `${link}\n\n` +
    `Toma menos de 1 minuto. Cualquier duda, respóndenos por aquí.`;
  const wa = await waSendText(telefono, texto);

  return { ok: true, subjectId: subject.id, link, wa };
}

/* ── Utilidades HTTP ─────────────────────────────────────────────────────── */
function publicBaseFrom(req) {
  const proto = (req.headers['x-forwarded-proto'] || '').split(',')[0] || 'http';
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return `${proto}://${host}`;
}
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
  });
}
function serveStatic(res, file) {
  const full = path.join(PUBLIC_DIR, file);
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(full).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

/* ── Servidor ────────────────────────────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  const url = req.url || '/';

  // Rutas propias del conector bajo /wa
  if (url === '/wa' || url === '/wa/') return serveStatic(res, 'index.html');

  if (url.startsWith('/wa/api/status')) {
    const st = await waState();
    return sendJson(res, 200, { whatsapp: st, connected: st === 'open' });
  }

  if (url === '/wa/api/register' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? JSON.parse(raw) : {};
      const result = await registrarSocio(body, publicBaseFrom(req));
      return sendJson(res, 200, result);
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: String(e.message || e) });
    }
  }

  if (url.startsWith('/wa/')) {
    return serveStatic(res, url.replace(/^\/wa\//, '').split('?')[0]);
  }

  // Todo lo demas → backend de acceso
  proxy.web(req, res);
});

server.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`gym-wa escuchando en :${PORT} → proxy a ${BACKEND}`);
  console.log(`Evolution: ${EVOLUTION_URL} (instancia ${INSTANCE})`);
});
