"""Puente local del torniquete.

Ve el ESP32 por USB, instala el firmware y le graba la red.
Escucha el aviso que el chip manda por la red cuando cambia de IP.
No abre el torniquete.
"""

from __future__ import annotations

import json
import os
import secrets
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import serial
from serial.tools import list_ports

ROOT = Path(__file__).resolve().parents[1]
SKETCH = ROOT / "esp32_torniquete_api"
FQBN = "esp32:esp32:esp32"
CLI = os.environ.get("ARDUINO_CLI", r"C:\Program Files\Arduino CLI\arduino-cli.exe")
ESPTOOL = os.environ.get(
    "ESPTOOL",
    r"C:\Users\Hide\AppData\Local\Arduino15\packages\esp32\tools\esptool_py\5.3.1\esptool.exe",
)
BOOT_APP0 = os.environ.get(
    "ESP_BOOT_APP0",
    r"C:\Users\Hide\AppData\Local\Arduino15\packages\esp32\hardware\esp32\3.3.11\tools\partitions\boot_app0.bin",
)
BUILD = SKETCH / "build"
HOST = os.environ.get("ESP_AGENT_HOST", "127.0.0.1")
PORT = int(os.environ.get("ESP_AGENT_PORT", "3190"))
BEACON_PORT = 42100
AGENT_KEY = os.environ.get("ESP_AGENT_KEY", "").strip()
CORS_ORIGIN = os.environ.get("ESP_AGENT_CORS_ORIGIN", "http://127.0.0.1:3100").strip()

heard: dict[str, dict] = {}
heard_lock = threading.Lock()
usb_lock = threading.Lock()


def load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def agent_key() -> str:
    return os.environ.get("ESP_AGENT_KEY", "")


def clean(value: str, limit: int = 64) -> str:
    text = (value or "").strip()
    if any(ch in text for ch in "\"\\"):
        raise ValueError("sin comillas")
    if len(text) > limit:
        raise ValueError("demasiado largo")
    return text


def ports() -> list[dict]:
    rows = []
    for p in list_ports.comports():
        rows.append({
            "port": p.device,
            "name": p.description or p.device,
            "usb": "CH340" in (p.description or "") or "CP210" in (p.description or "") or "USB" in (p.description or "").upper(),
        })
    return rows


def read_lines(ser: serial.Serial, seconds: float, needle: str = "") -> list[str]:
    end = time.time() + seconds
    buf = ""
    lines: list[str] = []
    while time.time() < end:
        chunk = ser.read(256)
        if not chunk:
            continue
        buf += chunk.decode("utf-8", "replace")
        while "\n" in buf:
            line, buf = buf.split("\n", 1)
            line = line.strip()
            if not line:
                continue
            lines.append(line)
            if needle and needle in line:
                return lines
    return lines


def parse_events(lines: list[str]) -> list[dict]:
    out = []
    for line in lines:
        if not line.startswith("{"):
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return out


def open_serial(port: str) -> serial.Serial:
    return serial.Serial(port, 115200, timeout=0.2)


def serial_status(port: str) -> dict:
    with usb_lock:
        with open_serial(port) as ser:
            # Abrir el puerto reinicia el chip. Hay que esperar a que arranque.
            read_lines(ser, 14, '"evt":"ready"')
            ser.reset_input_buffer()
            ser.write(b'{"cmd":"status"}\n')
            events = parse_events(read_lines(ser, 4))
    for ev in events:
        if ev.get("evt") == "ready" or ev.get("id"):
            return {"ok": True, "device": ev}
    return {"ok": False, "error": "sin_respuesta", "raw": events[-3:]}


def wifi_nets(event: dict) -> list[dict]:
    nets = []
    seen = set()
    for item in event.get("nets") or []:
        if isinstance(item, str):
            ssid, rssi = item, None
        elif isinstance(item, dict):
            ssid, rssi = str(item.get("ssid") or ""), item.get("rssi")
        else:
            continue
        if not ssid or ssid in seen:
            continue
        seen.add(ssid)
        nets.append({"ssid": ssid, "rssi": rssi})
    nets.sort(key=lambda n: n["rssi"] if isinstance(n["rssi"], (int, float)) else -999, reverse=True)
    return nets


def serial_wifi(port: str) -> dict:
    with usb_lock:
        with open_serial(port) as ser:
            # Abrir el COM reinicia el chip. Si se pide el escaneo durante el
            # arranque, la radio responde con la lista vacía.
            read_lines(ser, 14, '"evt":"ready"')
            found = None
            for _ in range(2):
                ser.reset_input_buffer()
                ser.write(b'{"cmd":"wifi"}\n')
                events = parse_events(read_lines(ser, 22, '"evt":"wifi"'))
                found = next((ev for ev in events if ev.get("evt") == "wifi"), None)
                if found and wifi_nets(found):
                    break
                time.sleep(1.2)
    if not found:
        return {"ok": False, "error": "sin_redes"}
    return {"ok": True, "nets": wifi_nets(found), "scan": found.get("n")}


def serial_try(port: str, ssid: str, password: str) -> dict:
    body = json.dumps(
        {"cmd": "try", "ssid": ssid, "pass": password},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    with usb_lock:
        with open_serial(port) as ser:
            # Opening COM resets the chip. Wait until it is listening, then test.
            read_lines(ser, 14, '"evt":"ready"')
            ser.reset_input_buffer()
            ser.write(body.encode("utf-8") + b"\n")
            events = parse_events(read_lines(ser, 18, '"evt":"try"'))
    found = next((ev for ev in events if ev.get("evt") == "try"), None)
    if not found:
        return {"ok": False, "error": "sin_respuesta"}
    return {"ok": True, "result": found.get("result") or "", "ip": found.get("ip") or ""}


def serial_provision(port: str, ssid: str, password: str, name: str, token: str) -> dict:
    body = json.dumps({
        "cmd": "provision",
        "ssid": ssid,
        "pass": password,
        "name": name,
        "token": token,
        "server": gym_base(),
    }, ensure_ascii=False, separators=(",", ":"))
    with usb_lock:
        with open_serial(port) as ser:
            read_lines(ser, 14, '"evt":"ready"')
            ser.reset_input_buffer()
            ser.write(body.encode("utf-8") + b"\n")
            events = parse_events(read_lines(ser, 8, '"evt":"saved"'))
            saved = next((ev for ev in events if ev.get("evt") == "saved"), None)
            if not saved:
                return {"ok": False, "error": "no_guardo", "events": events[-4:]}
            time.sleep(1.2)
            ser.reset_input_buffer()
            boot = parse_events(read_lines(ser, 18))
    ready = next((ev for ev in reversed(boot) if ev.get("evt") == "ready"), None)
    return {"ok": True, "saved": saved, "ready": ready}


def run_quiet(args: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    # pythonw no tiene consola: sin esta bandera Windows abre un CMD vacío.
    flags = 0x08000000 if os.name == "nt" else 0
    return subprocess.run(
        args,
        capture_output=True,
        text=True,
        timeout=timeout,
        creationflags=flags,
    )


def ask_download(port: str) -> bool:
    """El sistema 5.1 pide el modo de programación solo. Cerrar el puerto no debe reiniciar."""
    try:
        ser = open_serial(port)
    except serial.SerialException:
        return False
    try:
        ser.dtr = False
        ser.rts = False
        # Si ya está en marcha, responde al momento. Si acaba de reiniciarse,
        # la orden queda en el cable y se repite cuando termina de arrancar.
        ser.write(b'{"cmd":"download"}\n')
        lines = read_lines(ser, 4, '"download"')
        if any('"download"' in line for line in lines):
            return True
        read_lines(ser, 14, '"evt":"ready"')
        ser.write(b'{"cmd":"download"}\n')
        lines = read_lines(ser, 4, '"download"')
        return any('"download"' in line for line in lines)
    except (serial.SerialException, OSError):
        return False
    finally:
        try:
            ser.dtr = False
            ser.rts = False
            time.sleep(0.05)
            ser.close()
        except (serial.SerialException, OSError):
            pass


def upload_bins(port: str, before: str, attempts: int = 7) -> subprocess.CompletedProcess[str]:
    app = BUILD / "esp32_torniquete_api.ino.bin"
    boot = BUILD / "esp32_torniquete_api.ino.bootloader.bin"
    part = BUILD / "esp32_torniquete_api.ino.partitions.bin"
    return run_quiet([
        ESPTOOL, "--chip", "esp32", "--port", port, "--baud", "460800",
        "--before", before, "--after", "hard-reset",
        "--connect-attempts", str(attempts),
        "write-flash", "-z", "--flash-mode", "dio", "--flash-freq", "40m", "--flash-size", "detect",
        "0x1000", str(boot),
        "0x8000", str(part),
        "0xe000", BOOT_APP0,
        "0x10000", str(app),
    ], 180)


def read_ready(port: str) -> dict:
    time.sleep(1.5)
    with open_serial(port) as ser:
        events = parse_events(read_lines(ser, 16))
    ready = next((ev for ev in reversed(events) if ev.get("evt") == "ready"), None)
    return {"ok": True, "ready": ready}


def upload_failed(upload: subprocess.CompletedProcess[str]) -> dict | None:
    if upload.returncode == 0:
        return None
    tail = (upload.stderr or upload.stdout or "")[-800:]
    if "Wrong boot mode" in tail or "download mode" in tail or "Failed to connect" in tail:
        return {"ok": False, "error": "boot", "needBoot": True}
    return {"ok": False, "error": "upload", "detail": tail}


def flash(port: str, stage: str = "all") -> dict:
    with usb_lock:
        if stage != "send":
            compile_run = run_quiet(
                [CLI, "compile", "--fqbn", FQBN, "--output-dir", str(BUILD), str(SKETCH)],
                300,
            )
            if compile_run.returncode != 0:
                tail = (compile_run.stderr or compile_run.stdout or "")[-800:]
                return {"ok": False, "error": "compile", "detail": tail}
            asked = ask_download(port)
            upload = upload_bins(port, "no-reset", 8 if asked else 3)
            if not upload_failed(upload):
                return read_ready(port)
            if stage == "prepare":
                return {"ok": True, "needBoot": True}
        upload = upload_bins(port, "no-reset", 40)
        failed = upload_failed(upload)
        if failed:
            failed["detail"] = "No entró a programación. Mantén BOOT, pulsa EN y suelta EN sin soltar BOOT, y al final suelta BOOT."
            return failed
        return read_ready(port)


def gym_base() -> str:
    return (os.environ.get("GYM_API_BASE") or "https://gym.198-199-82-161.sslip.io").rstrip("/")


def agent_call(path: str, method: str = "GET", payload: dict | None = None, timeout: float = 25) -> dict | None:
    key = agent_key()
    if not key:
        return None
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        gym_base() + path,
        data=data,
        headers={"Content-Type": "application/json", "x-esp-agent": key},
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError):
        return None


def post_heartbeat(payload: dict) -> None:
    agent_call("/api/turnstiles/heartbeat", "POST", payload, 4)


def pulse_device(ip: str, token: str) -> bool:
    req = urllib.request.Request(
        f"http://{ip}/api/open",
        data=b"{}",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as res:
            return 200 <= res.status < 300
    except urllib.error.HTTPError as exc:
        return 200 <= exc.code < 300
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def job_loop() -> None:
    while True:
        job = agent_call("/api/turnstiles/jobs", "GET", None, 30)
        if not job or not job.get("job"):
            time.sleep(1)
            continue
        item = job["job"]
        ip = str(item.get("ip") or "")
        token = str(item.get("token") or "")
        job_id = str(item.get("id") or "")
        ok = bool(ip and token) and pulse_device(ip, token)
        agent_call("/api/turnstiles/jobs", "POST", {"id": job_id, "ok": ok}, 4)


def beacon_loop() -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind(("", BEACON_PORT))
    except OSError:
        return
    sock.settimeout(2)
    last_post: dict[str, float] = {}
    while True:
        try:
            data, _addr = sock.recvfrom(1024)
        except socket.timeout:
            continue
        except OSError:
            return
        try:
            msg = json.loads(data.decode("utf-8", "replace"))
        except json.JSONDecodeError:
            continue
        device_id = str(msg.get("id") or "")
        ip = str(msg.get("ip") or "")
        if len(device_id) < 8 or not ip:
            continue
        row = {
            "id": device_id,
            "name": str(msg.get("name") or "Torniquete"),
            "ip": ip,
            "fw": str(msg.get("fw") or ""),
            "rssi": msg.get("rssi"),
        }
        with heard_lock:
            heard[device_id] = {**row, "lastSeen": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
        now = time.time()
        if now - last_post.get(device_id, 0) > 15:
            last_post[device_id] = now
            post_heartbeat(row)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        return

    def _cors(self) -> None:
        # Origen restringido. El panel en LAN/cloud debe listarse en ESP_AGENT_CORS_ORIGIN
        # (lista separada por comas). Private Network Access sigue habilitado.
        origin = CORS_ORIGIN.split(",")[0].strip() or "http://127.0.0.1:3100"
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Agent-Key")
        self.send_header("Vary", "Origin")

    def _send(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


    def _authorized(self) -> bool:
        if not AGENT_KEY:
            # Sin clave configurada solo se permite health en loopback.
            return False
        got = (self.headers.get("X-Agent-Key") or self.headers.get("Authorization") or "").strip()
        if got.lower().startswith("bearer "):
            got = got[7:].strip()
        return got == AGENT_KEY

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:
        url = urlparse(self.path)
        if url.path == "/health":
            self._send(200, {"ok": True, "fw": "5.1.0", "auth": bool(AGENT_KEY)})
            return
        if not self._authorized():
            self._send(401, {"ok": False, "error": "unauthorized"})
            return
        if url.path == "/ports":
            self._send(200, {"ok": True, "ports": ports()})
            return
        if url.path == "/seen":
            with heard_lock:
                rows = list(heard.values())
            self._send(200, {"ok": True, "devices": rows})
            return
        self._send(404, {"ok": False})

    def do_POST(self) -> None:
        if not self._authorized():
            self._send(401, {"ok": False, "error": "unauthorized"})
            return
        url = urlparse(self.path)
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._send(400, {"ok": False, "error": "json"})
            return
        port = str(body.get("port") or "")
        try:
            if url.path == "/status":
                self._send(200, serial_status(port))
            elif url.path == "/wifi":
                self._send(200, serial_wifi(port))
            elif url.path == "/try":
                ssid = clean(str(body.get("ssid") or ""), 32)
                password = clean(str(body.get("password") or ""), 64)
                if len(ssid) < 1:
                    raise ValueError("ssid")
                self._send(200, serial_try(port, ssid, password))
            elif url.path == "/flash":
                stage = str(body.get("stage") or "all")
                if stage not in ("prepare", "send", "all"):
                    stage = "all"
                self._send(200, flash(port, stage))
            elif url.path == "/provision":
                ssid = clean(str(body.get("ssid") or ""), 32)
                password = clean(str(body.get("password") or ""), 64)
                name = clean(str(body.get("name") or "Torniquete"), 40) or "Torniquete"
                token = clean(str(body.get("token") or secrets.token_hex(16)), 80)
                if len(ssid) < 1:
                    raise ValueError("ssid")
                self._send(200, serial_provision(port, ssid, password, name, token))
            else:
                self._send(404, {"ok": False})
        except ValueError as exc:
            self._send(400, {"ok": False, "error": str(exc)})
        except serial.SerialException as exc:
            self._send(400, {"ok": False, "error": "puerto", "detail": str(exc)})
        except subprocess.TimeoutExpired:
            self._send(500, {"ok": False, "error": "timeout"})
        except Exception as exc:
            self._send(500, {"ok": False, "error": "fallo", "detail": str(exc)})


def main() -> None:
    load_env()
    global HOST, PORT, AGENT_KEY, CORS_ORIGIN
    HOST = os.environ.get("ESP_AGENT_HOST", HOST)
    PORT = int(os.environ.get("ESP_AGENT_PORT", str(PORT)))
    AGENT_KEY = os.environ.get("ESP_AGENT_KEY", AGENT_KEY).strip()
    CORS_ORIGIN = os.environ.get("ESP_AGENT_CORS_ORIGIN", CORS_ORIGIN).strip()
    if not AGENT_KEY:
        print("AVISO: ESP_AGENT_KEY vacío — endpoints (salvo /health) rechazarán llamadas", flush=True)
    threading.Thread(target=beacon_loop, daemon=True).start()
    threading.Thread(target=job_loop, daemon=True).start()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"puente torniquete en http://{HOST}:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
