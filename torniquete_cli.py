"""CLI para abrir el torniquete desde tu software."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from gym_torniquete import TurnstileClient
from gym_torniquete.client import load_env_file


def main() -> int:
    load_env_file()
    parser = argparse.ArgumentParser(description="Control del torniquete Gym")
    parser.add_argument(
        "action",
        choices=["open", "entry", "close", "reset", "stop", "test", "scan", "status", "health"],
        nargs="?",
        default="stop",
    )
    parser.add_argument("--pin", type=int, help="GPIO para test (modo identificacion)")
    parser.add_argument("--host", default=os.getenv("TORNIQUETE_HOST"))
    parser.add_argument("--token", default=os.getenv("TORNIQUETE_TOKEN", "gym-secret-token"))
    parser.add_argument("--port", default=os.getenv("TORNIQUETE_SERIAL", "COM3"))
    parser.add_argument("--serial", action="store_true", help="Forzar control por USB/serial")
    args = parser.parse_args()

    if args.serial or not args.host:
        client = TurnstileClient(serial_port=args.port, token=args.token)
    else:
        client = TurnstileClient(host=args.host, token=args.token)

    try:
        if args.action in ("open", "entry"):
            result = client.open()
        elif args.action == "close":
            result = client.close()
        elif args.action == "reset":
            result = client.reset()
        elif args.action == "stop":
            result = client.stop()
        elif args.action == "test":
            if args.pin is None:
                print("Usa: torniquete_cli.py test --pin 25", file=sys.stderr)
                return 1
            result = client.test_pin(args.pin)
        elif args.action == "scan":
            result = client.scan()
        elif args.action == "status":
            result = client.status()
        else:
            result = client.health()
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if isinstance(result, dict):
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
