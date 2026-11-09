"""Baja los assets JS del panel del facial FaceGate para leer su API."""
from __future__ import annotations
import sys
import urllib.request
from pathlib import Path

HOST = "192.168.100.200"
OUT = Path(__file__).resolve().parent / "facial_probe"
OUT.mkdir(exist_ok=True)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

FILES = [
    "js/send.js", "js/getcookie.js", "js/main.js",
    "script/ajax.js", "script/functions.js", "script/common.js",
    "script/more.js", "script/m.js", "script/base64.js",
    "script/flush_string.js", "script/importres.js",
]

for f in FILES:
    url = f"http://{HOST}/{f}"
    try:
        with urllib.request.urlopen(url, timeout=6) as r:
            data = r.read()
        out = OUT / f.replace("/", "_")
        out.write_bytes(data)
        print(f"OK   {f:<28} {len(data):>7} bytes -> {out.name}")
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL {f:<28} {exc}")
