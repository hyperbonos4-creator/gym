import os, sys, zipfile, urllib.request, subprocess, json, time

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.abspath(os.path.dirname(__file__))
NG_DIR = os.path.join(HERE, "ngrok")
os.makedirs(NG_DIR, exist_ok=True)
NG_EXE = os.path.join(NG_DIR, "ngrok.exe")
TOKEN = os.environ.get("NGROK_TOKEN", "")

def download():
    if os.path.exists(NG_EXE):
        print("ngrok ya existe:", NG_EXE)
        return
    url = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
    zp = os.path.join(NG_DIR, "ngrok.zip")
    print("Descargando ngrok...")
    urllib.request.urlretrieve(url, zp)
    with zipfile.ZipFile(zp) as z:
        z.extractall(NG_DIR)
    print("Extraido:", os.path.exists(NG_EXE), os.path.getsize(NG_EXE) if os.path.exists(NG_EXE) else 0)

def main():
    download()
    if TOKEN:
        r = subprocess.run([NG_EXE, "config", "add-authtoken", TOKEN], capture_output=True, text=True)
        print("authtoken:", (r.stdout + r.stderr).strip()[:200])
    v = subprocess.run([NG_EXE, "version"], capture_output=True, text=True)
    print("version:", (v.stdout + v.stderr).strip())

if __name__ == "__main__":
    main()
