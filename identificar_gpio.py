"""Identifica GPIO del torniquete - prueba segura pin a pin."""

import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HOST = "192.168.100.119"
TOKEN = "gym-secret-token"
PINS = [2, 4, 5, 12, 13, 14, 16, 17, 25, 26, 27]


def api(method: str, path: str) -> str:
    req = urllib.request.Request(
        f"http://{HOST}{path}",
        method=method,
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode()


def stop_all() -> None:
    print("Apagando TODOS los pines...")
    print(api("POST", "/api/stop"))


def test_pin(pin: int, countdown: int = 5) -> None:
    print(f"\n--- GPIO {pin} en {countdown}s ---")
    for i in range(countdown, 0, -1):
        print(f"  {i}...")
        time.sleep(1)
    print(f">>> YA <<< Observa: abre? cierra? pitido? cual?")
    try:
        path = f"/api/test?pin={pin}"
        print(api("POST", path))
    except urllib.error.HTTPError as exc:
        print(f"Error: {exc.read().decode()}")
    time.sleep(2)


def scan_all(countdown: int = 10) -> None:
    print("SCAN completo - anota que hace cada GPIO")
    for i in range(countdown, 0, -1):
        print(f"Preparando... {i}")
        time.sleep(1)
    print(">>> YA <<< Mira el torniquete ~2 min")
    print(api("POST", "/api/scan"))


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stop"

    if cmd == "stop":
        stop_all()
    elif cmd == "scan":
        stop_all()
        time.sleep(1)
        scan_all()
    elif cmd == "uno":
        pin = int(sys.argv[2])
        stop_all()
        time.sleep(1)
        test_pin(pin)
    elif cmd == "todos":
        stop_all()
        time.sleep(1)
        for pin in PINS:
            test_pin(pin, countdown=8)
            ans = input(f"GPIO {pin} que hizo? (abre/cierra/pitido/nada): ").strip()
            print(f"  Anotado: GPIO {pin} = {ans}")
    else:
        print("Uso:")
        print("  python identificar_gpio.py stop")
        print("  python identificar_gpio.py scan")
        print("  python identificar_gpio.py uno 25")
        print("  python identificar_gpio.py todos")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
