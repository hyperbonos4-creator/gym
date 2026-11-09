"""Lee la IP del ESP32 desde el monitor serial tras flashear."""

import re
import sys
import time

import serial

PORT = "COM3"
BAUD = 115200
TIMEOUT = 20


def main() -> int:
    print(f"Escuchando {PORT} @ {BAUD} ({TIMEOUT}s)...")
    ip = None

    try:
        with serial.Serial(PORT, BAUD, timeout=1) as ser:
            start = time.time()
            buffer = ""

            while time.time() - start < TIMEOUT:
                if ser.in_waiting:
                    chunk = ser.read(ser.in_waiting).decode("utf-8", errors="replace")
                    print(chunk, end="", flush=True)
                    buffer += chunk
                    match = re.search(r"WiFi OK IP=([\d.]+)", buffer)
                    if match:
                        ip = match.group(1)
                        break
                time.sleep(0.05)
    except serial.SerialException as exc:
        print(f"Error serial: {exc}", file=sys.stderr)
        return 1

    if ip:
        print(f"\n\nIP detectada: {ip}")
        print(f"Prueba: python torniquete_cli.py --host {ip} open")
        return 0

    print("\nNo se detecto IP. Revisa WiFi en esp32_torniquete_api/config.h")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
