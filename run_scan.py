"""Envia SCAN al ESP32 y captura logs. Observa cual GPIO abre el torniquete."""

import sys
import time

import serial

PORT = "COM3"
BAUD = 115200


def main() -> int:
    print("=" * 60)
    print("SCAN RELAY - observa el torniquete ~1 minuto")
    print("Cuando se MUEVA, anota el GPIO que diga el log.")
    print("=" * 60)
    for i in range(5, 0, -1):
        print(f"Preparando... {i}")
        time.sleep(1)
    print("\n>>> YA <<<  Mira el torniquete y la terminal\n")

    ser = serial.Serial(PORT, BAUD, timeout=0.1)
    ser.dtr = False
    ser.rts = False
    ser.reset_input_buffer()
    ser.write(b"SCAN\n")
    ser.flush()

    start = time.time()
    while time.time() - start < 120:
        if ser.in_waiting:
            chunk = ser.read(ser.in_waiting).decode("utf-8", errors="replace")
            print(chunk, end="", flush=True)
        time.sleep(0.05)

    ser.close()
    print("\n=== FIN SCAN ===")
    print("Dime que GPIO abrio el torniquete (ej: GPIO 16)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
