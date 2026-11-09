"""Escucha COM3 y captura todo lo que emite el ESP32 (1 minuto)."""

from __future__ import annotations

import re
import sys
import time
from collections import Counter
from datetime import datetime

import serial

PORT = "COM3"
BAUD = 115200
DURATION = 60


def ts() -> str:
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def printable(data: bytes) -> str:
    return data.decode("utf-8", errors="replace").replace("\r", "\\r").replace("\n", "\\n\n")


def main() -> int:
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else DURATION

    print(f"=== SNIFFER ESP32 {PORT} @ {BAUD} ===")
    print(f"Escuchando {duration}s. Usa facial + boton no-touch ahora.")
    print("-" * 60)

    events: list[tuple[float, str, bytes]] = []
    raw_buffer = bytearray()

    try:
        with serial.Serial(PORT, BAUD, timeout=0.1) as ser:
            ser.reset_input_buffer()
            start = time.time()

            while time.time() - start < duration:
                if ser.in_waiting:
                    chunk = ser.read(ser.in_waiting)
                    elapsed = time.time() - start
                    text = chunk.decode("utf-8", errors="replace")
                    events.append((elapsed, text, chunk))
                    raw_buffer.extend(chunk)
                    print(f"[{ts()} +{elapsed:6.2f}s] {printable(chunk)}", flush=True)
                else:
                    time.sleep(0.02)

    except serial.SerialException as exc:
        print(f"Error serial: {exc}", file=sys.stderr)
        return 1

    print("-" * 60)
    print("=== RESUMEN ===")
    print(f"Chunks recibidos: {len(events)}")
    print(f"Bytes totales:    {len(raw_buffer)}")

    full_text = raw_buffer.decode("utf-8", errors="replace")
    lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]
    unique_lines = list(dict.fromkeys(lines))

    if unique_lines:
        print("\nLineas unicas detectadas:")
        for line in unique_lines[:40]:
            print(f"  - {line}")
        if len(unique_lines) > 40:
            print(f"  ... y {len(unique_lines) - 40} mas")

    keywords = Counter()
    for pat in [
        r"open", r"abrir", r"unlock", r"kz", r"relay", r"gpio",
        r"wifi", r"http", r"face", r"touch", r"ok", r"error",
        r"conect", r"ip=", r"POST", r"GET",
    ]:
        if re.search(pat, full_text, re.I):
            keywords[pat] += len(re.findall(pat, full_text, re.I))

    if keywords:
        print("\nPalabras clave encontradas:")
        for k, v in keywords.most_common():
            print(f"  {k}: {v}")

    # Detectar cambios bruscos (posibles eventos KZ OUT / relay)
    if len(events) >= 2:
        gaps = []
        for i in range(1, len(events)):
            gap = events[i][0] - events[i - 1][0]
            if gap > 0.3:
                gaps.append((events[i][0], gap, events[i][1][:80]))
        if gaps:
            print("\nPosibles eventos (pausas > 0.3s entre mensajes):")
            for t, gap, preview in gaps[:15]:
                preview = preview.replace("\n", " ")[:80]
                print(f"  +{t:6.2f}s (gap {gap:.2f}s) -> {preview!r}")

    out = PORT.replace(":", "") + "_capture.txt"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(full_text)
    print(f"\nCaptura guardada en: {out}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
