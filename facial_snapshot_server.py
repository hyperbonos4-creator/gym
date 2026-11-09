"""
Proxy JPEG desde RTSP del facial para access backend.

Requiere: pip install opencv-python-headless
Activar RTSP en el facial (Image Service / menu camara).

Uso:
  python facial_snapshot_server.py
  # access usa: http://host.docker.internal:8888/snapshot
"""

from __future__ import annotations

import argparse
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2

DEFAULT_RTSP = "rtsp://192.168.100.200:8090/"


class SnapshotHandler(BaseHTTPRequestHandler):
    frame_lock = threading.Lock()
    latest_jpeg: bytes | None = None

    def log_message(self, fmt: str, *args) -> None:
        print(f"[snapshot] {fmt % args}")

    def do_GET(self) -> None:
        with SnapshotHandler.frame_lock:
            data = SnapshotHandler.latest_jpeg
        if not data:
            self.send_response(503)
            self.end_headers()
            self.wfile.write(b"no frame yet")
            return
        self.send_response(200)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def capture_loop(rtsp_url: str) -> None:
    print(f"Conectando RTSP: {rtsp_url}")
    while True:
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not cap.isOpened():
            print("RTSP no disponible. Revisa Image Service en el facial. Reintento 5s...")
            time.sleep(5)
            continue
        print("RTSP conectado.")
        while True:
            ok, frame = cap.read()
            if not ok or frame is None:
                print("Perdida de stream RTSP, reconectando...")
                break
            ok_enc, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
            if ok_enc:
                with SnapshotHandler.frame_lock:
                    SnapshotHandler.latest_jpeg = buf.tobytes()
            time.sleep(0.2)
        cap.release()
        time.sleep(2)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rtsp", default=DEFAULT_RTSP)
    parser.add_argument("--port", type=int, default=8888)
    args = parser.parse_args()

    t = threading.Thread(target=capture_loop, args=(args.rtsp,), daemon=True)
    t.start()

    server = ThreadingHTTPServer(("0.0.0.0", args.port), SnapshotHandler)
    print(f"Snapshot HTTP: http://0.0.0.0:{args.port}/snapshot")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Detenido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
