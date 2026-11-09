"""Prueba de comunicacion serial con ESP32 (COM3) - torniquete.

Uso:
  python test_torniquete.py              # envia OPEN
  python test_torniquete.py ABRIR        # envia comando personalizado
  python test_torniquete.py --listen 10  # solo escucha logs del ESP32
"""

import sys
import time

import serial

PORT = "COM3"
BAUD = 115200
TIMEOUT = 2


def open_port():
    return serial.Serial(
        port=PORT,
        baudrate=BAUD,
        bytesize=serial.EIGHTBITS,
        parity=serial.PARITY_NONE,
        stopbits=serial.STOPBITS_ONE,
        timeout=TIMEOUT,
    )


def read_available(ser, wait_s=1.5):
    time.sleep(wait_s)
    lines = []
    while ser.in_waiting:
        chunk = ser.read(ser.in_waiting)
        try:
            text = chunk.decode("utf-8", errors="replace").strip()
        except Exception:
            text = repr(chunk)
        if text:
            lines.append(text)
    return lines


def send_command(ser, command: str):
    payload = command if command.endswith("\n") else command + "\n"
    ser.reset_input_buffer()
    ser.write(payload.encode("utf-8"))
    ser.flush()
    print(f"Enviado: {command!r}")
    replies = read_available(ser)
    if replies:
        print("Respuesta del ESP32:")
        for line in replies:
            print(f"  {line}")
    else:
        print("Sin respuesta (puede ser normal si el firmware no responde por serial).")
    return replies


def listen(ser, seconds: float):
    print(f"Escuchando {seconds}s en {PORT}...")
    start = time.time()
    while time.time() - start < seconds:
        if ser.in_waiting:
            chunk = ser.read(ser.in_waiting)
            print(chunk.decode("utf-8", errors="replace"), end="", flush=True)
        time.sleep(0.05)
    print()


def main():
    if len(sys.argv) >= 2 and sys.argv[1] == "--listen":
        seconds = float(sys.argv[2]) if len(sys.argv) >= 3 else 10.0
        try:
            with open_port() as ser:
                listen(ser, seconds)
        except serial.SerialException as exc:
            print(f"Error de puerto serial: {exc}")
            sys.exit(1)
        return

    command = sys.argv[1] if len(sys.argv) > 1 else "OPEN"

    print(f"Conectando a {PORT} @ {BAUD} baud...")
    try:
        with open_port() as ser:
            print("Conexion OK.\n")

            boot = read_available(ser, wait_s=0.5)
            if boot:
                print("Mensajes iniciales del ESP32:")
                for line in boot:
                    print(f"  {line}")
                print()

            send_command(ser, command)
    except serial.SerialException as exc:
        print(f"Error de puerto serial: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
