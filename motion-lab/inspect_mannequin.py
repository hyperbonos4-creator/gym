import json
import os
import struct
import urllib.request

dest = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
url = "https://www.innerscene.com/api/library/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1/download"
req = urllib.request.Request(url, headers={"User-Agent": "fuerza-elite-lab"})
with urllib.request.urlopen(req, timeout=120) as res:
    blob = res.read()
    print("status", res.status, "type", res.headers.get("Content-Type"), "bytes", len(blob))
os.makedirs(os.path.dirname(dest), exist_ok=True)
open(dest, "wb").write(blob)

magic, version, length = struct.unpack_from("<III", blob, 0)
print("magic", hex(magic), "version", version, "length", length)
offset = 12
doc = None
while offset + 8 <= len(blob):
    chunk_len, chunk_type = struct.unpack_from("<II", blob, offset)
    offset += 8
    chunk = blob[offset:offset + chunk_len]
    offset += chunk_len
    if chunk_type == 0x4E4F534A:
        doc = json.loads(chunk.decode("utf-8"))
        break
if doc is None:
    raise SystemExit("no json")

nodes = doc.get("nodes", [])
skins = doc.get("skins", [])
anims = doc.get("animations", [])
meshes = doc.get("meshes", [])
print("nodes", len(nodes), "skins", len(skins), "meshes", len(meshes), "anims", len(anims))
joint_ids = []
for skin in skins:
    joint_ids.extend(skin.get("joints", []))
joint_ids = list(dict.fromkeys(joint_ids))
print("skin joints", len(joint_ids))
names = []
for index in joint_ids:
    node = nodes[index]
    names.append(node.get("name") or f"(sin nombre {index})")
print("--- bones ---")
for name in names:
    print(name)

needed = [
    "spine", "chest", "head",
    "upperarm", "forearm", "hand",
    "thigh", "shin", "calf", "foot",
    "pelvis", "hips", "neck",
]
print("--- name hits ---")
low = [name.lower() for name in names]
for needle in needed:
    hits = [name for name in names if needle in name.lower()]
    print(f"{needle}: {len(hits)} {hits[:8]}")
