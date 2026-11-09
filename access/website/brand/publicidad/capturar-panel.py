"""Entra al panel local y guarda cada apartado tal como se ve."""
import asyncio, base64, json, os, shutil, subprocess, urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9334
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "capturas")
BASE = "http://127.0.0.1:3199"
W, H = 1080, 1100

PAGES = [
    ("dashboard", "/"),
    ("torniquetes", "/torniquetes"),
    ("accesos", "/accesos"),
    ("acceso", "/acceso"),
    ("clientes", "/clientes"),
    ("membresias", "/membresias"),
    ("planes", "/planes"),
    ("rutinas", "/rutinas"),
    ("ejercicios", "/ejercicios"),
    ("estudio", "/estudio"),
    ("valoraciones", "/valoraciones"),
    ("nutricion", "/nutricion"),
    ("clases", "/clases"),
    ("caja", "/caja"),
    ("ventas", "/ventas"),
    ("productos", "/productos"),
    ("inventario", "/inventario"),
    ("pedidos", "/pedidos"),
    ("proveedores", "/proveedores"),
    ("facturacion", "/facturacion"),
    ("egresos", "/egresos"),
    ("reportes", "/reportes"),
    ("gimnasios", "/gimnasios"),
    ("cuenta", "/cuenta"),
    ("whatsapp", "/whatsapp"),
]


class Cdp:
    def __init__(self, ws):
        self.ws = ws
        self.n = 0

    async def call(self, method, params=None, timeout=30):
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
    profile = os.path.join(os.environ["TEMP"], "vx-panel")
    if os.path.isdir(profile):
        shutil.rmtree(profile, ignore_errors=True)
    proc = subprocess.Popen([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--force-device-scale-factor=1", f"--window-size={W},{H}",
        "--use-gl=angle", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(50):
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
        if not ws_url:
            raise RuntimeError("sin pagina")
        async with websockets.connect(ws_url, max_size=40_000_000) as ws:
            cdp = Cdp(ws)
            await cdp.call("Page.enable")
            await cdp.call("Runtime.enable")
            await cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": W, "height": H, "deviceScaleFactor": 1, "mobile": False,
            })
            await cdp.call("Page.navigate", {"url": BASE + "/login"})
            await asyncio.sleep(0.6)
            login = r"""
              (async () => {
                const r = await fetch('/api/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username:'admin', password:'admin'}) });
                const d = await r.json();
                if (!d.ok) return 'fail';
                localStorage.setItem('gym_session', JSON.stringify(d.user));
                localStorage.setItem('gym_active', 'fuerza-elite');
                location.assign('/');
                return 'ok';
              })()
            """
            await cdp.call("Runtime.evaluate", {"expression": login, "awaitPromise": True})
            for _ in range(40):
                loc = await cdp.call("Runtime.evaluate", {"expression": "location.pathname", "returnByValue": True})
                if loc.get("result", {}).get("value") == "/":
                    break
                await asyncio.sleep(0.25)
            else:
                body = await cdp.call("Runtime.evaluate", {"expression": "document.body.innerText.slice(0,300)", "returnByValue": True})
                raise RuntimeError("no entro: " + str(body.get("result", {}).get("value")))
            await asyncio.sleep(1.4)
            ready_js = """(() => {
              const t = document.body.innerText || '';
              return /Cargando|Abriendo caja|Leyendo la sede|Comprobando servicios|Revisando el registro|Preparando/.test(t) ? 'loading' : 'ready';
            })()"""
            for key, path in PAGES:
                await cdp.call("Page.navigate", {"url": BASE + path})
                state = "loading"
                for _ in range(16):
                    await asyncio.sleep(0.45)
                    got = await cdp.call("Runtime.evaluate", {"expression": ready_js, "returnByValue": True})
                    state = got.get("result", {}).get("value") or "loading"
                    if state == "ready":
                        break
                if key in ("ejercicios", "estudio"):
                    await asyncio.sleep(8)
                shot = await cdp.call("Page.captureScreenshot", {
                    "format": "png",
                    "clip": {"x": 0, "y": 0, "width": W, "height": H, "scale": 1},
                    "captureBeyondViewport": True,
                })
                dest = os.path.join(OUT, key + ".png")
                with open(dest, "wb") as f:
                    f.write(base64.b64decode(shot["data"]))
                print(key, state, flush=True)
    finally:
        proc.terminate()


if __name__ == "__main__":
    asyncio.run(main())
