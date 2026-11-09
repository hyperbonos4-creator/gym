"""Configura access point + camara del gym via API (tras docker compose up)."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())


def api(method: str, url: str, token: str | None = None, body: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def login(base: str, email: str, password: str) -> str:
    out = api("POST", f"{base}/api/v1/auth/login", body={"email": email, "password": password})
    return out["accessToken"]


def main() -> int:
    load_env(ROOT / ".env")
    load_env(ROOT / "gym.env.example")

    base = os.getenv("ACCESS_URL", "http://localhost:3010")
    email = os.getenv("ACCESS_ADMIN", "admin@office.local")
    password = os.getenv("ACCESS_ADMIN_PASS", "ChangeMe123!")
    camera_url = os.getenv(
        "FACIAL_CAMERA_URL",
        f"http://{os.getenv('FACIAL_USER', 'admin')}:{os.getenv('FACIAL_PASS', 'admin')}"
        f"@{os.getenv('FACIAL_HOST', '192.168.100.200')}/",
    )
    controller_ref = os.getenv(
        "TORNIQUETE_CONTROLLER_REF",
        "POST http://192.168.100.119/api/open|||Authorization: Bearer gym-secret-token",
    )

    print(f"Login {base} ...")
    try:
        token = login(base, email, password)
    except urllib.error.URLError as exc:
        print(f"ERROR: access no responde en {base}. Ejecuta: cd access && docker compose up -d --build")
        print(exc)
        return 1

    print("Creando camara facial ...")
    cam = api(
        "POST",
        f"{base}/api/v1/cameras",
        token,
        {"name": "Facial torniquete", "rtspUrl": camera_url, "externalKey": "facial-gym-1"},
    )
    cam_id = cam.get("id")
    print(f"  camera id={cam_id}")

    print("Creando access point torniquete ingreso ...")
    ap = api(
        "POST",
        f"{base}/api/v1/access/points",
        token,
        {
            "name": "Torniquete ingreso gym",
            "locationLabel": "Entrada principal",
            "status": "ACTIVE",
            "controllerKind": "HTTP",
            "controllerRef": controller_ref,
            "cameraId": cam_id,
            "matchThreshold": 0.5,
            "livenessThreshold": 0.6,
            "securityLevel": "NORMAL",
            "accessMode": "FACE",
        },
    )
    print(json.dumps(ap, ensure_ascii=False, indent=2))
    print(f"\nKiosk ingreso: {base}/kiosk/?point={ap.get('id')}")
    print(f"Enrolamiento:  {base}/kiosk/enroll.html")
    print(f"Admin:         {base}/admin.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
