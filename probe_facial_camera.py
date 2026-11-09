"""Prueba RTSP y snapshots HTTP del facial chino (192.168.100.200)."""

from __future__ import annotations

import sys
import urllib.error
import urllib.request
from pathlib import Path

HOST = "192.168.100.200"
USER = "admin"
PASS = "admin"

RTSP_URLS = [
    f"rtsp://{USER}:{PASS}@{HOST}/",
    f"rtsp://{USER}:{PASS}@{HOST}:554/",
    f"rtsp://{USER}:{PASS}@{HOST}:8090/",
    f"rtsp://{USER}:{PASS}@{HOST}/live",
    f"rtsp://{USER}:{PASS}@{HOST}/stream1",
    f"rtsp://{USER}:{PASS}@{HOST}/h264",
    f"rtsp://{HOST}/",
    f"rtsp://{HOST}:8090/",
]

HTTP_PATHS = [
    "/SnapShotJPEG?channel=1",
    "/cgi-bin/snapshot.cgi",
    "/Streaming/channels/1/picture",
    "/ISAPI/Streaming/channels/101/picture",
    "/jpg/image.jpg",
    "/capture/webCapture.jpg",
    "/api/snapshot",
    "/video.mjpg",
]


def try_http(path: str) -> bool:
    url = f"http://{HOST}{path}"
    req = urllib.request.Request(url)
    cred = f"{USER}:{PASS}".encode()
    import base64

    req.add_header("Authorization", "Basic " + base64.b64encode(cred).decode())
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read(4096)
            ct = resp.headers.get("Content-Type", "")
            ok = len(data) > 500 and ("image" in ct or data[:2] == b"\xff\xd8")
            print(f"  {'OK' if ok else '??'} HTTP {resp.status} {path} type={ct} bytes={len(data)}")
            if ok:
                out = Path(__file__).resolve().parent / "facial_snapshot_test.jpg"
                out.write_bytes(data[:500000] if len(data) > 500000 else data)
                print(f"       guardado: {out.name}")
            return ok
    except urllib.error.HTTPError as exc:
        print(f"  HTTP {exc.code} {path}")
    except urllib.error.URLError as exc:
        print(f"  ERR {path} {exc.reason}")
    return False


def try_rtsp(url: str, timeout_ms: int = 4000) -> bool:
    try:
        import cv2  # type: ignore
    except ImportError:
        print("  (opencv no instalado: pip install opencv-python)")
        return False
    import os

    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = f"rtsp_transport;tcp|stimeout;{timeout_ms * 1000}"
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, timeout_ms)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, timeout_ms)
    if not cap.isOpened():
        print(f"  FAIL RTSP {url}")
        return False
    ok, frame = cap.read()
    cap.release()
    if ok and frame is not None:
        print(f"  OK RTSP {url} frame={frame.shape}")
        out = Path(__file__).resolve().parent / "facial_rtsp_test.jpg"
        cv2.imwrite(str(out), frame)
        print(f"       guardado: {out.name}")
        return True
    print(f"  OPEN but no frame {url}")
    return False


def main() -> int:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--http-only", action="store_true", help="Solo HTTP (rapido)")
    args = parser.parse_args()

    print(f"=== Probe facial {HOST} ===\nHTTP snapshots:")
    http_ok = [p for p in HTTP_PATHS if try_http(p)]

    rtsp_ok: list[str] = []
    if not args.http_only:
        print("\nRTSP streams (timeout 4s c/u):")
        rtsp_ok = [u for u in RTSP_URLS if try_rtsp(u)]
    else:
        print("\n(RTSP omitido — usa sin --http-only tras activar Image Service)")

    print("\n=== RESUMEN ===")
    if http_ok:
        print(f"HTTP OK: {http_ok[0]}")
        print(f"  Registrar en access camera rtspUrl: http://{USER}:{PASS}@{HOST}{http_ok[0]}")
    elif rtsp_ok:
        print(f"RTSP OK: {rtsp_ok[0]}")
        print(f"  Registrar en access camera rtspUrl: {rtsp_ok[0]}")
    else:
        print("No se encontro stream. Revisa Image Service en el panel del facial.")
    return 0 if (http_ok or rtsp_ok) else 1


if __name__ == "__main__":
    raise SystemExit(main())
