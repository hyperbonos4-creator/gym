"""Arma un solo video: cada apartado del software, con la voz que lo explica."""
import asyncio, base64, json, os, shutil, subprocess, sys, urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9336
ROOT = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(ROOT, "frames")
VOCES = os.path.join(ROOT, "voces")
W, H = 1080, 1920

KEYS = [
    "intro", "dashboard", "torniquetes", "accesos", "acceso", "clientes",
    "membresias", "planes", "rutinas", "ejercicios", "estudio", "valoraciones",
    "nutricion", "caja", "ventas", "productos", "inventario", "pedidos",
    "proveedores", "facturacion", "egresos", "reportes", "gimnasios", "cuenta",
    "whatsapp", "outro",
]


class Cdp:
    def __init__(self, ws):
        self.ws = ws
        self.n = 0

    async def call(self, method, params=None, timeout=40):
        self.n += 1
        ident = self.n
        await self.ws.send(json.dumps({"id": ident, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(await asyncio.wait_for(self.ws.recv(), timeout))
            if msg.get("id") == ident:
                if "error" in msg:
                    raise RuntimeError(str(msg["error"]))
                return msg.get("result") or {}


async def frames():
    os.makedirs(FRAMES, exist_ok=True)
    profile = os.path.join(os.environ["TEMP"], "vx-video")
    if os.path.isdir(profile):
        shutil.rmtree(profile, ignore_errors=True)
    url = "file:///" + os.path.join(ROOT, "video.html").replace("\\", "/")
    proc = subprocess.Popen([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--force-device-scale-factor=1", f"--window-size={W},{H}",
        "--allow-file-access-from-files", url,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(60):
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
            for key in KEYS:
                await cdp.call("Page.navigate", {"url": url + "#" + key})
                ready = ""
                for _ in range(30):
                    await asyncio.sleep(0.2)
                    got = await cdp.call("Runtime.evaluate", {
                        "expression": """(async () => {
                          await document.fonts.ready;
                          const img = document.querySelector('img.shot, .shot img, .end img');
                          if (img && !img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });
                          return (document.querySelector('h1') || {}).textContent || '';
                        })()""",
                        "awaitPromise": True,
                        "returnByValue": True,
                    })
                    ready = (got.get("result") or {}).get("value") or ""
                    if ready:
                        break
                await asyncio.sleep(0.35)
                shot = await cdp.call("Page.captureScreenshot", {
                    "format": "png",
                    "clip": {"x": 0, "y": 0, "width": W, "height": H, "scale": 1},
                })
                dest = os.path.join(FRAMES, key + ".png")
                with open(dest, "wb") as f:
                    f.write(base64.b64decode(shot["data"]))
                print(key, ready[:48], flush=True)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


def duration(path):
    out = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "csv=p=0", path,
    ], text=True).strip()
    return float(out)


def encode():
    segs = os.path.join(ROOT, "segmentos")
    os.makedirs(segs, exist_ok=True)
    lines = []
    for key in KEYS:
        png = os.path.join(FRAMES, key + ".png")
        mp3 = os.path.join(VOCES, key + ".mp3")
        seg = os.path.join(segs, key + ".mp4")
        dur = duration(mp3) + 0.35
        subprocess.check_call([
            "ffmpeg", "-y", "-loop", "1", "-framerate", "30", "-i", png, "-i", mp3,
            "-vf", "fps=30,format=yuv420p",
            "-af", "apad=pad_dur=0.35",
            "-t", f"{dur:.3f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", seg,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        lines.append("file '" + seg.replace("\\", "/") + "'")
        print("seg", key, f"{dur:.1f}s", flush=True)
    listing = os.path.join(segs, "lista.txt")
    with open(listing, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    dest = os.path.join(ROOT, "visionyx-software.mp4")
    subprocess.check_call([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listing,
        "-c", "copy", "-movflags", "+faststart", dest,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("listo", dest, flush=True)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "todo"
    if mode in ("frames", "todo"):
        asyncio.run(frames())
    if mode in ("video", "todo"):
        encode()
