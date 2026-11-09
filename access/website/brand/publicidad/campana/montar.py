"""Arma el comercial de 50 s, tres anuncios cortos y el carrusel de seis."""
import asyncio, base64, json, os, shutil, subprocess, urllib.request
import websockets

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PORT = 9337
ROOT = os.path.dirname(os.path.abspath(__file__))
FRAMES = os.path.join(ROOT, "frames")
VOCES = os.path.join(ROOT, "voces")
W = 1080

VIDEOS = {
    "fuerza-elite-comercial.mp4": ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"],
    "fuerza-elite-acceso.mp4": ["a1", "a2", "a3"],
    "fuerza-elite-enrolamiento.mp4": ["b1", "b2", "b3"],
    "fuerza-elite-operacion.mp4": ["c1", "c2", "c3"],
}
CARDS = ["k1", "k2", "k3", "k4", "k5", "k6"]


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


async def shoot(cdp, url, key, w, h, dest):
    await cdp.call("Emulation.setDeviceMetricsOverride", {
        "width": w, "height": h, "deviceScaleFactor": 1, "mobile": False,
    })
    await cdp.call("Page.navigate", {"url": url + "#" + key})
    ready = ""
    for _ in range(25):
        await asyncio.sleep(0.18)
        got = await cdp.call("Runtime.evaluate", {
            "expression": """(async () => {
              await document.fonts.ready;
              const img = document.querySelector('.shot img, .end img');
              if (img && !img.complete) await new Promise(r => { img.onload = r; img.onerror = r; });
              return (document.querySelector('h1') || {}).textContent || '';
            })()""",
            "awaitPromise": True,
            "returnByValue": True,
        })
        ready = (got.get("result") or {}).get("value") or ""
        if ready:
            break
    await asyncio.sleep(0.25)
    shot = await cdp.call("Page.captureScreenshot", {
        "format": "png",
        "clip": {"x": 0, "y": 0, "width": w, "height": h, "scale": 1},
    })
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        f.write(base64.b64decode(shot["data"]))
    print(key, h, ready[:42], flush=True)


async def frames():
    profile = os.path.join(os.environ["TEMP"], "vx-campana")
    if os.path.isdir(profile):
        shutil.rmtree(profile, ignore_errors=True)
    url = "file:///" + os.path.join(ROOT, "pieza.html").replace("\\", "/")
    proc = subprocess.Popen([
        CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        f"--remote-debugging-port={PORT}", f"--user-data-dir={profile}",
        "--force-device-scale-factor=1", "--window-size=1080,1920",
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
            seen = []
            for keys in VIDEOS.values():
                seen.extend(keys)
            for key in seen:
                await shoot(cdp, url, key, W, 1920, os.path.join(FRAMES, key + ".png"))
            card_dir = os.path.join(ROOT, "carrusel")
            for i, key in enumerate(CARDS, 1):
                await shoot(cdp, url, key, W, 1350, os.path.join(card_dir, f"{i:02d}.png"))
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


def encode_one(name, keys):
    segs = os.path.join(ROOT, "segmentos")
    os.makedirs(segs, exist_ok=True)
    lines = []
    for key in keys:
        png = os.path.join(FRAMES, key + ".png")
        mp3 = os.path.join(VOCES, key.replace("m", "m").replace("a", "a") + ".mp3")
        # Las claves de imagen y de voz coinciden: m1, a1, b1, c1.
        mp3 = os.path.join(VOCES, key + ".mp3")
        seg = os.path.join(segs, key + ".mp4")
        extra = 2.2 if key in ("m10", "a3", "b3", "c3") else 1.15
        dur = duration(mp3) + extra
        subprocess.check_call([
            "ffmpeg", "-y", "-loop", "1", "-framerate", "30", "-i", png, "-i", mp3,
            "-vf", "fps=30,format=yuv420p",
            "-af", f"apad=pad_dur={extra:.2f}",
            "-t", f"{dur:.3f}",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", seg,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        lines.append("file '" + seg.replace("\\", "/") + "'")
        print("seg", key, f"{dur:.1f}s", flush=True)
    listing = os.path.join(segs, name + ".txt")
    with open(listing, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    dest = os.path.join(ROOT, name)
    subprocess.check_call([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", listing,
        "-c", "copy", "-movflags", "+faststart", dest,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("listo", name, flush=True)


def encode():
    for name, keys in VIDEOS.items():
        encode_one(name, keys)


if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "todo"
    if mode in ("frames", "todo"):
        asyncio.run(frames())
    if mode in ("video", "todo"):
        encode()
