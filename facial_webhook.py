"""
Receptor HTTP para el facial FACE SERVER (192.168.100.200).

Flujo:
  1. Facial chino detecta una cara → POST VerifyPush → este webhook
  2. El webhook captura una foto de la cámara IP (o usa la imagen embebida)
  3. Llama POST /api/v1/access/points/{ACCESS_POINT_ID}/recognize-image al backend access
  4. Si la respuesta es GRANTED → abre torniquete por ESP32
  5. Si es DENIED → no hace nada (el facial chino ya actuó como sensor, no como árbitro)

El facial chino NO es quien decide el acceso. Solo detecta que hay una cara.
La decisión real la toma el backend access (Qdrant 1:N + autorización + horario).

Configura en el facial:
  HTTP Subscription -> Server Address: IP de este PC (ej. 192.168.100.56)
  Server Port: 8787
  Authentication Subscription: Subscribe → w/captured image
  (con imagen: el webhook la usa directamente sin llamar a la IP cam)
  (sin imagen: el webhook captura un snapshot de IP_CAM_URL)

Variables .env requeridas:
  ACCESS_API_URL      http://localhost:3000
  ACCESS_API_EMAIL    admin@office.local
  ACCESS_API_PASSWORD ChangeMe123!
  ACCESS_POINT_ID     <UUID del punto de acceso torniquete>
  IP_CAM_URL          http://192.168.100.xxx/...  (opcional si usas w/captured image)

Uso:
  python facial_webhook.py
  python facial_webhook.py --port 8787 --dry-run   # solo log, no abre torniquete
"""

from __future__ import annotations

import argparse
import base64
import json
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from gym_torniquete import TurnstileClient
from gym_torniquete.client import load_env_file

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

# ── Token de sesión con el backend access ─────────────────────────────────────

_token_lock = threading.Lock()
_access_token: str | None = None
_token_expires_at: float = 0.0


def _get_token(api_url: str, email: str, password: str) -> str:
    """Devuelve un JWT válido; renueva si expira en < 60 s."""
    global _access_token, _token_expires_at
    with _token_lock:
        if _access_token and time.time() < _token_expires_at - 60:
            return _access_token
        url = f"{api_url.rstrip('/')}/api/v1/auth/login"
        payload = json.dumps({"email": email, "password": password}).encode()
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
        _access_token = body["token"]
        # TTL por defecto 12 h; guardamos 11 h para renovar antes.
        _token_expires_at = time.time() + 11 * 3600
        print(f"  [access] token renovado ({email})")
        return _access_token


def _capture_from_ipcam(ipcam_url: str) -> str | None:
    """Descarga un snapshot JPEG de la IP cam y devuelve base64. None si falla."""
    if not ipcam_url:
        return None
    try:
        req = urllib.request.Request(ipcam_url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read()
        return base64.b64encode(data).decode()
    except Exception as exc:
        print(f"  [ipcam] snapshot fallido: {exc}")
        return None


def _recognize_and_decide(
    api_url: str,
    email: str,
    password: str,
    access_point_id: str,
    image_b64: str,
) -> dict[str, Any]:
    """
    POST /api/v1/access/points/{id}/recognize-image
    Devuelve el KioskRecognitionResult completo, o lanza excepción.
    """
    token = _get_token(api_url, email, password)
    url = f"{api_url.rstrip('/')}/api/v1/access/points/{access_point_id}/recognize-image"
    payload = json.dumps({"imageB64": image_b64}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


# ── Escáner de cámaras IP en la red local ────────────────────────────────────

def _detect_subnet() -> str:
    """Detecta la subred /24 de la primera interfaz privada del host."""
    import socket as _s
    candidates: list[str] = []
    try:
        import netifaces  # type: ignore
        for iface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(iface).get(netifaces.AF_INET, [])
            for a in addrs:
                ip = a.get("addr", "")
                if _is_private(ip):
                    candidates.append(ip)
    except ImportError:
        # fallback: conectar UDP para conocer la IP saliente
        try:
            with _s.socket(_s.AF_INET, _s.SOCK_DGRAM) as sock:
                sock.connect(("8.8.8.8", 80))
                candidates.append(sock.getsockname()[0])
        except Exception:
            pass
    for ip in candidates:
        parts = ip.split(".")
        if len(parts) == 4:
            return f"{parts[0]}.{parts[1]}.{parts[2]}"
    return "192.168.1"


def _is_private(ip: str) -> bool:
    if ip.startswith("127.") or ip.startswith("169.254."):
        return False
    return (
        ip.startswith("192.168.")
        or ip.startswith("10.")
        or any(ip.startswith(f"172.{i}.") for i in range(16, 32))
    )


def _tcp_probe(ip: str, port: int, timeout: float) -> bool:
    """True si hay algo escuchando en ip:port dentro del timeout."""
    try:
        with socket.create_connection((ip, port), timeout=timeout):
            return True
    except OSError:
        return False


def _http_get_raw(
    host: str, port: int, path: str, auth_header: str | None, timeout: float = 2.0
) -> tuple[int, bytes, str | None]:
    """GET HTTP básico. Devuelve (status, body, www_auth)."""
    try:
        url = f"http://{host}:{port}{path}"
        req = urllib.request.Request(url)
        if auth_header:
            req.add_header("Authorization", auth_header)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(), None
    except urllib.error.HTTPError as e:
        www = e.headers.get("WWW-Authenticate", "")
        return e.code, b"", www or None
    except Exception:
        return 0, b"", None


def _isapi_digest(host: str, port: int, path: str, user: str, pw: str) -> bytes | None:
    """Intenta snapshot ISAPI con Digest auth. Devuelve JPEG o None."""
    # Paso 1: obtener challenge
    status, _, www = _http_get_raw(host, port, path, None, timeout=2.0)
    if status == 200:
        return None  # sin auth — se maneja arriba
    if status != 401 or not www:
        return None
    if "digest" not in www.lower():
        return None
    # Extraer realm y nonce
    import re, hashlib, os as _os
    realm_m = re.search(r'realm="([^"]*)"', www, re.I)
    nonce_m = re.search(r'nonce="([^"]*)"', www, re.I)
    if not realm_m or not nonce_m:
        return None
    realm, nonce = realm_m.group(1), nonce_m.group(1)
    qop_m = re.search(r'qop="?([^",\s]*)"?', www, re.I)
    qop = qop_m.group(1) if qop_m else None
    ha1 = hashlib.md5(f"{user}:{realm}:{pw}".encode()).hexdigest()
    ha2 = hashlib.md5(f"GET:{path}".encode()).hexdigest()
    cnonce = _os.urandom(4).hex()
    nc = "00000001"
    if qop and "auth" in qop:
        resp = hashlib.md5(f"{ha1}:{nonce}:{nc}:{cnonce}:auth:{ha2}".encode()).hexdigest()
        auth = (f'Digest username="{user}", realm="{realm}", nonce="{nonce}", '
                f'uri="{path}", qop=auth, nc={nc}, cnonce="{cnonce}", response="{resp}"')
    else:
        resp = hashlib.md5(f"{ha1}:{nonce}:{ha2}".encode()).hexdigest()
        auth = (f'Digest username="{user}", realm="{realm}", nonce="{nonce}", '
                f'uri="{path}", response="{resp}"')
    status2, body2, _ = _http_get_raw(host, port, path, auth, timeout=3.0)
    return body2 if status2 == 200 and len(body2) > 500 else None


def _isapi_basic(host: str, port: int, path: str, user: str, pw: str) -> bytes | None:
    auth = "Basic " + base64.b64encode(f"{user}:{pw}".encode()).decode()
    status, body, _ = _http_get_raw(host, port, path, auth, timeout=2.0)
    return body if status == 200 and len(body) > 500 else None


def _identify_camera(ip: str, port: int, creds: list[dict]) -> dict[str, Any] | None:
    """Intenta identificar si un host es una cámara. Devuelve candidato o None."""
    hik_paths = [
        "/ISAPI/Streaming/channels/101/picture",
        "/ISAPI/Streaming/channels/102/picture",
    ]
    generic_paths = [
        "/cgi-bin/snapshot.cgi",
        "/snapshot.jpg",
        "/jpg/image.jpg",
        "/onvif/snapshot",
        "/tmpfs/snap.jpg",
    ]

    def build(brand, method, snap_path, body, cred_hint):
        user, pw = (cred_hint.split(":", 1) + [""])[:2] if cred_hint else ("", "")
        auth_part = f"{urllib.parse.quote(user, safe='')}:{urllib.parse.quote(pw, safe='')}@" if user else ""
        rtsp_path = {
            "hikvision": "/Streaming/Channels/101",
            "dahua": "/cam/realmonitor?channel=1&subtype=0",
        }.get(brand, "/stream1")
        rtsp_url = f"rtsp://{auth_part}{ip}:554{rtsp_path}"
        snap_url = f"http://{auth_part}{ip}{':' + str(port) if port != 80 else ''}{snap_path}"
        thumb = base64.b64encode(body).decode() if body and len(body) > 500 else None
        return {
            "ip": ip, "port": port, "brand": brand, "method": method,
            "rtspUrl": rtsp_url, "snapshotUrl": snap_url, "thumbnailB64": thumb,
        }

    # Hikvision ISAPI — solo detectar, NO probar credenciales (evita bloqueo)
    for path in hik_paths:
        status, body, www = _http_get_raw(ip, port, path, None, timeout=1.5)
        if status == 200 and len(body) > 500:
            return build("hikvision", "isapi_open", path, body, "")
        if status == 401:
            # Cámara confirmada — el usuario ingresa las credenciales en el UI
            return build("hikvision", "auth_needed", path, None, "")

    # Dahua / genérica — igual, solo detectar
    for path in generic_paths:
        status, body, www = _http_get_raw(ip, port, path, None, timeout=1.5)
        if status == 200 and len(body) > 500:
            return build("dahua", "http_open", path, body, "")
        if status == 401:
            return build("generic", "auth_needed", path, None, "")

    return None


def scan_network(
    subnet: str | None = None,
    creds: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Escanea la subred /24 buscando cámaras IP.
    Devuelve { subnet, scanned, found, durationMs }.
    """
    import urllib.parse
    t0 = time.time()
    net = subnet or _detect_subnet()
    default_creds = [
        {"user": "admin", "pass": "admin"},
        {"user": "admin", "pass": "12345"},
        {"user": "admin", "pass": "123456"},
        {"user": "admin", "pass": ""},
    ]
    use_creds = creds or default_creds
    ips = [f"{net}.{i}" for i in range(1, 255)]

    # TCP probe en paralelo (60 workers, timeout 600ms)
    alive: list[str] = []
    with ThreadPoolExecutor(max_workers=60) as ex:
        futures = {ex.submit(_tcp_probe, ip, 80, 0.6): ip for ip in ips}
        for fut in as_completed(futures):
            if fut.result():
                alive.append(futures[fut])

    # Identificar cámaras en paralelo
    found: list[dict] = []
    with ThreadPoolExecutor(max_workers=20) as ex:
        futures2 = {ex.submit(_identify_camera, ip, 80, use_creds): ip for ip in alive}
        for fut in as_completed(futures2):
            result = fut.result()
            if result:
                found.append(result)

    found.sort(key=lambda c: int(c["ip"].split(".")[-1]))
    return {
        "subnet": net,
        "scanned": len(ips),
        "found": found,
        "durationMs": int((time.time() - t0) * 1000),
    }


# ── Parseo del payload del facial chino ───────────────────────────────────────

def _extract_captured_image(payload: dict[str, Any]) -> str | None:
    """
    El facial manda la imagen capturada en distintos campos según modelo.
    Devuelve base64 puro (sin prefijo data:) o None.
    """
    for key in ("capturedImage", "captured_image", "faceImage", "face_image",
                "image", "Image", "img", "Img", "pic", "Pic"):
        val = payload.get(key) or (payload.get("info") or {}).get(key)
        if val and isinstance(val, str) and len(val) > 100:
            # Quitar prefijo data:image/...;base64, si viene
            if "," in val:
                val = val.split(",", 1)[1]
            return val
    return None


def _is_verify_push(payload: dict[str, Any]) -> bool:
    """True si es un VerifyPush con reconocimiento exitoso del facial chino."""
    if payload.get("operator") != "VerifyPush":
        return False
    info = payload.get("info")
    if not isinstance(info, dict):
        return False
    return info.get("VerifyStatus") == 1


def _person_label(payload: dict[str, Any]) -> str:
    info = payload.get("info") or {}
    name = info.get("Name") or info.get("PersonID") or "?"
    sim = info.get("Similarity1")
    return f"{name} ({sim}%)" if sim is not None else str(name)


# ── Handler HTTP ──────────────────────────────────────────────────────────────

class FacialHandler(BaseHTTPRequestHandler):
    dry_run: bool = False
    client: TurnstileClient | None = None
    api_url: str = ""
    api_email: str = ""
    api_password: str = ""
    access_point_id: str = ""
    ipcam_url: str = ""
    last_open_ts: float = 0.0
    cooldown_s: float = 8.0

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {self.address_string()} {fmt % args}")

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    def _save_log(self, path: str, body: bytes) -> None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe = path.strip("/").replace("/", "_") or "root"
        out = LOG_DIR / f"{ts}_{safe}.json"
        out.write_bytes(body)
        print(f"  guardado: {out.name}")

    def _authorized(self) -> bool:
        expected = (getattr(self, "webhook_token", None) or "").strip()
        allow = getattr(self, "allow_ips", None) or []
        if expected:
            got = (self.headers.get("X-Webhook-Token") or self.headers.get("Authorization") or "").strip()
            if got.lower().startswith("bearer "):
                got = got[7:].strip()
            if got != expected:
                return False
        if allow:
            peer = self.client_address[0] if self.client_address else ""
            if peer not in allow and peer not in ("127.0.0.1", "::1"):
                return False
        return True

    def _handle_post(self) -> None:
        if not self._authorized():
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":false,"error":"unauthorized"}')
            print("  REJECTED: webhook no autorizado")
            return

        body = self._read_body()
        path = self.path
        print(f"\n>>> POST {path} ({len(body)} bytes)")

        payload: dict[str, Any] = {}
        if body:
            try:
                payload = json.loads(body.decode("utf-8", errors="replace"))
                safe = dict(payload)
                # Nunca volcar imágenes / bases64 al log
                for k in list(safe.keys()):
                    if "image" in k.lower() or "photo" in k.lower() or "picture" in k.lower():
                        safe[k] = f"<{type(safe[k]).__name__} redacted>"
                info = safe.get("info")
                if isinstance(info, dict):
                    info = dict(info)
                    for k in list(info.keys()):
                        if "image" in k.lower() or "photo" in k.lower() or "picture" in k.lower() or "base64" in k.lower():
                            info[k] = "<redacted>"
                    safe["info"] = info
                print(json.dumps(safe, ensure_ascii=False, indent=2)[:1500])
            except json.JSONDecodeError:
                print("(body no-json, no se imprime)")
        # Log metadatos sin imagen
        try:
            meta = {"path": path, "bytes": len(body), "operator": payload.get("operator")}
            self._save_log(path, json.dumps(meta).encode("utf-8"))
        except Exception:
            pass

        # ── Heartbeat ──────────────────────────────────────────────────
        if "/heartbeat" in path.lower() or payload.get("operator") == "HeartBeat":
            print("  (heartbeat)")
            self._respond_ok()
            return

        # ── VerifyPush: el facial detectó una cara conocida ────────────
        if not _is_verify_push(payload):
            print("  (evento ignorado, no es VerifyPush exitoso)")
            self._respond_ok()
            return

        label = _person_label(payload)
        print(f"  => VerifyPush del facial: {label}")
        print("  => delegando decisión al backend access (Qdrant)...")

        # Obtener imagen: primero la del payload, luego snapshot de IP cam
        image_b64 = _extract_captured_image(payload)
        if image_b64:
            print(f"  [imagen] usando foto capturada del payload ({len(image_b64)} chars b64)")
        elif self.ipcam_url:
            print(f"  [imagen] capturando snapshot de {self.ipcam_url}")
            image_b64 = _capture_from_ipcam(self.ipcam_url)
        else:
            print("  [imagen] sin imagen y sin IP_CAM_URL configurado — no se puede reconocer")

        if not image_b64:
            print("  ERROR: sin imagen para reconocer. Configura w/captured image en el facial")
            print("         o define IP_CAM_URL en el .env")
            self._respond_ok()
            return

        # ── Llamar al backend access ───────────────────────────────────
        if self.dry_run:
            print("  [dry-run] llamaría POST /recognize-image → sin torniquete")
            self._respond_ok()
            return

        if not self.access_point_id:
            print("  ERROR: ACCESS_POINT_ID no configurado en .env")
            self._respond_ok()
            return

        try:
            result = _recognize_and_decide(
                self.api_url,
                self.api_email,
                self.api_password,
                self.access_point_id,
                image_b64,
            )
        except urllib.error.HTTPError as exc:
            body_err = exc.read().decode("utf-8", errors="replace")
            print(f"  ERROR access API {exc.code}: {body_err[:300]}")
            self._respond_ok()
            return
        except Exception as exc:
            print(f"  ERROR access API: {exc}")
            self._respond_ok()
            return

        decision = result.get("decision")
        reason = result.get("reason")
        subject_name = result.get("subjectName") or "(desconocido)"
        match_score = result.get("matchScore", 0)
        liveness = result.get("livenessScore", 0)
        door_actuated = result.get("doorActuated", False)

        print(f"  access => decision={decision} reason={reason}")
        print(f"           subject={subject_name} match={match_score:.2f} liveness={liveness:.2f}")

        if decision == "GRANTED":
            print(f"  ACCESO CONCEDIDO: {subject_name}")
            if door_actuated:
                print("  (access ya actuó la puerta directamente)")
            else:
                # access no pudo actuar (relay no configurado en el backend)
                # → abrimos nosotros por ESP32
                now = time.time()
                if now - self.last_open_ts >= self.cooldown_s:
                    if self.client:
                        try:
                            open_result = self.client.open()
                            self.last_open_ts = now
                            print(f"  Torniquete ESP32: {open_result}")
                        except Exception as exc:
                            print(f"  ERROR torniquete: {exc}")
                    else:
                        print("  (sin cliente torniquete)")
                else:
                    print("  (cooldown, no re-abrir)")
        else:
            print(f"  ACCESO DENEGADO: {subject_name} — {reason}")

        self._respond_ok()

    def _respond_ok(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"result":1,"success":true}')

    def do_POST(self) -> None:
        self._handle_post()

    def do_GET(self) -> None:
        print(f"\n>>> GET {self.path}")

        # ── /scan  → descubre cámaras en la red local ──────────────────
        if self.path.startswith("/scan"):
            # Parsear ?subnet=192.168.100 si viene
            subnet = None
            if "?" in self.path:
                qs = self.path.split("?", 1)[1]
                for part in qs.split("&"):
                    if part.startswith("subnet="):
                        subnet = part[7:]
            print(f"  [scan] iniciando escaneo subnet={subnet or 'auto'}…")
            try:
                result = scan_network(subnet=subnet)
                print(f"  [scan] {result['found'].__len__()} cámaras en {result['durationMs']}ms")
            except Exception as exc:
                result = {"error": str(exc)}
            body = json.dumps(result, ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"facial_webhook ok\n")


# ── Main ──────────────────────────────────────────────────────────────────────

def _env(key: str, default: str = "") -> str:
    import os
    return os.environ.get(key, default).strip()


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Webhook facial → access → torniquete")
    default_host = _env("FACIAL_WEBHOOK_HOST", "127.0.0.1")
    parser.add_argument("--host", default=default_host)
    parser.add_argument("--port", type=int, default=int(_env("FACIAL_WEBHOOK_PORT", "8787") or "8787"))
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo log, no llama al backend ni abre torniquete",
    )
    args = parser.parse_args()

    api_url      = _env("ACCESS_API_URL",      "http://localhost:3000")
    api_email    = _env("ACCESS_API_EMAIL",     "")
    api_password = _env("ACCESS_API_PASSWORD",  "")
    ap_id        = _env("ACCESS_POINT_ID",      "")
    ipcam_url    = _env("IP_CAM_URL",           "")

    webhook_token = _env("FACIAL_WEBHOOK_TOKEN", "")
    allow_raw = _env("FACIAL_WEBHOOK_ALLOW_IPS", "")
    allow_ips = [x.strip() for x in allow_raw.split(",") if x.strip()]
    if not webhook_token and not allow_ips:
        print("AVISO: configura FACIAL_WEBHOOK_TOKEN y/o FACIAL_WEBHOOK_ALLOW_IPS")

    FacialHandler.dry_run        = args.dry_run
    FacialHandler.api_url        = api_url
    FacialHandler.api_email      = api_email
    FacialHandler.api_password   = api_password
    FacialHandler.access_point_id = ap_id
    FacialHandler.ipcam_url      = ipcam_url
    FacialHandler.webhook_token  = webhook_token
    FacialHandler.allow_ips      = allow_ips
    FacialHandler.client         = None if args.dry_run else TurnstileClient.from_env()

    server = ThreadingHTTPServer((args.host, args.port), FacialHandler)

    print("=" * 65)
    print("FACIAL WEBHOOK  →  ACCESS API  →  TORNIQUETE")
    print(f"Escuchando       http://{args.host}:{args.port}")
    print(f"Facial debe POST a  Server Address: <IP de este PC>  Port: {args.port}")
    print(f"Access API       {api_url}")
    print(f"Access Point ID  {ap_id or '*** FALTA ACCESS_POINT_ID en .env ***'}")
    print(f"IP Cam URL       {ipcam_url or '(no configurada — usar w/captured image)'}")
    if args.dry_run:
        print("MODO dry-run: solo log, no abre torniquete ni llama al backend")
    print("=" * 65)
    print()
    print("Configura el facial:")
    print("  HTTP Subscription → Subscribe → w/captured image")
    print("  Heartbeat URL: /Subscribe/heartbeat  Interval: 30")
    print()

    if not ap_id and not args.dry_run:
        print("AVISO: ACCESS_POINT_ID vacío. Obtén el UUID del torniquete:")
        print(f"  GET {api_url}/api/v1/access/points  (requiere login)")
        print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nDetenido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
