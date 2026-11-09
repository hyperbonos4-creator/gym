"""Prueba secuencia: open (GPIO25 ingreso) -> close (GPIO26 vuelve al medio)."""

import sys
import time
import urllib.error
import urllib.request

HOST = "192.168.100.119"
TOKEN = "gym-secret-token"


def post(path: str) -> str:
    req = urllib.request.Request(
        f"http://{HOST}{path}",
        method="POST",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode()


def main() -> int:
    wait = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    print("1) Abriendo INGRESO (GPIO 25)...")
    print(post("/api/open"))
    print(f"\n>>> Mira el torniquete: debe abrir hacia INGRESO (como Face ID)")
    print(f"    Esperando {wait}s...\n")
    time.sleep(wait)
    print("2) Enviando RESET al medio (GPIO 26)...")
    print(post("/api/close"))
    print("\n>>> ¿Volvio al MEDIO? (si/no)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
