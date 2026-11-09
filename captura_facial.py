"""Escucha COM3 60s mientras usas facial + no-touch. Analiza eventos utiles."""

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
    return datetime.now().strftime("%H:%M:%S")


def main() -> int:
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else DURATION

    print(f"=== CAPTURA {duration}s en {PORT} ===")
    print("Espera la senal >>> YA <<< para usar facial + no-touch.")
    print("-" * 60)

    for i in range(10, 0, -1):
        print(f"Preparando... {i}")
        time.sleep(1)

    print("\n" + "=" * 60)
    print(">>> YA <<<  USA FACIAL + BOTON NO-TOUCH (varias veces, 1 minuto)")
    print("=" * 60 + "\n")

    events: list[tuple[float, str]] = []
    raw = bytearray()

    try:
        ser = serial.Serial(PORT, BAUD, timeout=0.1)
        ser.dtr = False
        ser.rts = False
        ser.reset_input_buffer()
        start = time.time()

        while time.time() - start < duration:
            if ser.in_waiting:
                chunk = ser.read(ser.in_waiting)
                raw.extend(chunk)
                text = chunk.decode("utf-8", errors="replace")
                elapsed = time.time() - start
                for line in text.splitlines():
                    line = line.strip()
                    if line:
                        events.append((elapsed, line))
                        mark = ""
                        if any(k in line.lower() for k in ("open", "kz", "pulse", "relay", "gpio", "scan", "cambio")):
                            mark = " <<EVENTO"
                        print(f"[{ts()} +{elapsed:5.1f}s] {line}{mark}")
            else:
                time.sleep(0.02)

        ser.close()
    except serial.SerialException as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    full = raw.decode("utf-8", errors="replace")
    print("-" * 60)
    print("=== ANALISIS ===")

    keywords = Counter()
    for pat in ["OPEN", "kz_out", "PULSE", "pin=", "GPIO", "cambio", "api", "serial", "WiFi", "error"]:
        keywords[pat] = len(re.findall(pat, full, re.I))

    print("Conteo palabras clave:")
    for k, v in keywords.items():
        if v:
            print(f"  {k}: {v}")

    event_lines = [ln for _, ln in events if re.search(r"open|kz|pulse|pin=|gpio|cambio", ln, re.I)]
    if event_lines:
        print("\nEventos relevantes:")
        for ln in event_lines:
            print(f"  - {ln}")
    else:
        print("\nNO se detectaron eventos OPEN/KZ/GPIO en serial.")
        print("=> El facial puede ir DIRECTO a la placa roja, no por el ESP32.")
        print("=> O el GPIO de entrada no es el correcto.")

    out = "COM3_capture_facial.txt"
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(full)
    print(f"\nGuardado en: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
