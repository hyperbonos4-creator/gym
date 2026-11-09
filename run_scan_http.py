"""SCAN por HTTP sin tocar COM3. Muestra tiempos estimados por GPIO."""

import sys
import time
import urllib.error
import urllib.request

HOST = "192.168.100.119"
TOKEN = "gym-secret-token"

PINS = [2, 4, 5, 12, 13, 14, 16, 17, 25, 26, 27]
SEC_PER_PIN = 5.6  # 2s LOW + 0.8s + 2s HIGH + 0.8s


def wait_online(max_wait: int = 30) -> bool:
    for _ in range(max_wait):
        try:
            with urllib.request.urlopen(f"http://{HOST}/health", timeout=2) as resp:
                if resp.status == 200:
                    return True
        except urllib.error.URLError:
            pass
        time.sleep(1)
    return False


def main() -> int:
    countdown = int(sys.argv[1]) if len(sys.argv) > 1 else 10

    print("Esperando ESP32 online...")
    if not wait_online():
        print("ESP32 no responde. Revisa WiFi o espera unos segundos.")
        return 1
    print("ESP32 online.\n")

    print("Orden del SCAN (cada pin ~5.6s, LOW luego HIGH):")
    t = 0.0
    for pin in PINS:
        print(f"  +{t:5.1f}s -> GPIO {pin} ACTIVO LOW")
        t += 2.8
        print(f"  +{t:5.1f}s -> GPIO {pin} ACTIVO HIGH")
        t += 2.8

    print("\n" + "=" * 60)
    for i in range(countdown, 0, -1):
        print(f"Preparando... {i}")
        time.sleep(1)
    print(">>> YA <<<  Mira el torniquete y anota el SEGUNDO aproximado del movimiento/pitido")
    print("=" * 60 + "\n")

    t0 = time.time()
    req = urllib.request.Request(
        f"http://{HOST}/api/scan",
        method="POST",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            print(f"SCAN iniciado: {resp.read().decode()}")
    except urllib.error.URLError as exc:
        print(f"Error: {exc}")
        return 1

    total = len(PINS) * SEC_PER_PIN + 5
    print(f"\nSCAN en curso ~{total:.0f}s...")
    while time.time() - t0 < total:
        elapsed = time.time() - t0
        active = None
        acc = 0.0
        for pin in PINS:
            if acc <= elapsed < acc + 2.8:
                active = (pin, "LOW")
                break
            acc += 2.8
            if acc <= elapsed < acc + 2.8:
                active = (pin, "HIGH")
                break
            acc += 2.8
        if active:
            print(f"  +{elapsed:5.1f}s  probando GPIO {active[0]} {active[1]}   ", end="\r")
        time.sleep(0.3)

    print(f"\n\n=== FIN SCAN (+{time.time()-t0:.0f}s) ===")
    print("Dime el segundo aproximado del pitido/movimiento (ej: +17s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
