"""Cliente para abrir el torniquete desde tu software."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

try:
    import serial
except ImportError:  # pragma: no cover - optional dependency
    serial = None


def load_env_file(path: str = ".env") -> None:
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


@dataclass
class TurnstileClient:
    """Control del torniquete por HTTP (recomendado) o serial."""

    host: str | None = None
    token: str | None = None
    serial_port: str | None = None
    baud: int = 115200
    timeout: float = 20.0

    @classmethod
    def from_env(cls) -> "TurnstileClient":
        load_env_file()
        host = os.getenv("TORNIQUETE_HOST") or None
        token = os.getenv("TORNIQUETE_TOKEN")
        serial_port = os.getenv("TORNIQUETE_SERIAL") or None
        return cls(host=host, token=token, serial_port=serial_port)

    def _base_url(self) -> str:
        if not self.host:
            raise ValueError("Configura host para control HTTP, o serial_port para COM.")
        host = self.host.rstrip("/")
        if not host.startswith("http"):
            host = f"http://{host}"
        return host

    def _request(self, method: str, path: str) -> dict[str, Any]:
        url = f"{self._base_url()}{path}"
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        req = Request(url, method=method, headers=headers)
        try:
            with urlopen(req, timeout=self.timeout) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {"ok": True}
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"No se pudo conectar a {url}: {exc}") from exc

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/health")

    def status(self) -> dict[str, Any]:
        return self.health()

    def open_http(self) -> dict[str, Any]:
        return self._request("POST", "/api/open")

    def close_http(self) -> dict[str, Any]:
        return self._request("POST", "/api/close")

    def reset_http(self) -> dict[str, Any]:
        self.stop_http()
        return self.close_http()

    def reset(self) -> dict[str, Any]:
        return self.reset_http()

    def stop_http(self) -> dict[str, Any]:
        return self._request("POST", "/api/stop")

    def stop(self) -> dict[str, Any]:
        return self.stop_http()

    def test_pin(self, pin: int) -> dict[str, Any]:
        return self._request("POST", f"/api/test?pin={pin}")

    def scan(self) -> dict[str, Any]:
        url = f"{self._base_url()}/api/scan"
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = Request(url, method="POST", headers=headers)
        try:
            with urlopen(req, timeout=120.0) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body) if body else {"ok": True}
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"HTTP {exc.code}: {detail}") from exc
        except URLError as exc:
            raise RuntimeError(f"No se pudo conectar a {url}: {exc}") from exc

    def close(self) -> dict[str, Any] | str:
        if self.host:
            return self.close_http()
        return self.open_serial("CLOSE")

    def open_serial(self, command: str = "OPEN") -> str:
        if serial is None:
            raise RuntimeError("Instala pyserial: pip install pyserial")
        if not self.serial_port:
            raise ValueError("Configura serial_port, por ejemplo COM3.")

        with serial.Serial(self.serial_port, self.baud, timeout=self.timeout) as port:
            port.reset_input_buffer()
            port.write((command + "\n").encode("utf-8"))
            port.flush()
            reply = port.readline().decode("utf-8", errors="replace").strip()
            return reply or "OK"

    def open(self) -> dict[str, Any] | str:
        """Abre el torniquete usando HTTP si hay host, si no serial."""
        if self.host:
            return self.open_http()
        return self.open_serial()
