import { api, ApiError, getToken, setToken, toast, fileToBase64, readUrlToken, stripUrlToken, kioskHref } from './api.js?v=2';

const TOKEN_KEY = 'admin_token';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* Etiquetas legibles (los códigos técnicos quedan solo en logs/API). */
const T = {
  status: { ACTIVE: 'Activo', DISABLED: 'Inactivo', REVOKED: 'Revocado' },
  kind: { EMPLOYEE: 'Empleado', CONTRACTOR: 'Contratista', STAFF: 'Personal' },
  sec: { NORMAL: 'Normal (vida pasiva)', HIGH: 'Alta (exige reto)' },
  controller: {
    SIMULATED: 'Modo simulación', HTTP: 'Controlador HTTP/Relé', RELAY: 'Relé',
    HIKVISION_ISAPI: 'Controlador Hikvision', NONE: 'Sin controlador',
  },
  apkind: { PEDESTRIAN: 'Puerta peatonal' },
  decision: { GRANTED: 'Acceso concedido', DENIED: 'Acceso denegado' },
  reason: {
    MATCHED: 'Reconocido', UNKNOWN_SUBJECT: 'Persona no registrada',
    LIVENESS_FAILED: 'Prueba de vida fallida', CHALLENGE_REQUIRED: 'Requiere reto activo',
    NOT_AUTHORIZED: 'No autorizado', MEMBERSHIP_EXPIRED: 'Membresía vencida', OUT_OF_SCHEDULE: 'Fuera de horario',
    NO_CONSENT: 'Sin consentimiento', MANUAL: 'Apertura manual',
  },
};
const tr = (map, v) => map[v] ?? v;

const state = {
  token: getToken(TOKEN_KEY),
  tab: 'cameras',
  cameras: [],
  points: [],
  subjects: [],
  enroll: { subjectId: null, base64: null, stream: null },
};

boot();

function boot() {
  bindGlobal();
  // Demo: si llegamos con la sesión en la URL (#token=…), iniciamos sesión solos.
  const urlTok = readUrlToken();
  if (urlTok) {
    state.token = urlTok;
    setToken(TOKEN_KEY, urlTok);
    stripUrlToken();
  }
  if (!state.token) show('modal-login');
  else init();
}

function bindGlobal() {
  $('btn-login').onclick = doLogin;
  $('login-pass').addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
  $('btn-logout').onclick = () => { setToken(TOKEN_KEY, ''); location.reload(); };
  document.querySelectorAll('.nav-item').forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));

  $('cam-create').onclick = createCamera;
  $('cam-mode-device').onclick = chooseDeviceCam;
  $('cam-mode-ip').onclick = () => showIpForm(false);
  $('cam-mode-scan').onclick = startNetworkScan;
  $('cam-mode-nvr').onclick = () => showIpForm(true);
  $('cam-back-1').onclick = resetCamOnboard;
  $('cam-back-2').onclick = resetCamOnboard;
  $('cam-scan-back').onclick = resetCamOnboard;
  $('cam-help-toggle').onclick = () => $('cam-help').classList.toggle('hidden');
  $('cam-go-enroll').onclick = () => switchTab('subjects');
  $('cam-probe-btn').onclick = probeCamera;
  $('cam-probe-again').onclick = () => {
    $('cam-step2').classList.add('hidden');
    $('cam-probe-result').classList.add('hidden');
    $('cam-probe-thumb').style.display = 'none';
    $('cam-rtsp').focus();
  };
  $('cam-snap-close').onclick = () => {
    const img = $('cam-snap-img');
    img.src = '';  // detiene el MJPEG stream
    $('cam-snap-preview').classList.add('hidden');
  };  $('pt-create').onclick = createPoint;
  $('pt-level').onclick = (e) => { const b = e.target.closest('[data-lvl]'); if (b) setLevel(b.dataset.lvl); };
  $('pt-controller').onchange = updateRefField;
  $('pt-ref-help-toggle').onclick = () => $('pt-ref-help').classList.toggle('hidden');
  $('pt-match').oninput = () => { $('pt-match-val').textContent = $('pt-match').value + '%'; };
  $('pt-live').oninput = () => { $('pt-live-val').textContent = $('pt-live').value + '%'; };
  $('sub-create').onclick = createSubject;
  $('sub-refresh').onclick = loadSubjects;
  $('ev-refresh').onclick = loadEvents;
  $('sys-refresh').onclick = loadDiagnostics;

  // Enroll modal
  $('enroll-close').onclick = closeEnroll;
  $('enroll-ipcap').onclick = captureFromIp;
  $('enroll-cam').onclick = startWebcam;
  $('enroll-snap').onclick = snapWebcam;
  $('enroll-file').onchange = pickFile;
  $('enroll-submit').onclick = submitEnroll;
}

async function doLogin() {
  const email = $('login-email').value.trim();
  const password = $('login-pass').value;
  if (!email || !password) return toast('Ingrese credenciales', 'err');
  $('btn-login').disabled = true;
  try {
    const r = await api.post('/auth/login', { email, password });
    state.token = r.token;
    setToken(TOKEN_KEY, r.token);
    hide('modal-login');
    init();
  } catch (e) {
    toast(e instanceof ApiError ? e.message : 'Error de login', 'err');
  } finally {
    $('btn-login').disabled = false;
  }
}

async function init() {
  try {
    const me = await api.get('/auth/me', state.token);
    $('who').textContent = `${me.name} · ${me.role}`;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { setToken(TOKEN_KEY, ''); return show('modal-login'); }
  }
  wireKioskLinks();
  checkVision();
  switchTab('cameras');
}

/** En el demo, todos los enlaces "abrir kiosko" llevan la sesión (#token=…) para
 *  que el kiosko abra sin login y bajo la misma sesión de demo. */
function wireKioskLinks(root = document) {
  root.querySelectorAll('a[data-kiosk-link]').forEach((a) => {
    const base = (a.getAttribute('href') || '/kiosk/').split('#')[0];
    a.href = kioskHref(state.token, base);
  });
}

async function checkVision() {
  try {
    const h = await api.get('/access/health', state.token);
    const el = $('vision-health');
    el.textContent = h.ok ? '🟢 Vision en línea' : '🟠 Vision degradado';
    el.className = 'pill ' + (h.ok ? 'ok' : 'warn');
  } catch {
    $('vision-health').textContent = '🔴 Vision sin responder';
    $('vision-health').className = 'pill danger';
  }
}

function switchTab(tab) {
  state.tab = tab;
  stopDoorPoll();
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab').forEach((t) => t.classList.add('hidden'));
  $(`tab-${tab}`).classList.remove('hidden');
  if (tab === 'cameras') { resetCamOnboard(); loadPoints().then(() => loadCameras()); }
  if (tab === 'points') { setLevel(state.ptLevel || 'NORMAL'); updateRefField(); loadCameras().then(fillCamSelect); loadPoints(); startDoorPoll(); }
  if (tab === 'subjects') { loadPoints(); loadSubjects(); }
  if (tab === 'events') loadEvents();
  if (tab === 'system') loadDiagnostics();
}

function guard(e) {
  if (e instanceof ApiError && e.status === 401) { setToken(TOKEN_KEY, ''); show('modal-login'); return true; }
  toast(e instanceof ApiError ? e.message : 'Error de red', 'err');
  return false;
}

/* ── Cámaras ────────────────────────────────────────────────────────────── */
function resetCamOnboard() {
  $('cam-onboard').classList.remove('hidden');
  $('cam-ip-form').classList.add('hidden');
  $('cam-device-done').classList.add('hidden');
  $('cam-scan-panel').classList.add('hidden');
  // reset form state
  $('cam-step1').classList.remove('hidden');
  $('cam-step2').classList.add('hidden');
  $('cam-probe-result').classList.add('hidden');
  $('cam-probe-thumb').style.display = 'none';
  $('cam-rtsp').value = '';
  $('cam-name').value = '';
  $('cam-key').value = '';
  $('cam-snap-preview').classList.add('hidden');
}
function showIpForm(isNvr) {
  $('cam-onboard').classList.add('hidden');
  $('cam-device-done').classList.add('hidden');
  $('cam-ip-form').classList.remove('hidden');
  $('cam-ip-title').textContent = isNvr ? 'Conectar grabador NVR' : 'Conectar cámara IP';
  $('cam-nvr-field').style.display = isNvr ? '' : 'none';
  // fill access points dropdown for linking
  fillCamLinkSelect();
}
function fillCamLinkSelect() {
  const sel = $('cam-link-point');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Sin vincular por ahora —</option>' +
    state.points.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
}

/**
 * "Usar la cámara de este dispositivo": no requiere cámara IP. El kiosko usa la
 * webcam (recognize-image). Aseguramos que exista un punto de acceso usable y
 * guiamos al usuario a registrar un rostro y abrir el kiosko.
 */
async function chooseDeviceCam() {
  try {
    const points = await api.get('/access/points', state.token);
    if (!points.length) {
      await api.post(
        '/access/points',
        { name: 'Puerta (cámara del dispositivo)', controllerKind: 'SIMULATED', matchThreshold: 0.45, livenessThreshold: 0.5 },
        state.token,
      );
      toast('Punto de acceso creado', 'ok');
    }
    $('cam-onboard').classList.add('hidden');
    $('cam-device-done').classList.remove('hidden');
  } catch (e) { guard(e); }
}

async function startNetworkScan() {
  $('cam-onboard').classList.add('hidden');
  $('cam-scan-panel').classList.remove('hidden');
  const statusEl = $('cam-scan-status');
  const listEl = $('cam-scan-list');
  statusEl.textContent = '⏳ Escaneando la red… puede tardar hasta 60 segundos.';
  listEl.innerHTML = '<div style="color:var(--text-dim);font-size:.9rem">Probando IPs en paralelo…</div>';

  try {
    // Pasar subnet explícita 192.168.100 para que el backend no use la red Docker
    const result = await api.post('/cameras/scan', { subnet: '192.168.100' }, state.token);
    if (result.error) {
      statusEl.innerHTML = `❌ ${esc(result.error)}<br><br>
        <b>Para usar el escaneo automático:</b> abre una terminal y ejecuta:<br>
        <code style="background:rgba(255,255,255,.08);padding:4px 8px;border-radius:4px">python facial_webhook.py</code><br><br>
        O ingresa la URL manualmente con "Cámara IP".`;
      listEl.innerHTML = '';
      return;
    }
    if (!result.found || result.found.length === 0) {
      statusEl.textContent = `✅ Escaneo completado en ${(result.durationMs / 1000).toFixed(1)}s · Red: ${result.subnet}.0/24 · Sin cámaras encontradas.`;
      listEl.innerHTML = '<div style="color:var(--text-dim)">No se encontraron cámaras en la red. Prueba conectar la cámara y verificar que esté encendida.</div>';
      return;
    }
    statusEl.textContent = `✅ ${result.found.length} cámara${result.found.length > 1 ? 's' : ''} encontrada${result.found.length > 1 ? 's' : ''} en ${(result.durationMs / 1000).toFixed(1)}s · Red: ${result.subnet}.0/24`;
    renderScanResults(result.found);
  } catch (e) {
    statusEl.textContent = '❌ Error al escanear.';
    listEl.innerHTML = '';
    guard(e);
  }
}

function renderScanResults(candidates) {
  const listEl = $('cam-scan-list');
  const brandIcon = { hikvision: '🔵', dahua: '🟠', generic: '⚪' };
  const brandLabel = { hikvision: 'Hikvision', dahua: 'Dahua', generic: 'Genérica' };
  const needsAuth = (c) => c.method === 'auth_needed';

  listEl.innerHTML = candidates.map((c, i) => `
    <div class="card pad" style="display:flex;flex-direction:column;gap:10px" data-scan-idx="${i}">
      ${c.thumbnailB64
        ? `<img src="data:image/jpeg;base64,${c.thumbnailB64}" alt="Vista previa"
              style="width:100%;max-height:140px;object-fit:cover;border-radius:6px;border:1px solid var(--border)" />`
        : `<div style="height:80px;display:flex;align-items:center;justify-content:center;
              background:rgba(255,255,255,.04);border-radius:6px;border:1px solid var(--border);
              color:var(--text-dim);font-size:.85rem">${needsAuth(c) ? '🔒 Requiere credenciales' : '📷 Sin thumbnail'}</div>`
      }
      <div>
        <b>${brandIcon[c.brand] || '⚪'} ${brandLabel[c.brand] || c.brand} · ${esc(c.ip)}</b>
        <div class="sub" style="margin-top:2px">${esc(c.method)}</div>
      </div>
      ${needsAuth(c) ? `
        <div style="display:flex;gap:6px">
          <input placeholder="usuario" id="scan-user-${i}" value="admin"
                 style="flex:1;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.85rem" />
          <input placeholder="clave" id="scan-pass-${i}" value=""
                 style="flex:1;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.85rem" />
        </div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn sm" data-scan-use="${i}">➕ Usar esta cámara</button>
        ${needsAuth(c)
          ? `<button class="btn ghost sm" data-scan-probe="${i}">🔍 Probar con credenciales</button>`
          : ''}
      </div>
    </div>`).join('');

  // Botón "Usar esta cámara" → pre-rellena el form y va al paso 2
  listEl.querySelectorAll('[data-scan-use]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.scanUse);
      const c = candidates[idx];
      const userEl = $(`scan-user-${idx}`);
      const passEl = $(`scan-pass-${idx}`);
      const user = userEl?.value.trim() || '';
      const pass = passEl?.value.trim() || '';

      // Construir la URL con credenciales si las hay
      let rtspUrl = c.rtspUrl;
      if (user && !rtspUrl.includes('@')) {
        rtspUrl = rtspUrl.replace('rtsp://', `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`);
      } else if (user) {
        // reemplazar las credenciales vacías que generó el servidor
        rtspUrl = rtspUrl.replace(/rtsp:\/\/[^@]*@/, `rtsp://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`);
      }

      // Ir al form IP con la URL pre-rellenada y disparar probe
      $('cam-scan-panel').classList.add('hidden');
      showIpForm(false);
      $('cam-rtsp').value = rtspUrl;
      $('cam-name').value = `Cámara ${c.ip}`;
      await probeCamera();
    };
  });

  // Botón "Probar con credenciales" → llama al endpoint probe y actualiza la tarjeta
  listEl.querySelectorAll('[data-scan-probe]').forEach((btn) => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.scanProbe);
      const c = candidates[idx];
      const user = $(`scan-user-${idx}`)?.value.trim() || 'admin';
      const pass = $(`scan-pass-${idx}`)?.value.trim() || '';
      const snapshotUrl = c.snapshotUrl.replace(
        /^(https?:\/\/)[^@]*@/,
        `$1${encodeURIComponent(user)}:${encodeURIComponent(pass)}@`,
      ).replace(
        /^(https?:\/\/)([^@/]+)/,
        `$1${encodeURIComponent(user)}:${encodeURIComponent(pass)}@$2`,
      );

      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        const r = await api.post('/cameras/probe', { url: snapshotUrl }, state.token);
        if (r.ok && r.thumbnailB64) {
          // Actualizar thumbnail en la tarjeta
          const card = listEl.querySelector(`[data-scan-idx="${idx}"]`);
          const imgEl = card?.querySelector('img');
          if (imgEl) {
            imgEl.src = `data:image/jpeg;base64,${r.thumbnailB64}`;
          } else {
            const placeholder = card?.querySelector('div[style*="height:80px"]');
            if (placeholder) {
              placeholder.outerHTML = `<img src="data:image/jpeg;base64,${r.thumbnailB64}" alt="Vista previa"
                style="width:100%;max-height:140px;object-fit:cover;border-radius:6px;border:1px solid var(--border)" />`;
            }
          }
          // Actualizar la URL del candidato con credenciales que funcionaron
          candidates[idx] = { ...c, thumbnailB64: r.thumbnailB64, method: r.method };
          toast(`Cámara ${c.ip} verificada`, 'ok');
        } else {
          toast(`Sin respuesta de ${c.ip}: ${r.detail || 'verifica usuario y clave'}`, 'err');
        }
      } catch (e) { guard(e); }
      finally { btn.disabled = false; btn.textContent = '🔍 Probar con credenciales'; }
    };
  });
}

async function probeCamera() {
  const url = $('cam-rtsp').value.trim();
  if (!url) return toast('Ingresa la URL de la cámara', 'err');
  const btn = $('cam-probe-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Probando…';
  $('cam-probe-result').classList.remove('hidden');
  $('cam-probe-status').textContent = 'Conectando a la cámara…';
  $('cam-probe-status').className = 'pill';
  $('cam-probe-thumb').style.display = 'none';
  $('cam-step2').classList.add('hidden');

  try {
    const r = await api.post('/cameras/probe', { url }, state.token);
    const statusEl = $('cam-probe-status');
    if (r.ok) {
      statusEl.textContent = `✅ Cámara alcanzable · método: ${r.method}${r.detail ? ' · ' + r.detail : ''}`;
      statusEl.className = 'pill ok';
      if (r.thumbnailB64) {
        const img = $('cam-probe-thumb');
        img.src = `data:image/jpeg;base64,${r.thumbnailB64}`;
        img.style.display = 'block';
      }
      // Sugerir nombre basado en la IP
      if (!$('cam-name').value) {
        try {
          const u = new URL(url.replace(/^rtsp:\/\//i, 'http://'));
          $('cam-name').value = `Cámara ${u.hostname}`;
        } catch { /* noop */ }
      }
      $('cam-step2').classList.remove('hidden');
      await loadPoints();
      fillCamLinkSelect();
    } else {
      statusEl.textContent = `❌ Sin respuesta · ${r.detail || 'verifica IP, usuario y clave'}`;
      statusEl.className = 'pill danger';
    }
  } catch (e) {
    $('cam-probe-status').textContent = `❌ Error: ${e instanceof ApiError ? e.message : 'no se pudo probar'}`;
    $('cam-probe-status').className = 'pill danger';
  } finally {
    btn.disabled = false;
    btn.textContent = '🔍 Probar';
  }
}

async function loadCameras() {
  try { state.cameras = await api.get('/cameras', state.token); renderCameras(); }
  catch (e) { guard(e); }
}

function renderCameras() {
  const host = $('cam-list');
  if (!state.cameras.length) return (host.innerHTML = '<div class="empty">Sin cámaras aún.</div>');
  const linkedPoint = (camId) => state.points.find((p) => p.cameraId === camId);
  host.innerHTML = state.cameras.map((c) => {
    const pt = linkedPoint(c.id);
    return `
    <div class="item">
      <div class="spread">
        <div>
          <h4>${esc(c.name)}</h4>
          <div class="sub">
            ${c.externalKey ? 'clave: ' + esc(c.externalKey) + ' · ' : ''}
            canal NVR: ${c.nvrChannel ?? 0} ·
            <span class="tag">${esc(tr(T.status, c.status))}</span>
            ${pt ? ` · <span class="pill ok" style="font-size:.75rem">🚪 ${esc(pt.name)}</span>` : ' · <span class="pill warn" style="font-size:.75rem">Sin vincular</span>'}
          </div>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn ghost sm" data-snap="${c.id}" data-name="${esc(c.name)}">📸 Ver</button>
          <button class="btn danger sm" data-del="${c.id}">Eliminar</button>
        </div>
      </div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => delCamera(b.dataset.del)));
  host.querySelectorAll('[data-snap]').forEach((b) => (b.onclick = () => previewSnapshot(b.dataset.snap, b.dataset.name)));
}

/** Abre el stream MJPEG en vivo de la cámara vinculada al access point. */
async function previewSnapshot(camId, camName) {
  const pt = state.points.find((p) => p.cameraId === camId);
  if (!pt) {
    toast('Vincula la cámara a un punto de acceso para ver el stream', 'err');
    return;
  }
  const preview = $('cam-snap-preview');
  const img = $('cam-snap-img');
  $('cam-snap-label').textContent = `📹 En vivo · ${camName}`;

  // Detener stream anterior si lo había
  img.src = '';
  preview.classList.remove('hidden');
  preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    // Obtener token corto de stream (30 min, scope: kiosk:stream)
    const { token } = await api.get(`/access/points/${pt.id}/stream-token`, state.token);
    img.onerror = () => toast('Sin señal de la cámara', 'err');
    img.onload = () => { /* stream arrancó */ };
    // El <img> consume el MJPEG multipart/x-mixed-replace como video nativo
    img.src = `/api/v1/access/points/${pt.id}/stream.mjpeg?token=${encodeURIComponent(token)}`;
  } catch (e) {
    toast(`Error al abrir stream: ${e instanceof ApiError ? e.message : e.message}`, 'err');
    preview.classList.add('hidden');
  }
}

async function createCamera() {
  const rtspUrl = $('cam-rtsp').value.trim();
  const name = $('cam-name').value.trim();
  if (!name || !rtspUrl) return toast('URL y nombre son obligatorios', 'err');
  const body = {
    name,
    rtspUrl,
    externalKey: $('cam-key').value.trim() || undefined,
    nvrChannel: Number($('cam-nvr').value) || 0,
  };
  try {
    const cam = await api.post('/cameras', body, state.token);
    toast('Cámara guardada', 'ok');

    // Vincular al punto de acceso si se seleccionó uno
    const linkPt = $('cam-link-point').value;
    if (linkPt) {
      await api.post(`/cameras/${cam.id}/link-point`, { accessPointId: linkPt }, state.token);
      toast(`Vinculada a "${state.points.find((p) => p.id === linkPt)?.name || linkPt}"`, 'ok');
    }

    resetCamOnboard();
    await loadCameras();
    await loadPoints(); // actualiza cameraId en points
  } catch (e) { guard(e); }
}

async function delCamera(id) {
  if (!confirm('¿Eliminar esta cámara?')) return;
  try { await api.del(`/cameras/${id}`, state.token); loadCameras(); } catch (e) { guard(e); }
}

/* ── Puntos de acceso ───────────────────────────────────────────────────── */
async function loadPoints() {
  try { state.points = await api.get('/access/points', state.token); if (state.tab === 'points') renderPoints(); }
  catch (e) { guard(e); }
}
function fillCamSelect() {
  const sel = $('pt-cam');
  sel.innerHTML = '<option value="">📱 Cámara de este dispositivo (webcam)</option>' +
    state.cameras.map((c) => `<option value="${c.id}">📷 ${esc(c.name)}</option>`).join('');
}

/* Niveles de seguridad: traducen "negocio" → umbrales e ingeniería. */
const PT_LEVELS = {
  LOW:    { sec: 'NORMAL', match: 40, live: 40, desc: ['Coincidencia facial mínima 40%', 'Verificación de vida 40%', 'Acceso rápido y permisivo'] },
  NORMAL: { sec: 'NORMAL', match: 50, live: 60, desc: ['Coincidencia facial mínima 50%', 'Verificación de vida 60%', 'Equilibrio recomendado'] },
  HIGH:   { sec: 'NORMAL', match: 62, live: 75, desc: ['Coincidencia facial mínima 62%', 'Verificación de vida 75%', 'Más estricto contra falsos positivos'] },
  MAX:    { sec: 'HIGH',   match: 72, live: 85, desc: ['Coincidencia facial mínima 72%', 'Verificación de vida 85%', 'Exige reto de vida activo (gira / parpadea)', 'Auditoría completa'] },
};
function setLevel(lvl) {
  const p = PT_LEVELS[lvl] || PT_LEVELS.NORMAL;
  state.ptLevel = lvl;
  document.querySelectorAll('#pt-level [data-lvl]').forEach((b) => b.classList.toggle('active', b.dataset.lvl === lvl));
  $('pt-match').value = p.match; $('pt-match-val').textContent = p.match + '%';
  $('pt-live').value = p.live; $('pt-live-val').textContent = p.live + '%';
  $('pt-consequences').innerHTML = '<b>Con este nivel:</b><ul>' + p.desc.map((d) => `<li>✓ ${d}</li>`).join('') + '</ul>';
}
function updateRefField() {
  const k = $('pt-controller').value;
  const needsRef = k === 'HTTP' || k === 'HIKVISION_ISAPI';
  $('pt-ref-field').classList.toggle('hidden', !needsRef);
}

function renderPoints() {
  const host = $('pt-list');
  if (!state.points.length) return (host.innerHTML = '<div class="empty">Aún no has creado un punto de acceso.</div>');
  const camName = (id) => (state.cameras.find((c) => c.id === id)?.name) || (id ? 'Cámara IP' : 'Cámara del dispositivo');
  host.innerHTML = state.points.map((p) => `
    <div class="item ptcard">
      <div class="spread">
        <div>
          <h4><span class="dot ok"></span> ${esc(p.name)}</h4>
          <div class="ptmeta">
            <span>📷 ${esc(camName(p.cameraId))}</span>
            <span>🧠 Facial + vida</span>
            <span>🎛 ${esc(tr(T.controller, p.controllerKind || 'NONE'))}</span>
            <span>🎯 ${Math.round(p.matchThreshold * 100)}%</span>
            <span>🫥 ${Math.round(p.livenessThreshold * 100)}%</span>
            ${p.securityLevel === 'HIGH' ? '<span class="tag">Reto activo</span>' : ''}
          </div>
          <div class="sub faint" data-doorinfo="${p.id}">Puerta en espera</div>
        </div>
        <span class="pill" data-doorstate="${p.id}">🔒 Cerrada</span>
      </div>
      <div class="item-actions">
        <button class="btn sm" data-dooropen="${p.id}">🚪 Probar apertura</button>
        <button class="btn ghost sm" data-evpoint="${p.id}">📋 Ver eventos</button>
        <a class="btn ghost sm" href="/kiosk/" data-kiosk-link target="_blank" rel="noopener">🖥 Abrir kiosko</a>
      </div>
    </div>`).join('');
  host.querySelectorAll('[data-dooropen]').forEach((b) => (b.onclick = () => testOpenDoor(b.dataset.dooropen)));
  host.querySelectorAll('[data-evpoint]').forEach((b) => (b.onclick = () => switchTab('events')));
  wireKioskLinks(host);
}

const DOOR_TXT = { CLOSED: '🔒 Cerrada', OPENING: '🟢 Abriendo…', OPEN: '🚪 Abierta', CLOSING: '🔒 Cerrando…' };
async function testOpenDoor(id) {
  try {
    await api.post(`/access/points/${id}/door/test-open`, {}, state.token);
    toast('Apertura de prueba enviada', 'ok');
  } catch (e) { guard(e); }
}
function startDoorPoll() {
  stopDoorPoll();
  pollDoors();
  state.doorTimer = setInterval(pollDoors, 800);
}
function stopDoorPoll() {
  if (state.doorTimer) clearInterval(state.doorTimer);
  state.doorTimer = null;
}
async function pollDoors() {
  for (const p of state.points) {
    try {
      const d = await api.get(`/access/points/${p.id}/door-status`, state.token);
      const el = document.querySelector(`[data-doorstate="${p.id}"]`);
      if (el) {
        el.textContent = DOOR_TXT[d.state] || DOOR_TXT.CLOSED;
        el.className = 'pill ' + (d.state === 'OPEN' || d.state === 'OPENING' ? 'ok' : d.state === 'CLOSING' ? 'warn' : '');
      }
      const info = document.querySelector(`[data-doorinfo="${p.id}"]`);
      if (info) {
        if (d.state === 'OPEN') {
          info.textContent = `Abierta · re-bloqueo en ${Math.ceil((d.remainingMs || 0) / 1000)}s` + (d.lastOpenedBy ? ` · ${d.lastOpenedBy}` : '');
        } else if (d.lastOpenedAt) {
          info.textContent = `Última apertura: ${d.lastOpenedBy || '—'} · ${new Date(d.lastOpenedAt).toLocaleString()}`;
        } else {
          info.textContent = 'Puerta en espera';
        }
      }
    } catch { /* silencioso */ }
  }
}
async function createPoint() {
  const controller = $('pt-controller').value;
  const needsRef = controller === 'HTTP' || controller === 'HIKVISION_ISAPI';
  const body = {
    name: $('pt-name').value.trim(),
    kind: 'PEDESTRIAN',
    cameraId: $('pt-cam').value || undefined,
    securityLevel: (PT_LEVELS[state.ptLevel] || PT_LEVELS.NORMAL).sec,
    controllerKind: controller,
    controllerRef: needsRef ? ($('pt-ref').value.trim() || undefined) : undefined,
    matchThreshold: Number($('pt-match').value) / 100,
    livenessThreshold: Number($('pt-live').value) / 100,
  };
  if (!body.name) return toast('El nombre es obligatorio', 'err');
  try {
    await api.post('/access/points', body, state.token);
    toast('Punto de acceso creado', 'ok');
    $('pt-name').value = ''; $('pt-ref').value = '';
    loadPoints();
  } catch (e) { guard(e); }
}

/* ── Empleados ──────────────────────────────────────────────────────────── */
async function loadSubjects() {
  try { state.subjects = await api.get('/access/subjects', state.token); renderSubjects(); }
  catch (e) { guard(e); }
}
function initials(n) {
  return String(n || '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}
function renderSubjects() {
  const host = $('sub-list');
  if (!state.subjects.length) return (host.innerHTML = '<div class="empty">Aún no has incorporado ninguna identidad.</div>');
  host.innerHTML = state.subjects.map((s) => {
    const access = !!s.hasBiometrics; // puerta única: autorizado automáticamente al enrolar
    const done = (s.hasConsent ? 1 : 0) + (s.hasBiometrics ? 1 : 0) + (access ? 1 : 0);
    const pct = Math.round((done / 3) * 100);
    const chk = (ok, label, extra = '') => `<li class="${ok ? 'done' : ''}">${ok ? '✓' : '○'} ${label}${extra}</li>`;
    const last = s.lastAccessAt ? `Último acceso: ${new Date(s.lastAccessAt).toLocaleString()}` : 'Sin accesos registrados';
    let cta;
    if (!s.hasConsent) cta = `<button class="btn sm" data-consent="${s.id}">1 · Registrar consentimiento</button>`;
    else if (!s.hasBiometrics) cta = `<button class="btn sm" data-guided="${s.id}" data-name="${esc(s.fullName)}">2 · Registrar rostro (guiado)</button>`;
    else cta = `<span class="pill ok">✓ Identidad completa</span>`;
    return `
    <div class="item idcard">
      <div class="idhead">
        <div class="avatar">${esc(initials(s.fullName))}</div>
        <div style="flex:1;min-width:0">
          <h4>${esc(s.fullName)}</h4>
          <div class="sub">${esc(tr(T.kind, s.kind))}${s.employeeCode ? ' · #' + esc(s.employeeCode) : ''}</div>
        </div>
        <span class="pill ${s.status === 'ACTIVE' ? 'ok' : 'warn'}">${s.status === 'ACTIVE' ? '🟢 Activa' : '⚪ Inactiva'}</span>
      </div>
      <div class="prog"><div class="prog__bar"><i style="width:${pct}%"></i></div><span>Perfil ${pct}%</span></div>
      <ul class="checklist">
        ${chk(s.hasConsent, 'Consentimiento')}
        ${chk(s.hasBiometrics, 'Rostro registrado')}
        ${chk(access, 'Accesos asignados', access ? '' : ' <span class="faint">(automáticos al registrar el rostro)</span>')}
      </ul>
      <div class="sub faint">${last}</div>
      <div class="item-actions">
        ${cta}
        <details class="bio-menu"><summary>Gestionar biometría</summary>
          <div class="bio-menu__body">
            <button class="btn ghost sm" data-guided="${s.id}" data-name="${esc(s.fullName)}">✨ Registro guiado (recomendado)</button>
            <button class="btn ghost sm" data-enroll="${s.id}" data-name="${esc(s.fullName)}">📷 Foto simple</button>
            <button class="btn ghost sm" data-consent="${s.id}">📝 Registrar consentimiento</button>
            <button class="btn danger sm" data-erase="${s.id}">Eliminar biometría</button>
          </div>
        </details>
        <button class="btn ghost sm" data-toggle="${s.id}" data-status="${s.status}">${s.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>
      </div>
    </div>`;
  }).join('');
  host.querySelectorAll('[data-consent]').forEach((b) => (b.onclick = () => grantConsent(b.dataset.consent)));
  host.querySelectorAll('[data-guided]').forEach((b) => (b.onclick = () => openGuided(b.dataset.guided, b.dataset.name)));
  host.querySelectorAll('[data-enroll]').forEach((b) => (b.onclick = () => openEnroll(b.dataset.enroll, b.dataset.name)));
  host.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => toggleSubject(b.dataset.toggle, b.dataset.status)));
  host.querySelectorAll('[data-erase]').forEach((b) => (b.onclick = () => eraseBio(b.dataset.erase)));
}
async function createSubject() {
  const body = {
    fullName: $('sub-name').value.trim(),
    kind: $('sub-kind').value,
    employeeCode: $('sub-code').value.trim() || undefined,
  };
  if (!body.fullName) return toast('El nombre es obligatorio', 'err');
  try {
    await api.post('/access/subjects', body, state.token);
    toast('Identidad incorporada', 'ok');
    $('sub-name').value = ''; $('sub-code').value = '';
    loadSubjects();
  } catch (e) { guard(e); }
}
async function grantConsent(id) {
  if (!confirm('Registrar consentimiento biométrico ACTIVE para este empleado?')) return;
  try {
    await api.post(`/access/subjects/${id}/consent`, { purpose: 'Control de acceso facial — oficina', policyVersion: '1.0' }, state.token);
    toast('Consentimiento registrado', 'ok');
    loadSubjects();
  } catch (e) { guard(e); }
}
async function toggleSubject(id, status) {
  const next = status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  try { await api.patch(`/access/subjects/${id}`, { status: next }, state.token); loadSubjects(); } catch (e) { guard(e); }
}
async function eraseBio(id) {
  if (!confirm('Borrar TODA la biometría del empleado (irreversible)?')) return;
  try { const r = await api.del(`/access/subjects/${id}/biometrics`, state.token); toast(`Biometría borrada (${r.deletedTemplates} plantillas)`, 'ok'); loadSubjects(); }
  catch (e) { guard(e); }
}

/* ── Enrolamiento (modal) ───────────────────────────────────────────────── */
/** Garantiza el consentimiento biométrico antes de capturar (demo: se registra
 *  automáticamente si falta; en producción puede exigirse el paso explícito). */
function ensureConsent(id) {
  const s = state.subjects.find((x) => x.id === id);
  if (s && s.hasConsent) return;
  api.post(
    `/access/subjects/${id}/consent`,
    { purpose: 'Control de acceso facial — registro', policyVersion: '1.0' },
    state.token,
  ).then(() => loadSubjects()).catch(() => {});
}

/** Registro guiado por liveness activo (gira/parpadea en vivo). */
function openGuided(id, name) {
  ensureConsent(id); // en segundo plano: para no perder el gesto que abre la ventana
  const url = `enroll.html?subjectId=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
  window.open(url, '_blank', 'noopener');
}

function openEnroll(id, name) {
  ensureConsent(id);
  state.enroll = { subjectId: id, base64: null, stream: null };
  $('enroll-title').textContent = `Enrolar rostro — ${name}`;
  $('enroll-shot').classList.add('hidden');
  $('enroll-video').classList.add('hidden');
  $('enroll-placeholder').classList.remove('hidden');
  $('enroll-submit').disabled = true;
  $('enroll-snap').disabled = true;
  // Puntos de acceso disponibles para capturar de su cámara IP.
  const sel = $('enroll-point');
  sel.innerHTML = state.points.length
    ? state.points.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')
    : '<option value="" disabled selected>cree un punto con cámara</option>';
  $('enroll-ipcap').disabled = state.points.length === 0;
  show('modal-enroll');
}
function closeEnroll() {
  stopWebcam();
  hide('modal-enroll');
}

/** Captura un frame de la cámara IP del punto seleccionado (la misma que reconoce). */
async function captureFromIp() {
  const ptId = $('enroll-point').value;
  if (!ptId) return toast('Seleccione un punto de acceso con cámara', 'err');
  const btn = $('enroll-ipcap');
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = 'Capturando…';
  try {
    const res = await fetch(`/api/v1/access/points/${ptId}/snapshot`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) throw new Error(res.status === 503 ? 'cámara no responde' : `HTTP ${res.status}`);
    const blob = await res.blob();
    state.enroll.base64 = await fileToBase64(blob);
    const img = $('enroll-shot');
    img.src = `data:image/jpeg;base64,${state.enroll.base64}`;
    img.classList.remove('hidden');
    $('enroll-video').classList.add('hidden');
    $('enroll-placeholder').classList.add('hidden');
    stopWebcam();
    $('enroll-submit').disabled = false;
    toast('Frame capturado de la cámara de la puerta', 'ok');
  } catch (e) {
    toast(`No se pudo capturar de la cámara IP: ${e.message}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
}

async function startWebcam() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('sin soporte de cámara');
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 1280 } });
    state.enroll.stream = stream;
    const v = $('enroll-video');
    v.srcObject = stream;
    v.classList.remove('hidden');
    $('enroll-shot').classList.add('hidden');
    $('enroll-placeholder').classList.add('hidden');
    $('enroll-snap').disabled = false;
  } catch (e) {
    toast(`Webcam del navegador no disponible (${e.name || e.message}). Usa “Capturar” de la cámara IP o sube una foto.`, 'err');
  }
}
function stopWebcam() {
  if (state.enroll.stream) { state.enroll.stream.getTracks().forEach((t) => t.stop()); state.enroll.stream = null; }
}
function snapWebcam() {
  const v = $('enroll-video');
  const canvas = document.createElement('canvas');
  canvas.width = v.videoWidth; canvas.height = v.videoHeight;
  canvas.getContext('2d').drawImage(v, 0, 0);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  state.enroll.base64 = dataUrl.split(',')[1];
  const img = $('enroll-shot');
  img.src = dataUrl; img.classList.remove('hidden');
  v.classList.add('hidden');
  $('enroll-placeholder').classList.add('hidden');
  stopWebcam();
  $('enroll-submit').disabled = false;
}
async function pickFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  state.enroll.base64 = await fileToBase64(file);
  const img = $('enroll-shot');
  img.src = `data:${file.type || 'image/jpeg'};base64,${state.enroll.base64}`;
  img.classList.remove('hidden');
  $('enroll-video').classList.add('hidden');
  $('enroll-placeholder').classList.add('hidden');
  stopWebcam();
  $('enroll-submit').disabled = false;
}
async function submitEnroll() {
  if (!state.enroll.base64) return;
  $('enroll-submit').disabled = true;
  try {
    await api.post(`/access/subjects/${state.enroll.subjectId}/enroll`, { imageB64: state.enroll.base64 }, state.token);
    toast('Rostro enrolado correctamente', 'ok');
    closeEnroll();
    loadSubjects();
  } catch (e) {
    let msg = e instanceof ApiError ? e.message : 'Error';
    const reasons = {
      no_active_consent: 'Falta registrar el Consentimiento del empleado (botón “Consentimiento”).',
      NO_FACE: 'No se detectó un rostro en la imagen.',
      MULTIPLE_FACES: 'Hay más de un rostro en la imagen; debe haber solo uno.',
      LOW_QUALITY: 'Calidad/iluminación insuficiente; acércate y mejora la luz.',
      SPOOF_SUSPECTED: 'Posible suplantación (foto/pantalla) detectada.',
      vision_service_unavailable: 'El servicio de visión no responde.',
    };
    if (reasons[msg]) msg = reasons[msg];
    else if (e instanceof ApiError && e.body?.reason && reasons[e.body.reason]) msg = reasons[e.body.reason];
    toast(msg, 'err');
    $('enroll-submit').disabled = false;
  }
}

/* ── Eventos ────────────────────────────────────────────────────────────── */
async function loadEvents() {
  try {
    const evs = await api.get('/access/events?limit=50', state.token);
    const host = $('ev-list');
    if (!evs.length) return (host.innerHTML = '<div class="empty">Sin eventos registrados.</div>');
    host.innerHTML = evs.map((e) => {
      const ok = e.decision === 'GRANTED';
      return `<div class="item"><div class="spread">
        <div><h4>${ok ? '✔' : '✕'} ${esc(tr(T.decision, e.decision))} <span class="muted" style="font-weight:400">· ${esc(tr(T.reason, e.reason))}</span></h4>
        <div class="sub">${new Date(e.recordedAt).toLocaleString()} · coincidencia ${e.matchScore != null ? Math.round(e.matchScore * 100) + '%' : '—'} · vida ${e.livenessScore != null ? Math.round(e.livenessScore * 100) + '%' : '—'}</div></div>
        <span class="pill ${ok ? 'ok' : 'danger'}">${e.doorActuated ? '🔓 abierta' : '🔒 cerrada'}</span>
      </div></div>`;
    }).join('');
  } catch (e) { guard(e); }
}

/* ── Diagnóstico del sistema ────────────────────────────────────────────── */
async function loadDiagnostics() {
  const host = $('sys-list');
  host.innerHTML = '<div class="empty">Consultando estado…</div>';
  const row = (label, ok, detail) => `
    <div class="item"><div class="spread">
      <div><h4>${label}</h4><div class="sub">${detail || ''}</div></div>
      <span class="pill ${ok ? 'ok' : 'danger'}">${ok ? '🟢 Operativo' : '🔴 Falla'}</span>
    </div></div>`;
  try {
    const d = await api.get('/access/diagnostics', state.token);
    const comps = d.vision?.detail?.components || [];
    const qdrant = comps.find((c) => c.name === 'qdrant');
    let html = '';
    html += row('Reconocimiento facial (Visión)', !!d.vision?.ok, 'Identificación + prueba de vida');
    html += row('Base de datos', !!d.database?.ok, 'Empleados, permisos y bitácora');
    if (qdrant) html += row('Índice biométrico (Qdrant)', !!qdrant.ok, 'Almacén de rostros');
    for (const c of d.cameras || []) {
      const det = c.hasCamera
        ? (c.cameraName ? esc(c.cameraName) : '') + (c.lastFrameAt ? ` · último cuadro ${new Date(c.lastFrameAt).toLocaleTimeString()}` : ' · sin señal')
        : 'Sin cámara asignada';
      html += row(`Cámara · ${esc(c.name)}`, c.ok, det);
      html += row(`Controlador de puerta · ${esc(c.name)}`, true, tr(T.controller, c.controllerKind || 'NONE'));
    }
    host.innerHTML = html || '<div class="empty">Sin componentes.</div>';
  } catch (e) {
    if (!guard(e)) host.innerHTML = '<div class="empty">No se pudo consultar el estado.</div>';
  }
}

function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }
