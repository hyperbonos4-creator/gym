"""SCAN por HTTP + log serial para identificar el GPIO que abre."""

import sys
import threading
import time
import urllib.error
import urllib.request

import serial

HOST = "192.168.100.119"
TOKEN = "gym-secret-token"
PORT = "COM3"
BAUD = 115200


def listen_serial(stop: threading.Event, lines: list[str]) -> None:
    try:
        ser = serial.Serial(PORT, BAUD, timeout=0.1)
        ser.dtr = False
        ser.rts = False
        while not stop.is_set():
            if ser.in_waiting:
                chunk = ser.read(ser.in_waiting).decode("utf-8", errors="replace")
                for line in chunk.splitlines():
                    line = line.strip()
                    if line:
                        lines.append(line)
                        mark = " <<<<" if "GPIO" in line and "ACTIVO" in line else ""
                        print(f"  [serial] {line}{mark}")
            time.sleep(0.05)
        ser.close()
    except serial.SerialException as exc:
        print(f"  [serial] Error: {exc}")


def main() -> int:
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 10

    print("=" * 60)
    print("SCAN REPETIDO - mira el torniquete y escucha el pitido")
    print("=" * 60)
    for i in range(duration, 0, -1):
        print(f"Preparando... {i}")
        time.sleep(1)

    print("\n>>> YA <<<  Mira el torniquete ~1 minuto\n")

    lines: list[str] = []
    stop = threading.Event()
    t = threading.Thread(target=listen_serial, args=(stop, lines), daemon=True)
    t.start()
    time.sleep(0.5)

    req = urllib.request.Request(
        f"http://{HOST}/api/scan",
        method="POST",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            print(f"  [http] {resp.read().decode()}")
    except urllib.error.URLError as exc:
        stop.set()
        print(f"Error HTTP: {exc}")
        return 1

    print("  Escuchando serial 90s mientras corre SCAN...")
    time.sleep(90)
    stop.set()
    t.join(timeout=2)

    print("\n=== GPIO PROBADOS (log) ===")
    gpio_lines = [ln for ln in lines if "GPIO" in ln and "ACTIVO" in ln]
    for ln in gpio_lines:
        print(f"  {ln}")

    with open("COM3_scan_log.txt", "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))

    print("\nGuardado: COM3_scan_log.txt")
    print("Dime en que GPIO viste el movimiento/pitido (o aprox. inicio/medio/final).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
