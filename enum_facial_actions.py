"""Enumera la API /action/* del facial FaceGate de forma SEGURA.

Truco: el terminal responde 405 a GET si el endpoint existe ("Use POST"),
y 404 si no existe. GET nunca modifica nada → mapeo seguro de la superficie.
"""

from __future__ import annotations

import base64
import sys
import urllib.error
import urllib.request

HOST = "192.168.100.200"
USER, PASS = "admin", "admin"

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

CANDIDATES = [
    # Personas
    "AddPerson", "EditPerson", "ModifyPerson", "DeletePerson", "DeletePersonAll",
    "DeleteAllPerson", "ClearPerson", "GetPerson", "GetPersonList", "GetPersonInfo",
    "FindPerson", "SearchPerson", "QueryPerson", "GetPersonCount", "GetAllPerson",
    "SetPersonInfo", "UpdatePerson",
    # Rostros / tarjetas
    "AddFace", "DeleteFace", "GetFace", "SetFace", "AddCard", "DeleteCard",
    "GetPersonPhoto", "GetPhoto",
    # Puerta / control
    "OpenDoor", "RemoteOpenDoor", "OpenDoorControl", "CloseDoor",
    # Dispositivo / sistema
    "GetDeviceInfo", "SetDeviceInfo", "GetSystemInfo", "GetSysInfo", "DeviceInfo",
    "Reboot", "RebootDevice", "Restart", "GetConfig", "SetConfig", "GetCfg", "SetCfg",
    "SyncTime", "SetTime", "GetTime",
    # Captura / snapshot
    "CaptureImage", "Capture", "GetSnap", "SnapShot", "GetImage",
    # Registros / eventos
    "GetRecord", "QueryRecord", "DeleteRecord", "GetLog", "GetEventRecord",
    "GetVerifyRecord", "GetAccessRecord",
    # Otros comunes
    "Login", "Logout", "Heartbeat", "GetToken", "SetPassword",
]


def probe(cmd: str) -> str:
    url = f"http://{HOST}/action/{cmd}"
    req = urllib.request.Request(url, method="GET")
    token = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
    req.add_header("Authorization", "Basic " + token)
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return f"{r.status} (existe, acepta GET?)"
    except urllib.error.HTTPError as e:
        if e.code == 405:
            return "405 EXISTE (usar POST)"
        if e.code == 404:
            return "404 no existe"
        return f"{e.code}"
    except Exception as exc:  # noqa: BLE001
        return f"err: {exc}"


def main() -> int:
    print(f"=== Enumeración segura de /action/* en {HOST} ===\n")
    exist, missing = [], []
    for cmd in CANDIDATES:
        res = probe(cmd)
        if "EXISTE" in res:
            exist.append(cmd)
            print(f"  ✓ {cmd:<22} {res}")
        elif "no existe" not in res:
            print(f"  ? {cmd:<22} {res}")
        else:
            missing.append(cmd)
    print(f"\n=== ENDPOINTS CONFIRMADOS ({len(exist)}) ===")
    for c in exist:
        print(f"  POST /action/{c}")
    print(f"\n({len(missing)} candidatos no existen)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
