import os, sys, subprocess, json, time, urllib.request

sys.stdout.reconfigure(encoding="utf-8")
HERE = os.path.abspath(os.path.dirname(__file__))
NG_EXE = os.path.join(HERE, "ngrok", "ngrok.exe")
LOG = os.path.join(HERE, "ngrok", "ngrok.log")

def already_running():
    try:
        with urllib.request.urlopen("http://127.0.0.1:4040/api/tunnels", timeout=2) as r:
            return json.load(r)
    except Exception:
        return None

def start():
    # lanzar ngrok detach en background, log a archivo
    flags = 0x00000008 | 0x00000200  # DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
    f = open(LOG, "ab")
    subprocess.Popen(
        [NG_EXE, "http", "3010", "--log", "stdout", "--log-format", "logfmt"],
        stdout=f, stderr=f, creationflags=flags, close_fds=True,
    )

def get_url():
    for _ in range(30):
        data = already_running()
        if data and data.get("tunnels"):
            for t in data["tunnels"]:
                if t.get("proto") == "https":
                    return t["public_url"]
            return data["tunnels"][0]["public_url"]
        time.sleep(1)
    return None

if __name__ == "__main__":
    existing = already_running()
    if existing and existing.get("tunnels"):
        print("Ya corriendo.")
    else:
        start()
    url = get_url()
    print("PUBLIC_URL:", url)
    if url:
        print("Kiosko:", url + "/kiosk.html?source=webcam")
        print("Admin:", url + "/admin.html")
