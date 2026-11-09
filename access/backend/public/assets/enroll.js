/* ─────────────────────────────────────────────────────────────────────────
   Registro facial guiado por LIVENESS ACTIVO (reto-respuesta en vivo).

   Validación rigurosa por pose (no captura instantánea):
   - Cada acción exige PREPARACIÓN → (para giros) pasar por el CENTRO para
     "armar" → mantener la pose objetivo un TIEMPO MÍNIMO continuo (dwell) →
     captura del fotograma sostenido.
   - Parpadeo genuino: ojos confirmados ABIERTOS → CERRADOS (mínimo de tiempo)
     → ABIERTOS de nuevo. No se da por válido un frame estático.
   - Control de calidad biométrica: rostro único, encuadre suficiente, cabeza
     sin inclinación lateral excesiva (roll).
   - Pose (yaw): misma convención que el servidor (headpose.py): nariz vs.
     centro de ojos / distancia interocular. Umbrales del cliente MÁS estrictos
     que los del servidor para garantizar que el frame capturado revalida.
   - El frame se captura SIN espejar (orientación cruda de cámara); el espejo
     del preview es solo cosmético.

   El servidor REVALIDA todo (pose + anti-spoofing pasivo). El cliente no es la
   autoridad: es la guía precisa que produce frames válidos.
   ───────────────────────────────────────────────────────────────────────── */

import { api, ApiError, getToken, setToken, toast, readUrlToken, stripUrlToken, previewKioskHref } from './api.js?v=3';

const TOKEN_KEY = 'admin_token';
const $ = (id) => document.getElementById(id);

/* ── Umbrales de pose (cliente ESTRICTO; servidor: center 0.12 / turn 0.18) ── */
const CENTER_ENTER = 0.08; // |yaw| <= → frontal
const CENTER_EXIT = 0.14; // histéresis de salida del frontal
const TURN_ENTER = 0.42; // |yaw| >= → giro claro (con signo correcto)
const TURN_EXIT = 0.30; // histéresis: por debajo el giro se considera roto
const NEUTRAL_MAX = 0.12; // para "armar" un giro hay que volver a ~neutro
const ROLL_MAX_DEG = 16; // inclinación lateral (roll) máxima admitida
const MIN_FACE_WIDTH = 0.16; // ancho de rostro / ancho de frame (encuadre)

/* ── Tiempos (independientes del frame-rate) ────────────────────────────── */
const PREP_MS = 800; // estabilización al cambiar de acción
const DWELL_TURN_MS = 1300; // mantener el giro
const DWELL_CENTER_MS = 1100; // mantener el frente
const ACTION_TIMEOUT_MS = 28_000; // por acción

/* ── Parpadeo ───────────────────────────────────────────────────────────── */
const BLINK_CLOSE = 0.55; // blendshape ojo cerrado
const BLINK_OPEN = 0.20; // blendshape ojo abierto
const BLINK_MIN_CLOSED_MS = 70; // el ojo debe permanecer cerrado un mínimo real

const RING_CIRC = 2 * Math.PI * 38;

// Índices de landmarks (MediaPipe FaceLandmarker, 478 pts con iris).
const LM_IRIS_L = 468;
const LM_IRIS_R = 473;
const LM_EYE_L = 33;
const LM_EYE_R = 263;
const LM_NOSE = 1;

const ACTION_UI = {
  LOOK_LEFT: { icon: '⬅️', title: 'Gira a la izquierda', hint: 'Lleva el mentón hacia tu hombro izquierdo' },
  LOOK_RIGHT: { icon: '➡️', title: 'Gira a la derecha', hint: 'Lleva el mentón hacia tu hombro derecho' },
  LOOK_CENTER: { icon: '⌖', title: 'Mira al frente', hint: 'Rostro recto, ojos a la cámara' },
  BLINK: { icon: '😉', title: 'Parpadea', hint: 'Cierra y abre los ojos con naturalidad' },
};

/* Frases de voz (más naturales que el rótulo en pantalla). */
const ACTION_SPEAK = {
  LOOK_LEFT: 'Gira lentamente la cabeza hacia la izquierda',
  LOOK_RIGHT: 'Gira lentamente la cabeza hacia la derecha',
  LOOK_CENTER: 'Mira de frente a la cámara',
  BLINK: 'Parpadea una vez, con naturalidad',
};
/* Confirmaciones sobrias al capturar (se alternan para no sonar robótico). */
const CAPTURE_SPEAK = ['Perfecto', 'Muy bien', 'Excelente', 'Listo'];

const REASONS = {
  challenge_invalid_or_expired: 'El reto expiró. Reintenta el registro.',
  sequence_mismatch: 'La secuencia no coincidió con el reto. Reintenta.',
  action_failed: 'El servidor no pudo revalidar una de las poses. Reintenta con mejor luz, de frente y sin gorra/gafas oscuras.',
  challenge_expired: 'El reto expiró. Reintenta el registro.',
  liveness_unavailable: 'El detector anti-suplantación no está disponible en el servidor.',
  spoof_suspected: 'Posible suplantación (foto/pantalla). Debe ser una persona real frente a la cámara.',
  missing_center_frame: 'No se capturó un frame frontal válido.',
  no_active_consent: 'Falta el consentimiento ACTIVE del empleado (regístralo en administración).',
  already_enrolled: 'Este acceso ya tiene un rostro registrado. No hace falta volver a enrolar.',
  face_already_enrolled: 'Este rostro ya pertenece a otro socio. Una persona solo puede tener una identidad.',
  NO_FACE: 'No se detectó un rostro nítido en el frame frontal.',
  MULTIPLE_FACES: 'Se detectó más de un rostro; debe haber solo uno.',
  LOW_QUALITY: 'Calidad/iluminación insuficiente; acércate y mejora la luz.',
  SPOOF_SUSPECTED: 'Posible suplantación detectada.',
  vision_service_unavailable: 'El servicio de visión no responde.',
};

const params = new URLSearchParams(location.search);
const state = {
  token: getToken(TOKEN_KEY),
  subjectId: params.get('subjectId') || '',
  name: params.get('name') || 'Empleado',
  source: 'webcam',
  ipPointId: '',
  stream: null,
  landmarker: null,
  running: false,
  raf: 0,
  challenge: null,
  stepIndex: 0,
  captured: [],
  actionDeadline: 0,
  lastTs: -1,
  // estado por acción
  phase: 'prep', // prep | arming | holding (poses) · prep | need_open | ready | closing (blink)
  phaseStart: 0,
  holdStart: 0,
  armed: false,
  blinkClosedStart: 0,
};

boot();

function boot() {
  // Demo: adopta la sesión si llega por URL (#token=…), igual que el panel.
  const urlTok = readUrlToken();
  if (urlTok) {
    state.token = urlTok;
    setToken(TOKEN_KEY, urlTok);
    stripUrlToken();
  }
  $('who-name').textContent = state.name;
  if (!state.token) return fail('Sesión no válida. Pide que te reenvíen el link de enrolamiento.');
  if (!state.subjectId) return fail('Falta el identificador del socio en el link.');

  $('btn-start').onclick = start;
  $('btn-retry').onclick = retry;
  $('btn-start').disabled = true;
  setCue('◎', 'Registro facial', 'Comprobando el enlace antes de abrir la cámara');
  setFaceFlag('Comprobando…', '');
  prepareAccess();
}

function isMissingSubject(e) {
  if (!(e instanceof ApiError)) return false;
  const blob = `${e.message || ''} ${typeof e.body === 'string' ? e.body : JSON.stringify(e.body || {})}`;
  return blob.includes('enrolled_subject_not_found');
}

function readable(message) {
  const msg = String(message || '');
  if (msg.includes('enrolled_subject_not_found')) {
    return 'Este enlace no encuentra tu ficha en la puerta. Pide en recepción que te reenvíen el registro.';
  }
  if (msg.includes('no_active_consent')) {
    return 'Falta la autorización para usar el rostro. Pide en recepción que te reenvíen el registro.';
  }
  return REASONS[msg] || msg;
}

function setBoot(progress, label) {
  const bar = $('boot-bar');
  const lab = $('boot-label');
  if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
  if (lab && label) lab.textContent = label;
}

function hideBoot() {
  const boot = $('boot');
  if (boot) boot.classList.add('hidden');
}

async function confirmSubject() {
  try {
    await api.post('/access/subjects/ensure', { id: state.subjectId, fullName: state.name }, state.token);
  } catch (e) {
    if (isMissingSubject(e)) return 'missing';
  }
  try {
    await api.get(`/access/subjects/${state.subjectId}`, state.token);
    return 'ok';
  } catch (e) {
    if (isMissingSubject(e)) return 'missing';
    return 'unknown';
  }
}

async function prepareAccess() {
  setBoot(0.08, 'Comprobando tu acceso…');
  const gate = await confirmSubject();
  if (gate === 'missing') {
    return fail('Este enlace no encuentra tu ficha en la puerta. Pide en recepción que te reenvíen el registro.');
  }
  const already = await checkAlreadyEnrolled();
  if (already) return;
  $('btn-start').disabled = false;
  setBoot(0.16, 'Preparando el motor de visión…');
  setFaceFlag('Listo', '');
  setCue('◎', 'Cámara de tu celular', 'Pulsa Iniciar reconocimiento');
  const loading = ensureLandmarker((p) => {
    if (state.running) return;
    setBoot(0.16 + p * 0.84, p >= 1 ? 'Motor listo. Ya puedes iniciar.' : 'Preparando el motor de visión…');
  });
  state.enginePromise = loading;
  loading.then(() => {
    if (!state.running) setBoot(1, 'Motor listo. Ya puedes iniciar.');
  }).catch(() => {
    if (!state.running) setBoot(0.16, 'El motor se activará al iniciar.');
  });
}

async function checkAlreadyEnrolled() {
  try {
    const templates = await api.get(`/access/subjects/${state.subjectId}/templates`, state.token);
    if (!Array.isArray(templates) || templates.length === 0) return false;
    const photo = await fetch(`/api/v1/access/subjects/${state.subjectId}/portrait`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (photo.ok) {
      showAlreadyEnrolled();
      return true;
    }
  } catch {
    /* el servidor rechazará igual al intentar enrolar */
  }
  return false;
}

/* ── Arranque del flujo ─────────────────────────────────────────────────── */
async function start() {
  exitDoneState();
  $('btn-start').disabled = true;
  document.body.classList.add('enrolling');
  initAudio();
  speak('Vamos a registrar tu rostro. Sigue las indicaciones por voz.'); // dentro del gesto: desbloquea voz en iPhone
  $('result-card').classList.add('hidden');
  hideBoot();
  setCue('◎', 'Abriendo la cámara', 'Permite el acceso cuando el celular lo pida');
  setFaceFlag('Cámara…', '');

  try {
    await startWebcam();
  } catch (e) {
    document.body.classList.remove('enrolling');
    $('btn-start').disabled = false;
    return fail(e.message);
  }
  setCue('◎', 'Activando reconocimiento', 'La cámara ya está encendida');
  setFaceFlag('Motor de visión…', '');
  try {
    try {
      await (state.enginePromise || ensureLandmarker());
    } catch {
      state.enginePromise = null;
      await ensureLandmarker();
    }
  } catch (e) {
    stopSource();
    document.body.classList.remove('enrolling');
    $('btn-start').disabled = false;
    return fail(`No se pudo cargar el motor de detección facial: ${e.message}`);
  }
  try {
    state.challenge = await api.post(`/access/subjects/${state.subjectId}/liveness/challenge`, {}, state.token);
  } catch (e) {
    stopSource();
    document.body.classList.remove('enrolling');
    $('btn-start').disabled = false;
    const reason = e instanceof ApiError ? (e.body?.reason || e.body?.code || e.message) : '';
    if (reason === 'already_enrolled' || String(e?.message || '').includes('already_enrolled')) return showAlreadyEnrolled();
    return fail(e instanceof ApiError ? readable(e.message) : 'No se pudo obtener el reto de verificación.');
  }

  state.captured = [];
  state.stepIndex = 0;
  renderSteps(state.challenge.actions, 0, false);
  state.running = true;
  state.lastTs = -1;
  beginAction(0);
  loop();
}

/* ── MediaPipe Face Landmarker (self-hosted) ────────────────────────────── */
async function ensureLandmarker(onProgress) {
  if (state.landmarker) {
    if (onProgress) onProgress(1);
    return;
  }
  if (state.engineTask) return state.engineTask;
  const report = (p) => { if (onProgress) onProgress(p); };
  state.engineTask = (async () => {
    const modelPath = new URL('../vendor/mediapipe/face_landmarker.task', import.meta.url).href;
    report(0.2);
    const mp = await import('../vendor/mediapipe/vision_bundle.mjs');
    const { FaceLandmarker, FilesetResolver } = mp;
    const wasmBase = new URL('../vendor/mediapipe/wasm', import.meta.url).href;
    report(0.45);
    const fileset = await FilesetResolver.forVisionTasks(wasmBase);
    report(0.8);
    const opts = {
      // CPU a propósito: en el celular el delegado GPU a veces no responde
      // y la pantalla se queda en "Preparando" sin pasar al reconocimiento.
      baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
      runningMode: 'VIDEO',
      numFaces: 2, // detecta multi-rostro para poder rechazarlo
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    };
    state.landmarker = await FaceLandmarker.createFromOptions(fileset, opts);
    report(1);
  })();
  try {
    await state.engineTask;
  } catch (e) {
    state.engineTask = null;
    throw e;
  }
}

/* ── Fuentes de cámara ──────────────────────────────────────────────────── */
async function startWebcam() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara.');
  const v = $('video');
  v.setAttribute('playsinline', ''); v.setAttribute('autoplay', ''); v.muted = true;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
  } catch (e1) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch (e2) {
      throw new Error(`No se pudo abrir la cámara (${e2.name || e2.message}). Revisa el permiso de cámara del navegador y que ninguna otra app la esté usando.`);
    }
  }
  state.stream = stream;
  v.srcObject = stream;
  v.classList.remove('hidden');
  v.classList.add('mirror');
  $('ipview').classList.add('hidden');
  try { await v.play(); } catch { /* visible + muted suele bastar */ }
  await new Promise((res) => {
    if (v.readyState >= 2) return res();
    v.onloadeddata = () => res();
    setTimeout(res, 1500); // no colgar si loadeddata no dispara en algún móvil
  });
}

async function startIpStream() {
  if (!state.ipPointId) throw new Error('Selecciona un punto de acceso con cámara IP.');
  let token;
  try {
    ({ token } = await api.get(`/access/points/${state.ipPointId}/stream-token`, state.token));
  } catch (e) {
    throw new Error(e instanceof ApiError ? e.message : 'No se pudo abrir el stream de la cámara IP.');
  }
  const img = $('ipview');
  img.classList.remove('hidden', 'mirror');
  $('video').classList.add('hidden');
  await new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error('La cámara IP no envió imagen (timeout).')), 8000);
    img.onload = () => { clearTimeout(to); res(); };
    img.onerror = () => { clearTimeout(to); rej(new Error('La cámara IP no respondió.')); };
    img.src = `/api/v1/access/points/${state.ipPointId}/stream.mjpeg?token=${encodeURIComponent(token)}`;
  });
}

function currentSourceEl() {
  return state.source === 'webcam' ? $('video') : $('ipview');
}
function sourceDims(el) {
  return state.source === 'webcam'
    ? { w: el.videoWidth, h: el.videoHeight }
    : { w: el.naturalWidth, h: el.naturalHeight };
}

/* ── Bucle de detección ─────────────────────────────────────────────────── */
function loop() {
  if (!state.running) return;
  state.raf = requestAnimationFrame(loop);

  const el = currentSourceEl();
  const { w, h } = sourceDims(el);
  if (!w || !h) return;

  const work = $('work');
  if (work.width !== w) { work.width = w; work.height = h; }
  work.getContext('2d').drawImage(el, 0, 0, w, h);

  let ts = performance.now();
  if (ts <= state.lastTs) ts = state.lastTs + 1;
  state.lastTs = ts;

  let result;
  try {
    result = state.landmarker.detectForVideo(work, ts);
  } catch {
    return;
  }

  const now = performance.now();
  const faces = result.faceLandmarks || [];
  if (faces.length === 0) {
    setFaceFlag('Acerca tu rostro a la cámara', 'bad');
    breakHold();
    return checkTimeout(now);
  }
  if (faces.length > 1) {
    setFaceFlag('Solo una persona en cuadro', 'bad');
    breakHold();
    return checkTimeout(now);
  }

  const m = metrics(faces[0], result.faceBlendshapes?.[0]?.categories || [], w, h);
  const action = state.challenge.actions[state.stepIndex];
  if (action === 'BLINK') evaluateBlink(m, now);
  else evaluatePose(action, m, now);
  checkTimeout(now);
}

function checkTimeout(now) {
  const left = state.actionDeadline - Date.now();
  if (left <= 0) {
    $('timer').classList.add('hidden');
    return abortAttempt('Se agotó el tiempo para esta acción. Reintenta el registro.');
  }
  const t = $('timer');
  t.classList.remove('hidden');
  t.textContent = `${Math.ceil(left / 1000)}s`;
}

/* ── Métricas (convención del servidor + calidad) ───────────────────────── */
function metrics(lm, blend, w, h) {
  const eyeL = lm[LM_IRIS_L] || lm[LM_EYE_L];
  const eyeR = lm[LM_IRIS_R] || lm[LM_EYE_R];
  const nose = lm[LM_NOSE];
  let yaw = null, roll = 0;
  if (eyeL && eyeR && nose) {
    const elx = eyeL.x * w, ely = eyeL.y * h;
    const erx = eyeR.x * w, ery = eyeR.y * h;
    const interocular = Math.hypot(erx - elx, ery - ely);
    if (interocular > 1e-6) {
      yaw = (nose.x * w - (elx + erx) / 2) / interocular;
      roll = (Math.atan2(ery - ely, erx - elx) * 180) / Math.PI;
    }
  }
  // Encuadre: ancho del rostro respecto al frame.
  let minX = 1, maxX = 0;
  for (const p of lm) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; }
  const faceWidth = maxX - minX;

  let bl = 0, br = 0;
  for (const c of blend) {
    if (c.categoryName === 'eyeBlinkLeft') bl = c.score;
    else if (c.categoryName === 'eyeBlinkRight') br = c.score;
  }
  return { yaw, roll: Math.abs(roll), faceWidth, blinkMax: Math.max(bl, br), blinkMin: Math.min(bl, br) };
}

function qualityOk(m) {
  return m.faceWidth >= MIN_FACE_WIDTH && m.roll <= ROLL_MAX_DEG;
}
function qualityHint(m) {
  if (m.faceWidth < MIN_FACE_WIDTH) return 'Acércate un poco a la cámara';
  if (m.roll > ROLL_MAX_DEG) return 'Endereza la cabeza (sin inclinar)';
  return null;
}

/* ── Evaluación de poses (LOOK_LEFT / LOOK_RIGHT / LOOK_CENTER) ──────────── */
function evaluatePose(action, m, now) {
  // PREP: estabilización antes de exigir la pose.
  if (state.phase === 'prep') {
    setRing(0, '');
    setFaceFlag('Prepárate…', '');
    if (now - state.phaseStart >= PREP_MS) { state.phase = 'arming'; state.holdStart = 0; }
    return;
  }
  if (m.yaw == null) { setFaceFlag('Mantén el rostro visible', 'bad'); breakHold(); return; }

  const q = qualityHint(m);
  // ARMADO: para giros, exigir pasar por el centro (transición real).
  if (action !== 'LOOK_CENTER' && !state.armed) {
    setRing(0, '');
    if (Math.abs(m.yaw) <= NEUTRAL_MAX) { state.armed = true; setFaceFlag('Ahora gira', 'ok'); }
    else setFaceFlag('Vuelve al frente para empezar', '');
    return;
  }

  const strict = inTargetStrict(action, m.yaw);
  const loose = inTargetLoose(action, m.yaw);

  if (state.holdStart === 0) {
    // aún no sostiene: requiere entrada ESTRICTA + calidad
    if (strict && qualityOk(m)) {
      state.holdStart = now;
    } else {
      setRing(0, q ? 'bad' : '');
      setFaceFlag(q || cuePrompt(action), q ? 'bad' : '');
    }
    return;
  }

  // sosteniendo: tolera dips (banda de salida), pero exige calidad
  if (!loose || !qualityOk(m)) {
    state.holdStart = 0;
    setRing(0, '');
    setFaceFlag(q || 'Mantén la posición', q ? 'bad' : '');
    return;
  }
  const need = action === 'LOOK_CENTER' ? DWELL_CENTER_MS : DWELL_TURN_MS;
  const held = now - state.holdStart;
  setRing(held / need, held >= need ? 'ok' : '');
  setFaceFlag(`Mantén la posición… ${Math.max(0, Math.ceil((need - held) / 1000))}s`, 'ok');
  if (held >= need) captureCurrentFrame(action);
}

function cuePrompt(action) {
  return action === 'LOOK_CENTER' ? 'Mira al frente' : action === 'LOOK_LEFT' ? 'Gira a la izquierda' : 'Gira a la derecha';
}
function inTargetStrict(action, yaw) {
  if (action === 'LOOK_CENTER') return Math.abs(yaw) <= CENTER_ENTER;
  if (action === 'LOOK_RIGHT') return yaw <= -TURN_ENTER; // mentón a la derecha del usuario
  if (action === 'LOOK_LEFT') return yaw >= TURN_ENTER; // mentón a la izquierda del usuario
  return false;
}
function inTargetLoose(action, yaw) {
  if (action === 'LOOK_CENTER') return Math.abs(yaw) <= CENTER_EXIT;
  if (action === 'LOOK_RIGHT') return yaw <= -TURN_EXIT;
  if (action === 'LOOK_LEFT') return yaw >= TURN_EXIT;
  return false;
}

/* ── Evaluación de parpadeo (abierto → cerrado → abierto) ────────────────── */
function evaluateBlink(m, now) {
  if (state.phase === 'prep') {
    setRing(0.1, '');
    setFaceFlag('Prepárate…', '');
    if (now - state.phaseStart >= PREP_MS) state.phase = 'need_open';
    return;
  }
  if (!qualityOk(m)) { setFaceFlag(qualityHint(m) || 'Acomódate frente a la cámara', 'bad'); return; }

  if (state.phase === 'need_open') {
    // confirma ojos abiertos como línea base
    setRing(0.15, '');
    setFaceFlag('Mírame con los ojos abiertos', '');
    if (m.blinkMax < BLINK_OPEN) state.phase = 'ready';
    return;
  }
  if (state.phase === 'ready') {
    setFaceFlag('Ahora parpadea', '');
    if (m.blinkMax >= BLINK_CLOSE) { state.phase = 'closing'; state.blinkClosedStart = now; setRing(0.55, ''); }
    else setRing(0.25, '');
    return;
  }
  if (state.phase === 'closing') {
    setRing(0.7, '');
    if (m.blinkMin <= BLINK_OPEN) {
      // ojos reabiertos: ¿el cierre duró lo suficiente?
      if (now - state.blinkClosedStart >= BLINK_MIN_CLOSED_MS) {
        setRing(1, 'ok');
        captureCurrentFrame('BLINK');
      } else {
        state.phase = 'ready'; // demasiado corto: pide de nuevo
      }
    }
  }
}

/* ── Captura y avance ───────────────────────────────────────────────────── */
const CAPTURE_MAX_SIDE = 720; // acota el frame enviado (acelera la visión en CPU)

function captureCurrentFrame(action) {
  const work = $('work');
  const scale = Math.min(1, CAPTURE_MAX_SIDE / Math.max(work.width, work.height));
  let imageB64;
  if (scale < 1) {
    const out = document.createElement('canvas');
    out.width = Math.round(work.width * scale);
    out.height = Math.round(work.height * scale);
    out.getContext('2d').drawImage(work, 0, 0, out.width, out.height);
    imageB64 = out.toDataURL('image/jpeg', 0.92).split(',')[1];
  } else {
    imageB64 = work.toDataURL('image/jpeg', 0.92).split(',')[1];
  }
  state.captured.push({ action, imageB64 });
  captureBeep();
  speak(CAPTURE_SPEAK[(state.stepIndex) % CAPTURE_SPEAK.length]);

  const stage = $('stage');
  stage.classList.remove('flash');
  void stage.offsetWidth;
  stage.classList.add('flash');

  markStep(state.stepIndex, 'done');
  state.stepIndex += 1;
  if (state.stepIndex >= state.challenge.actions.length) finishAndSubmit();
  else beginAction(state.stepIndex);
}

function beginAction(i) {
  const action = state.challenge.actions[i];
  const ui = ACTION_UI[action];
  setCue(ui.icon, ui.title, ui.hint);
  speak(ACTION_SPEAK[action] || ui.title);
  setRing(0, '');
  state.phase = 'prep';
  state.phaseStart = performance.now();
  state.holdStart = 0;
  state.armed = false;
  state.blinkClosedStart = 0;
  state.actionDeadline = Date.now() + ACTION_TIMEOUT_MS;
  markStep(i, 'active');
}

function breakHold() {
  state.holdStart = 0;
  setRing(0, '');
}

/* ── Envío al backend ───────────────────────────────────────────────────── */
async function finishAndSubmit() {
  state.running = false;
  cancelAnimationFrame(state.raf);
  $('timer').classList.add('hidden');
  setCue('⏳', 'Verificando…', 'Revalidando prueba de vida y enrolando el rostro');
  setFaceFlag('Procesando', '');
  setRing(1, 'ok');
  try {
    const res = await api.post(
      `/access/subjects/${state.subjectId}/liveness/enroll`,
      { challengeId: state.challenge.challengeId, frames: state.captured },
      state.token,
    );
    stopSource();
    res.ok ? showSuccess(res) : showFailure(res);
  } catch (e) {
    stopSource();
    const msg = e instanceof ApiError ? (e.body?.message || e.message) : e.message;
    fail(msg || 'Error al enrolar.');
  }
}

function enterDoneState() {
  document.documentElement.classList.add('done');
  document.body.classList.add('done');
  document.body.classList.remove('enrolling');
  $('timer').classList.add('hidden');
  hideBoot();
}

function exitDoneState() {
  document.documentElement.classList.remove('done');
  document.body.classList.remove('done');
  hideResultPhoto();
}

function centerFrameB64() {
  const frames = state.captured || [];
  const center = frames.find((f) => f.action === 'LOOK_CENTER') || frames[frames.length - 1];
  return center?.imageB64 || '';
}

function showResultPhoto(b64) {
  const img = $('result-photo');
  if (!img) return;
  if (!b64) {
    img.classList.add('hidden');
    img.removeAttribute('src');
    return;
  }
  img.src = `data:image/jpeg;base64,${b64}`;
  img.classList.remove('hidden');
}

function hideResultPhoto() {
  const img = $('result-photo');
  if (!img) return;
  img.classList.add('hidden');
  img.removeAttribute('src');
}

function notifyGymRegistration() {
  const subjectId = state.subjectId;
  if (!subjectId) return;
  fetch("/api/invitaciones/enrolado", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subjectId }),
  }).catch(() => {});
}

function showSuccess(res) {
  notifyGymRegistration();
  enterDoneState();
  successChime();
  speak('Registro exitoso. Puedes probar cómo será en la entrada.');
  $('result-card').classList.remove('hidden');
  $('result').className = 'result ok';
  $('result-title').textContent = '✔ Registro exitoso';
  $('result-detail').textContent = 'La verificación de vida y la captura facial se completaron. Ya puedes entrar al gimnasio con tu rostro.';
  showResultPhoto(centerFrameB64());
  showScore(res.passiveScore);
  showPreviewAction();
  $('btn-start').classList.add('hidden');
  $('btn-retry').classList.add('hidden');
  toast('Registro exitoso', 'ok');
}

function showAlreadyEnrolled() {
  notifyGymRegistration();
  enterDoneState();
  $('result-card').classList.remove('hidden');
  $('result').className = 'result ok';
  $('result-title').textContent = '✔ Rostro ya registrado';
  $('result-detail').textContent = 'No hace falta volver a enrolar. Este acceso ya está activo con tu rostro.';
  $('result-scores').classList.add('hidden');
  hideResultPhoto();
  showPreviewAction();
  $('btn-start').classList.add('hidden');
  $('btn-retry').classList.add('hidden');
}

function showPreviewAction() {
  try { localStorage.removeItem('kiosk_preview_done'); } catch { /* ignore */ }
  const acts = $('result-actions');
  if (!acts) return;
  acts.innerHTML =
    '<p class="next-steps">Prueba ahora cómo se verá en la entrada. No pide usuario ni contraseña. Este acceso es temporal: cuando el link expire, ya no abrirá.</p>' +
    '<a class="btn big-btn" id="btn-preview" href="' + previewKioskHref(state.token) + '">Probar en la entrada</a>';
  acts.classList.remove('hidden');
}

function showFailure(res) {
  enterDoneState();
  errorBeep();
  const reason = res.reason || (res.stage === 'sequence' ? 'action_failed' : 'liveness_unavailable');
  if (reason === 'already_enrolled') return showAlreadyEnrolled();
  const text = REASONS[reason] || `No se pudo completar la verificación (${reason}).`;
  const duplicate = reason === 'face_already_enrolled';
  setCue('⚠️', duplicate ? 'Rostro ya registrado' : 'No fue exitoso', duplicate ? 'Usa el acceso original' : 'Corrige lo indicado y vuelve a intentar');
  $('result-card').classList.remove('hidden');
  $('result').className = 'result err';
  $('result-title').textContent = duplicate ? '✕ Este rostro ya está en el sistema' : '✕ No fue exitoso';
  $('result-detail').textContent = text;
  hideResultPhoto();
  if (res.passiveScore != null) showScore(res.passiveScore);
  else $('result-scores').classList.add('hidden');
  const acts = $('result-actions');
  if (acts) {
    acts.innerHTML = duplicate
      ? '<p class="next-steps">No se puede crear otra identidad con el mismo rostro. Pide al gimnasio que te reenvíe el link del socio original.</p>'
      : '<p class="next-steps">Puedes volver a intentarlo ahora mismo. Mejor luz, de frente, sin gorra ni gafas oscuras.</p>';
    acts.classList.remove('hidden');
  }
  $('btn-start').classList.add('hidden');
  if (duplicate) {
    $('btn-retry').classList.add('hidden');
  } else {
    $('btn-retry').classList.remove('hidden');
    $('btn-retry').textContent = 'Reintentar verificación';
  }
}

function showScore(passive) {
  if (passive == null || passive <= 0) return $('result-scores').classList.add('hidden');
  $('result-scores').classList.remove('hidden');
  $('score-passive').textContent = `${Math.round(passive * 100)}%`;
}

/* ── Aborto / reintento / error ─────────────────────────────────────────── */
function abortAttempt(message) {
  if (!state.running) return;
  state.running = false;
  cancelAnimationFrame(state.raf);
  $('timer').classList.add('hidden');
  stopSource();
  fail(message);
}

function retry() {
  exitDoneState();
  document.body.classList.remove('enrolling');
  $('btn-retry').classList.add('hidden');
  $('result-card').classList.add('hidden');
  const acts = $('result-actions');
  if (acts) { acts.innerHTML = ''; acts.classList.add('hidden'); }
  $('btn-start').classList.remove('hidden');
  $('btn-start').disabled = false;
  setCue('📷', 'Listo para reintentar', 'Pulsa Iniciar y permite la cámara');
  setFaceFlag('Listo', '');
  setRing(0, '');
}

function fail(message) {
  enterDoneState();
  hideResultPhoto();
  $('result-card').classList.remove('hidden');
  $('result').className = 'result err';
  $('result-title').textContent = '✕ No fue exitoso';
  $('result-detail').textContent = readable(message);
  $('result-scores').classList.add('hidden');
  setCue('⚠️', 'No fue exitoso', 'Reintenta cuando estés listo');
  setFaceFlag('Detenido', 'bad');
  $('btn-retry').classList.remove('hidden');
  $('btn-retry').textContent = 'Reintentar verificación';
  $('btn-start').classList.add('hidden');
}

function stopSource() {
  if (state.stream) { state.stream.getTracks().forEach((t) => t.stop()); state.stream = null; }
  const img = $('ipview');
  if (img.src) img.removeAttribute('src');
}

/* ── UI helpers ─────────────────────────────────────────────────────────── */
function setCue(icon, title, hint) {
  $('cue-icon').textContent = icon;
  $('cue-title').textContent = title;
  $('cue-hint').textContent = hint;
}
function setFaceFlag(text, kind) {
  const el = $('face-flag');
  el.textContent = text;
  el.className = `face-flag ${kind || ''}`;
}
function setRing(progress, kind) {
  const p = Math.max(0, Math.min(1, progress));
  $('ring').style.strokeDashoffset = String(RING_CIRC * (1 - p));
  $('guide').className = `guide ${kind || ''}`;
}
function renderSteps() { /* los gestos se anuncian en vivo, no en lista previa */ }
function markStep() { /* noop: la indicación vive en el overlay de la cámara */ }
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Libera la cámara/stream al cerrar o navegar fuera de la página.
window.addEventListener('beforeunload', () => {
  state.running = false;
  cancelAnimationFrame(state.raf);
  stopSource();
});
window.addEventListener('pagehide', stopSource);

/* ── Audio (pitidos) y voz (anuncios) ───────────────────────────────────── */
let audioCtx = null;
function initAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio */ }
}
function tone(freq, durMs, vol, delayMs) {
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime + (delayMs || 0) / 1000;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(t0); osc.stop(t0 + durMs / 1000);
}
function captureBeep() { tone(988, 120, 0.25, 0); tone(1319, 160, 0.25, 120); } // ding-ding (capturado)
function successChime() { tone(784, 130, 0.25, 0); tone(1047, 130, 0.25, 130); tone(1319, 220, 0.25, 260); }
function errorBeep() { tone(220, 240, 0.25, 0); }
function speak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.resume();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    if (_voice) u.voice = _voice;
    u.rate = 1.0; u.pitch = 1;
    window.speechSynthesis.speak(u);
  } catch { /* sin voz */ }
}

/* Selección de voz en español (iOS/Android cargan las voces de forma asíncrona). */
let _voice = null;
function pickVoice() {
  try {
    const vs = window.speechSynthesis.getVoices() || [];
    _voice = vs.find((v) => /^es(-|_)/i.test(v.lang)) || vs.find((v) => (v.lang || '').toLowerCase().startsWith('es')) || null;
  } catch { /* noop */ }
}
if ('speechSynthesis' in window) {
  pickVoice();
  window.speechSynthesis.onvoiceschanged = pickVoice;
}
