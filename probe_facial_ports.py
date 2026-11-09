"""Sondea banners de los puertos 6000 y 8090 del facial y prueba RTSP en 8090."""
from __future__ import annotations
import socket, sys, urllib.request, urllib.error

HOST = "192.168.100.200"
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def banner(port: int, payload: bytes | None = None) -> None:
    print(f"\n--- puerto {port} ---")
    try:
        with socket.create_connection((HOST, port), timeout=3) as s:
            s.settimeout(3)
            if payload:
                s.sendall(payload)
            try:
                data = s.recv(300)
                print(f"  recv: {data[:300]!r}")
            except socket.timeout:
                print("  (no envía banner; probando GET HTTP)")
                s.sendall(b"GET / HTTP/1.0\r\n\r\n")
                try:
                    print(f"  recv: {s.recv(300)[:300]!r}")
                except socket.timeout:
                    print("  (silencio total)")
    except OSError as e:
        print(f"  error: {e}")


def rtsp_describe(port: int) -> None:
    print(f"\n--- RTSP DESCRIBE en {port} ---")
    for path in ("/", "/live", "/stream1", "/h264", "/ch0", "/main"):
        url = f"rtsp://{HOST}:{port}{path}"
        req = (f"DESCRIBE {url} RTSP/1.0\r\nCSeq: 1\r\n"
               f"Accept: application/sdp\r\n\r\n").encode()
        try:
            with socket.create_connection((HOST, port), timeout=3) as s:
                s.settimeout(3)
                s.sendall(req)
                data = s.recv(500)
                line = data.split(b"\r\n", 1)[0].decode("latin1", "replace")
                print(f"  {path:<10} -> {line}")
        except Exception as e:  # noqa: BLE001
            print(f"  {path:<10} -> error: {e}")


banner(6000)
banner(8090, b"GET / HTTP/1.0\r\n\r\n")
rtsp_describe(8090)
rtsp_describe(554)
