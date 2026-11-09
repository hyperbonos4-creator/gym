"""Escanea GPIO del relay. Observa el torniquete y anota que GPIO abre."""

import sys
import time

import serial

PORT = "COM3"
BAUD = 115200


def main() -> int:
    print("Enviando SCAN al ESP32...")
    print("Observa el torniquete: anota el numero GPIO que lo abra.\n")

    try:
        with serial.Serial(PORT, BAUD, timeout=1) as ser:
            ser.reset_input_buffer()
            ser.write(b"SCAN\n")
            ser.flush()

            start = time.time()
            while time.time() - start < 120:
                if ser.in_waiting:
                    print(ser.read(ser.in_waiting).decode("utf-8", errors="replace"), end="", flush=True)
                time.sleep(0.05)
    except serial.SerialException as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    print("\nListo. Dime que GPIO abrio el torniquete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
