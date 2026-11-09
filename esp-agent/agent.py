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
HOST = "127.0.0.1"
PORT = 3190
BEACON_PORT = 42100

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
            time.sleep(0.4)
            ser.reset_input_buffer()
            ser.write(b'{"cmd":"status"}\n')
            events = parse_events(read_lines(ser, 3))
    for ev in events:
        if ev.get("evt") == "ready" or ev.get("id"):
            return {"ok": True, "device": ev}
    return {"ok": False, "error": "sin_respuesta", "raw": events[-3:]}


def serial_wifi(port: str) -> dict:
    with usb_lock:
        with open_serial(port) as ser:
            time.sleep(0.3)
            ser.reset_input_buffer()
            ser.write(b'{"cmd":"wifi"}\n')
            events = parse_events(read_lines(ser, 12))
    for ev in events:
        if ev.get("evt") == "wifi":
            nets = []
            seen = set()
            for item in ev.get("nets") or []:
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
            return {"ok": True, "nets": nets}
    return {"ok": False, "error": "sin_redes"}


def serial_try(port: str, ssid: str, password: str) -> dict:
    body = json.dumps(
        {"cmd": "try", "ssid": ssid, "pass": password},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    with usb_lock:
        with open_serial(port) as ser:
            # Opening COM resets the chip. Wait until it is listening, then test.
            read_lines(ser, 3, '"evt":"ready"')
            ser.reset_input_buffer()
            ser.write(body.encode("utf-8") + b"\n")
            events = parse_events(read_lines(ser, 16, '"evt":"try"'))
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
    }, ensure_ascii=False, separators=(",", ":"))
    with usb_lock:
        with open_serial(port) as ser:
            read_lines(ser, 3, '"evt":"ready"')
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


def flash(port: str) -> dict:
    with usb_lock:
        compile_run = subprocess.run(
            [CLI, "compile", "--fqbn", FQBN, str(SKETCH)],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if compile_run.returncode != 0:
            tail = (compile_run.stderr or compile_run.stdout or "")[-800:]
            return {"ok": False, "error": "compile", "detail": tail}
        upload = subprocess.run(
            [CLI, "upload", "-p", port, "--fqbn", FQBN, str(SKETCH)],
            capture_output=True,
            text=True,
            timeout=180,
        )
        if upload.returncode != 0:
            tail = (upload.stderr or upload.stdout or "")[-800:]
            return {"ok": False, "error": "upload", "detail": tail}
        time.sleep(1.5)
        with open_serial(port) as ser:
            events = parse_events(read_lines(ser, 16))
    ready = next((ev for ev in reversed(events) if ev.get("evt") == "ready"), None)
    return {"ok": True, "ready": ready}


def post_heartbeat(payload: dict) -> None:
    key = agent_key()
    if not key:
        return
    req = urllib.request.Request(
        "http://127.0.0.1:3100/api/turnstiles/heartbeat",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-esp-agent": key},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=2).read()
    except (urllib.error.URLError, TimeoutError, OSError):
        return


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

    def _send(self, code: int, payload: dict) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        url = urlparse(self.path)
        if url.path == "/health":
            self._send(200, {"ok": True, "fw": "5.0.0"})
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
                self._send(200, flash(port))
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
    threading.Thread(target=beacon_loop, daemon=True).start()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"puente torniquete en http://{HOST}:{PORT}", flush=True)
    httpd.serve_forever()


if __name__ == "__main__":
    main()
