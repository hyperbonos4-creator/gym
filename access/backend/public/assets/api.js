/* Cliente de API compartido (kiosko + admin). Same-origin: el backend sirve
   el kiosko en /kiosk y la API en /api/v1. */
const API_BASE = '/api/v1';

export function getToken(key) {
  return localStorage.getItem(key) || '';
}
export function setToken(key, value) {
  if (value) localStorage.setItem(key, value);
  else localStorage.removeItem(key);
}

/* ── Traspaso de sesión por URL (demo: sin copiar/pegar) ────────────────────
   El demo abre el panel y el kiosko en pestañas nuevas (otro origen), así que
   no comparten localStorage. La sesión viaja en el fragmento `#token=…` (el
   fragmento NO se envía al servidor ni queda en el Referer). Cada página lo
   adopta al cargar y lo borra de la barra de direcciones. */

/** Lee el token de un login traspasado por URL (`#token=` o `?token=`). */
export function readUrlToken() {
  const fromHash = (location.hash || '').match(/(?:^|[#&])token=([^&]+)/);
  if (fromHash) return decodeURIComponent(fromHash[1]);
  const q = new URLSearchParams(location.search).get('token');
  return q || '';
}

/** Quita el token de la URL (barra/historial) tras adoptarlo. */
export function stripUrlToken() {
  try {
    const url = new URL(location.href);
    url.searchParams.delete('token');
    url.hash = (url.hash || '')
      .replace(/(?:^|[#&])token=[^&]*/, '')
      .replace(/^#&/, '#');
    if (url.hash === '#') url.hash = '';
    history.replaceState(null, '', url.toString());
  } catch {
    /* no-op: la URL queda como estaba */
  }
}

/** Decodifica los claims (payload) de un JWT sin verificar firma. `null` si falla. */
export function tokenClaims(jwt) {
  try {
    const p = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p));
  } catch {
    return null;
  }
}

/** URL del kiosko. Si hay token, viaja en el fragmento para no pedir login. */
export function kioskHref(token, base = '/kiosk/') {
  if (!token) return base;
  const join = base.includes('#') ? '&' : '#';
  return base + join + 'token=' + encodeURIComponent(token);
}

/** Prueba de entrada en el celular: webcam + sin login (el token caduca). */
export function previewKioskHref(token) {
  return kioskHref(token, '/kiosk/index.html?source=webcam&preview=1');
}

export class ApiError extends Error {
  constructor(status, body) {
    super((body && (body.message || body.error)) || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p, t) => request('GET', p, { token: t }),
  post: (p, b, t) => request('POST', p, { token: t, body: b }),
  patch: (p, b, t) => request('PATCH', p, { token: t, body: b }),
  del: (p, t) => request('DELETE', p, { token: t }),
};

/* ── Toasts ─────────────────────────────────────────────────────────────── */
export function toast(message, kind = '') {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    setTimeout(() => el.remove(), 300);
  }, 3800);
}

/** Convierte un File de imagen a base64 SIN el prefijo data:. */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
