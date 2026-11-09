import urllib.request as u, json, base64, sys, time

sys.stdout.reconfigure(encoding="utf-8")
BASE = "http://127.0.0.1:8080"
KEY = "gym-evolution-key"
INST = "gym"

def call(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    h = {"apikey": KEY}
    if data: h["Content-Type"] = "application/json"
    req = u.Request(BASE + path, data=data, headers=h, method=method)
    try:
        r = u.urlopen(req, timeout=15)
        raw = r.read().decode("utf-8", "ignore")
        try: return r.status, json.loads(raw)
        except: return r.status, raw
    except u.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")
    except Exception as e:
        return "ERR", str(e)

# 1) crear instancia (idempotente)
s, b = call("/instance/create", "POST", {
    "instanceName": INST, "qrcode": True, "integration": "WHATSAPP-BAILEYS",
})
print("create ->", s)
if isinstance(b, dict):
    print("   keys:", list(b.keys()))

# 2) obtener QR (connect)
qr = None
for _ in range(10):
    s, b = call(f"/instance/connect/{INST}")
    if isinstance(b, dict):
        qr = b.get("base64") or (b.get("qrcode") or {}).get("base64")
        code = b.get("code") or (b.get("qrcode") or {}).get("code")
        if qr:
            break
    time.sleep(2)

if qr:
    b64 = qr.split(",", 1)[1] if "," in qr else qr
    with open("wa_qr.png", "wb") as f:
        f.write(base64.b64decode(b64))
    print("QR guardado en wa_qr.png")
else:
    print("No se obtuvo QR. Respuesta:", str(b)[:300])
