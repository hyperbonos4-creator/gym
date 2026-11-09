"""Fingerprint del facial chino (192.168.100.200): puertos, HTTP y panel web.

Objetivo: descubrir si expone una API de enrolamiento (AddPerson) para usarlo
como kiosko principal en vez de comprar tablets.

Uso:
  python probe_facial_api.py            # escaneo completo
  python probe_facial_api.py --ports    # solo puertos
"""

from __future__ import annotations

import argparse
import base64
import socket
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

HOST = "192.168.100.200"
OUT_DIR = Path(__file__).resolve().parent / "facial_probe"

# Puertos típicos de estos terminales + servicios de red habituales
PORTS = sorted({
    21, 22, 23, 53, 80, 81, 88, 443, 554, 843, 1935, 3000, 3306, 4370, 5000,
    5432, 5555, 6000, 7000, 7070, 8000, 8001, 8008, 8080, 8081, 8086, 8090,
    8091, 8098, 8099, 8100, 8181, 8200, 8443, 8554, 8800, 8888, 9000,
    9090, 9999, 10000, 37777, 34567, 49152,
})

CREDS = [("admin", "admin"), ("admin", "123456"), ("admin", ""), ("admin", "12345")]

# Rutas candidatas de API de estos terminales (SDK "cara" chino / Sonoff-like)
API_PATHS = [
    "/",
    "/index.html",
    "/login.html",
    "/doc.html",
    "/api",
    "/api/version",
    "/cgi-bin/",
    "/SDK/webLogin",
    "/Person/count",
    "/action/AddPerson",
    "/action/QueryPerson",
    "/action/GetDeviceInfo",
    "/deviceInfo",
    "/system/deviceInfo",
]


def scan_port(port: int, timeout: float = 1.2) -> int | None:
    try:
        with socket.create_connection((HOST, port), timeout=timeout):
            return port
    except OSError:
        return None


def http_get(port: int, path: str, auth: tuple[str, str] | None = None,
             timeout: float = 4.0) -> tuple[int, bytes, dict]:
    scheme = "https" if port in (443, 8443) else "http"
    url = f"{scheme}://{HOST}:{port}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "gym-probe/1.0"})
    if auth:
        token = base64.b64encode(f"{auth[0]}:{auth[1]}".encode()).decode()
        req.add_header("Authorization", "Basic " + token)
    try:
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.status, r.read(65536), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(4096), dict(e.headers)
    except Exception as exc:  # noqa: BLE001
        return 0, str(exc).encode(), {}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ports", action="store_true", help="Solo escanear puertos")
    args = parser.parse_args()

    OUT_DIR.mkdir(exist_ok=True)
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # consola Windows cp1252
    except Exception:  # noqa: BLE001
        pass
    print(f"=== Fingerprint facial {HOST} ===\n")

    print("[1] Escaneo de puertos…")
    open_ports: list[int] = []
    with ThreadPoolExecutor(max_workers=40) as ex:
        futures = {ex.submit(scan_port, p): p for p in PORTS}
        for fut in as_completed(futures):
            p = fut.result()
            if p:
                open_ports.append(p)
    open_ports.sort()
    print(f"    Puertos abiertos: {open_ports or 'ninguno'}\n")

    if args.ports:
        return 0

    print("[2] Fingerprint HTTP de cada puerto web…")
    web_ports = [p for p in open_ports if p in
                 (80, 81, 88, 443, 8000, 8080, 8081, 8090, 8443, 8888, 9000)]
    if not web_ports and open_ports:
        web_ports = open_ports  # probar todos si no hay obvios

    for port in web_ports:
        print(f"\n  --- puerto {port} ---")
        status, body, headers = http_get(port, "/")
        server = headers.get("Server", "?")
        print(f"    GET /  → {status}  Server={server}  bytes={len(body)}")
        # Guardar la home para inspección
        if body:
            fn = OUT_DIR / f"port{port}_root.html"
            fn.write_bytes(body)
            # Buscar referencias a JS de la app (ahí vive la API real)
            text = body.decode("utf-8", errors="replace")
            scripts = set(_find_assets(text))
            if scripts:
                print(f"    assets JS/CSS referenciados:")
                for s in sorted(scripts)[:20]:
                    print(f"      {s}")

        print(f"    Probando rutas de API conocidas (auth admin/admin)…")
        for path in API_PATHS:
            st, bd, _ = http_get(port, path, auth=("admin", "admin"), timeout=3.0)
            if st and st not in (404, 0):
                snippet = bd[:80].decode("utf-8", errors="replace").replace("\n", " ")
                print(f"      {st:>3} {path:<28} {snippet}")

    print(f"\nArchivos guardados en: {OUT_DIR}")
    print("Revisa los .html y los assets JS para hallar la API de enrolamiento.")
    return 0


def _find_assets(html: str) -> list[str]:
    import re
    out: list[str] = []
    out += re.findall(r'src=["\']([^"\']+\.js[^"\']*)["\']', html, re.I)
    out += re.findall(r'href=["\']([^"\']+\.(?:js|css)[^"\']*)["\']', html, re.I)
    return out


if __name__ == "__main__":
    raise SystemExit(main())
