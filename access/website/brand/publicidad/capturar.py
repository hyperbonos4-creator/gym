"""Graba filme.html fotograma a fotograma y arma el mp4."""
import asyncio, base64, json, os, shutil, subprocess, sys, urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9333
ROOT = os.path.dirname(os.path.abspath(__file__))
URL = "file:///" + ROOT.replace("\\", "/") + "/filme.html"
FRAMES = os.path.join(ROOT, "_frames")
OUT = os.path.join(ROOT, "visionyx-enrolamiento.mp4")
FPS = 30
DURATION = 35.0

class Cdp:
    def __init__(self, ws):
        self.ws = ws
        self.n = 0

    async def call(self, method, params=None, timeout=20):
        self.n += 1
        ident = self.n
        await self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            if msg.get("id") == ident:
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                return msg.get("result") or {}


async def grab(times):
    profile = os.path.join(os.environ["TEMP"], "vx-film")
    if os.path.isdir(profile):
        shutil.rmtree(profile, ignore_errors=True)
    proc = subprocess.Popen([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--force-device-scale-factor=1", "--window-size=1080,1920",
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
        if not ws_url:
            raise RuntimeError("Chrome no abrió una página")
        async with websockets.connect(ws_url, max_size=40_000_000) as ws:
            cdp = Cdp(ws)
            await cdp.call("Page.enable")
            await cdp.call("Runtime.enable")
            await cdp.call("Emulation.setDeviceMetricsOverride", {
                "width": 1080, "height": 1920, "deviceScaleFactor": 1, "mobile": False,
            })
            await cdp.call("Page.navigate", {"url": URL})
            await asyncio.sleep(0.4)
            await cdp.call("Runtime.evaluate", {
                "expression": "document.fonts.ready.then(() => 'ok')",
                "awaitPromise": True,
            })
            os.makedirs(FRAMES, exist_ok=True)
            for i, t in enumerate(times):
                await cdp.call("Runtime.evaluate", {
                    "expression": f"renderAt({t})",
                })
                shot = await cdp.call("Page.captureScreenshot", {
                    "format": "png",
                    "clip": {"x": 0, "y": 0, "width": 1080, "height": 1920, "scale": 1},
                    "captureBeyondViewport": True,
                })
                path = os.path.join(FRAMES, f"f{i:04d}.png")
                with open(path, "wb") as f:
                    f.write(base64.b64decode(shot["data"]))
                if i % 30 == 0:
                    print(f"{i}/{len(times)} t={t:.2f}", flush=True)
            print(f"listo {len(times)}", flush=True)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def encode():
    subprocess.check_call([
        "ffmpeg", "-y", "-framerate", str(FPS),
        "-i", os.path.join(FRAMES, "f%04d.png"),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
        "-movflags", "+faststart", OUT,
    ])
    print(OUT)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "muestras":
        times = [float(x) for x in sys.argv[2:]]
    else:
        n = int(round(DURATION * FPS))
        times = [i / FPS for i in range(n)]
    asyncio.run(grab(times))
    if len(sys.argv) <= 1:
        encode()
