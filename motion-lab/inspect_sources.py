import json
import os
import urllib.request

ROOT = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples"
os.makedirs(ROOT, exist_ok=True)

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "fuerza-elite-lab"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.read(), res.status, res.headers.get("Content-Type", "")

# QA reports for the three candidate motions that exist
for name in ("back_squat", "bicep_curl", "squat", "squat_video", "push_up", "overhead_press"):
    url = f"https://assiamahs.github.io/opengym3d/assets/{name}.glb.qa.json"
    try:
        body, status, _ = get(url)
        path = os.path.join(ROOT, f"{name}.qa.json")
        open(path, "wb").write(body)
        data = json.loads(body)
        print("QA", name, "bytes", len(body))
        if isinstance(data, dict):
            keys = list(data.keys())[:12]
            print("  keys", keys)
            for k in ("verdict", "pass", "fails", "critical", "summary", "status"):
                if k in data:
                    print(" ", k, data[k])
    except Exception as exc:
        print("QA", name, "MISSING", type(exc).__name__, exc)

# Mesh2Motion file names that look like gym motions
tree_url = "https://api.github.com/repos/Mesh2Motion/mesh2motion-app/git/trees/main?recursive=1"
body, _, _ = get(tree_url)
tree = json.loads(body)
paths = [item["path"] for item in tree.get("tree", []) if item["path"].lower().endswith((".glb", ".gltf", ".fbx"))]
print("mesh2motion model files", len(paths))
needles = ("squat", "curl", "press", "bench", "deadlift", "lunge", "push", "row")
for path in paths:
    low = path.lower()
    if any(n in low for n in needles):
        print(" HIT", path)
print("--- sample paths ---")
for path in paths[:40]:
    print(" ", path)
