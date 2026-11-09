import json
import os
import struct
import urllib.request

ROOT = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples"

def summarize(name):
    data = json.load(open(os.path.join(ROOT, f"{name}.qa.json"), encoding="utf-8"))
    print(f"\n== {name} duration={data['duration']}s samples={data['samples']} ==")
    interesting = [r for r in data["results"] if r["check"] != "bone_length"]
    for row in interesting:
        mark = row["status"]
        print(f"  {mark:4} {row['check']:16} {row.get('joint') or '':22} {row.get('detail')}")

for name in ("back_squat", "bicep_curl", "squat", "squat_video", "push_up"):
    summarize(name)

def head(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "fuerza-elite-lab"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return int(res.headers.get("Content-Length") or 0)

def clip_names(url, dest):
    print("\nDOWNLOAD", url)
    req = urllib.request.Request(url, headers={"User-Agent": "fuerza-elite-lab"})
    with urllib.request.urlopen(req, timeout=180) as res:
        blob = res.read()
    open(dest, "wb").write(blob)
    magic, version, length = struct.unpack_from("<III", blob, 0)
    if magic != 0x46546C67:
        print(" not a glb", magic)
        return
    offset = 12
    while offset + 8 <= len(blob):
        chunk_len, chunk_type = struct.unpack_from("<II", blob, offset)
        offset += 8
        chunk = blob[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            doc = json.loads(chunk.decode("utf-8"))
            clips = [anim.get("name") for anim in doc.get("animations", [])]
            nodes = len(doc.get("nodes", []))
            skins = len(doc.get("skins", []))
            print(f"  bytes={len(blob)} nodes={nodes} skins={skins} clips={len(clips)}")
            for clip in clips:
                print("   -", clip)
            return
    print(" no json chunk")

base = "https://raw.githubusercontent.com/Mesh2Motion/mesh2motion-app/main/static/animations/"
for filename in ("human-base-animations.glb", "human-addon-animations.glb", "human-mocap-animations.glb"):
    url = base + filename
    try:
        size = head(url)
        print("SIZE", filename, size)
    except Exception as exc:
        print("HEAD fail", filename, exc)
        size = 0
    if 0 < size < 80_000_000:
        clip_names(url, os.path.join(ROOT, filename))
    elif size:
        print(" skip download, too large")
