"""Inspecciona config del punto de acceso + estado ESP32 (para el caso feliz)."""
import urllib.request as u, json, sys
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass

BASE = "http://localhost:3010"

def post(path, data, tok=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    r = u.Request(BASE + path, data=json.dumps(data).encode(), method="POST", headers=h)
    return json.loads(u.urlopen(r, timeout=8).read())

def get(path, tok):
    r = u.Request(BASE + path, headers={"Authorization": "Bearer " + tok})
    return json.loads(u.urlopen(r, timeout=8).read())

tok = post("/api/v1/auth/login", {"email": "admin@office.local", "password": "ChangeMe123!"})["token"]
print("login OK\n=== PUNTOS DE ACCESO ===")
pts = get("/api/v1/access/points", tok)
for p in pts:
    keys = ["id","name","kind","controllerKind","controllerRef","cameraId",
            "matchThreshold","livenessThreshold","autoAuthorizeEnrolled"]
    print(json.dumps({k: p.get(k) for k in keys}, ensure_ascii=False, indent=2))

print("\n=== SUBJECTS ===")
try:
    subs = get("/api/v1/access/subjects", tok)
    print(f"total: {len(subs)}")
    for s in subs[:8]:
        print(" ", {k: s.get(k) for k in ["id","displayName","name","consentStatus","enrolled"]})
except Exception as e:
    print("subjects err", getattr(e, "code", e))

print("\n=== ESP32 192.168.100.119 ===")
for path in ["/health", "/api/status"]:
    try:
        r = u.urlopen("http://192.168.100.119" + path, timeout=3)
        print(path, "->", r.status, r.read(200).decode("utf-8", "replace"))
    except Exception as e:
        print(path, "->", getattr(e, "code", e))
