"""Arma cada anuncio 1080x1350 con la captura real del apartado."""
import asyncio, base64, json, os, shutil, subprocess, urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9335
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "facebook")
URL = "file:///" + ROOT.replace("\\", "/") + "/funcion.html"
KEYS = [
    "dashboard", "torniquetes", "accesos", "acceso",
    "clientes", "membresias", "planes", "rutinas", "ejercicios", "estudio",
    "valoraciones", "nutricion",
    "caja", "ventas", "productos", "inventario", "pedidos", "proveedores",
    "facturacion", "egresos", "reportes",
    "gimnasios", "cuenta", "whatsapp",
]


class Cdp:
    def __init__(self, ws):
        self.ws = ws
        self.n = 0

    async def call(self, method, params=None, timeout=25):
        self.n += 1
        ident = self.n
        await self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            if msg.get("id") == ident:
                if "error" in msg:
                    raise RuntimeError(str(msg["error"]))
                return msg.get("result") or {}


async def main():
    os.makedirs(OUT, exist_ok=True)
    profile = os.path.join(os.environ["TEMP"], "vx-ads3")
    if os.path.isdir(profile):
        shutil.rmtree(profile, ignore_errors=True)
    proc = subprocess.Popen([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--force-device-scale-factor=1", "--window-size=1080,1350",
        "--allow-file-access-from-files", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(40):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json", timeout=1) as r:
                    tabs = json.load(r)
                page = next((t for t in tabs if t.get("type") == "page"), None)
                if page and page.get("webSocketDebuggerUrl"):
                    ws_url = page["webSocketDebuggerUrl"]
                    break
            except Exception:
                pass
            await asyncio.sleep(0.15)
        async with websockets.connect(ws_url, max_size=40_000_000) as ws:
            cdp = Cdp(ws)
            await cdp.call("Page.enable")
            await cdp.call("Runtime.enable")
            await cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": 1080, "height": 1350, "deviceScaleFactor": 1, "mobile": False,
            })
            await cdp.call("Page.navigate", {"url": URL + "#dashboard"})
            await cdp.call("Runtime.evaluate", {"expression": "document.fonts.ready", "awaitPromise": True})
            await asyncio.sleep(0.4)
            for key in KEYS:
                await cdp.call("Runtime.evaluate", {
                    "expression": f"location.hash='#{key}'; document.getElementById('title').textContent",
                    "returnByValue": True,
                })
                await asyncio.sleep(0.05)
                shot = await cdp.call("Page.captureScreenshot", {
                    "format": "png",
                    "clip": {"x": 0, "y": 0, "width": 1080, "height": 1350, "scale": 1},
                    "captureBeyondViewport": True,
                })
                with open(os.path.join(OUT, f"visionyx-{key}.png"), "wb") as f:
                    f.write(base64.b64decode(shot["data"]))
                print(key, flush=True)
    finally:
        proc.terminate()


if __name__ == "__main__":
    asyncio.run(main())
