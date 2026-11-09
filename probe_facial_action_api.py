"""Sondea la API JSON /action/* del facial FaceGate con POST + Basic auth.

SOLO comandos de lectura (Query/Get). No modifica el terminal.
Objetivo: confirmar que la API responde autenticada y descubrir el contrato
de enrolamiento (AddPerson) para integrarlo desde el backend del gym.
"""

from __future__ import annotations

import base64
import json
import sys
import urllib.error
import urllib.request

HOST = "192.168.100.200"
USER = "admin"
PASS = "admin"

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

# Comandos de solo lectura para tantear el contrato (no escriben nada)
READ_CMDS = [
    "GetDeviceInfo",
    "QueryPerson",
    "QueryPersonInfo",
    "GetPersonInfo",
    "GetPersonCount",
    "QueryPersonCount",
    "QueryFace",
    "GetConfig",
    "QueryUserList",
]


def call(command: str, body: dict, method: str = "POST") -> None:
    url = f"http://{HOST}/action/{command}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    token = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
    req.add_header("Authorization", "Basic " + token)
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=6) as r:
            raw = r.read(2000).decode("utf-8", errors="replace")
            print(f"  {r.status:>3} {method} /action/{command}")
            print(f"      {raw.strip()[:400]}")
    except urllib.error.HTTPError as e:
        raw = e.read(2000).decode("utf-8", errors="replace")
        print(f"  {e.code:>3} {method} /action/{command}")
        print(f"      {raw.strip()[:400]}")
    except Exception as exc:  # noqa: BLE001
        print(f"    - {method} /action/{command}: {exc}")


def main() -> int:
    print(f"=== API /action/* del facial {HOST} (solo lectura) ===\n")
    print("[Comandos de consulta con cuerpo vacío/paginado]")
    for cmd in READ_CMDS:
        # Cuerpo típico de paginación de estos terminales
        call(cmd, {"info": {"StartNo": 0, "Count": 1}})
    print("\n[AddPerson con GET — solo para confirmar que el endpoint existe]")
    call("AddPerson", None, method="GET")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
