"""Configura access para el gym: punto de acceso + torniquete ESP32."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "http://localhost:3010/api/v1"
ADMIN_EMAIL = os.environ.get("ACCESS_ADMIN_EMAIL", "")
ADMIN_PASSWORD = os.environ.get("ACCESS_ADMIN_PASS", "")
POINT_NAME = "Torniquete Gym"
CAMERA_NAME = "Facial Chino"
FACIAL_IP = "192.168.100.200"
TORNIQUETE_HOST = os.environ.get("TORNIQUETE_HOST", "")
TORNIQUETE_TOKEN = os.environ.get("TORNIQUETE_TOKEN", "")
CONTROLLER_REF = (
    f"POST http://{TORNIQUETE_HOST}/api/open"
    f"|||Authorization: Bearer {TORNIQUETE_TOKEN}"
)


def req(method: str, path: str, token: str | None = None, body: dict | None = None) -> dict:
    url = f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, data=data, method=method, headers=headers)
    with urllib.request.urlopen(request, timeout=30) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else {}


def wait_backend(max_s: int = 180) -> None:
    print("Esperando backend access...")
    for i in range(max_s):
        try:
            with urllib.request.urlopen(f"{API}/auth/login", timeout=2) as resp:
                if resp.status in (400, 401, 405):
                    print("Backend online.")
                    return
        except urllib.error.HTTPError as exc:
            if exc.code in (400, 401, 405):
                print("Backend online.")
                return
        except urllib.error.URLError:
            pass
        if i % 10 == 0:
            print(f"  ... {i}s")
        time.sleep(1)
    raise SystemExit("Backend no respondio. Corre: cd access && docker compose up -d --build")


def main() -> int:
    if not (TORNIQUETE_HOST and TORNIQUETE_TOKEN and ADMIN_EMAIL and ADMIN_PASSWORD):
        print("ERROR: define TORNIQUETE_HOST, TORNIQUETE_TOKEN, ACCESS_ADMIN_EMAIL y ACCESS_ADMIN_PASS en el entorno")
        return 1
    wait_backend()
    login = req("POST", "/auth/login", body={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    token = login["accessToken"]
    print(f"Login OK: {login.get('user', {}).get('email', ADMIN_EMAIL)}")

    points = req("GET", "/access/points", token=token)
    existing = next((p for p in points if p.get("name") == POINT_NAME), None)

    camera_id = None
    cameras = req("GET", "/cameras", token=token)
    cam = next((c for c in cameras if c.get("name") == CAMERA_NAME), None)
    if not cam:
        # Proxy local opcional: python facial_snapshot_server.py
        snap_url = f"http://host.docker.internal:8888/snapshot"
        cam = req(
            "POST",
            "/cameras",
            token=token,
            body={
                "name": CAMERA_NAME,
                "rtspUrl": snap_url,
                "externalKey": f"facial-{FACIAL_IP}",
            },
        )
        print(f"Camara creada: {cam['id']} ({snap_url})")
    else:
        print(f"Camara existente: {cam['id']}")
    camera_id = cam["id"]

    if existing:
        point = req(
            "PATCH",
            f"/access/points/{existing['id']}",
            token=token,
            body={
                "controllerKind": "HTTP",
                "controllerRef": CONTROLLER_REF,
            },
        )
        print(f"Punto actualizado: {point['id']}")
        point_id = point["id"]
    else:
        point = req(
            "POST",
            "/access/points",
            token=token,
            body={
                "name": POINT_NAME,
                "kind": "PEDESTRIAN",
                "cameraId": camera_id,
                "securityLevel": "NORMAL",
                "matchThreshold": 0.5,
                "livenessThreshold": 0.6,
                "controllerKind": "HTTP",
                "controllerRef": CONTROLLER_REF,
            },
        )
        print(f"Punto creado: {point['id']}")
        point_id = point["id"]

    print("\n" + "=" * 60)
    print("GYM ACCESS LISTO")
    print("=" * 60)
    print(f"Admin:     http://localhost:3010/kiosk/admin.html")
    print(f"Enroll:    http://localhost:3010/kiosk/enroll.html")
    print(f"Kiosk IP:  http://localhost:3010/kiosk/?source=webcam")
    print(f"           (login admin, selecciona punto '{POINT_NAME}')")
    print(f"Point ID:  {point_id}")
    print(f"Torniquete: POST {TORNIQUETE_HOST}/api/open")
    print("\nFacial RTSP: activar en Image Service del facial, luego:")
    print("  python facial_snapshot_server.py")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
