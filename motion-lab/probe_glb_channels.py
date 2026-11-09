"""Lista los huesos que anima el jalón dentro del GLB publicado."""

import json
import struct

path = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
with open(path, "rb") as handle:
    data = handle.read()
length = struct.unpack_from("<I", data, 12)[0]
doc = json.loads(data[20 : 20 + length])
nodes = [node.get("name", "") for node in doc["nodes"]]
print("anims", len(doc.get("animations", [])))
for anim in doc.get("animations", []):
    name = anim.get("name", "")
    if "Jal" not in name and "jal" not in name:
        continue
    bones = {}
    for channel in anim["channels"]:
        node = nodes[channel["target"]["node"]]
        path_name = channel["target"]["path"]
        bones.setdefault(node, set()).add(path_name)
    interesting = [bone for bone in sorted(bones) if any(part in bone for part in ("foot", "ball", "hand", "finger", "index", "middle", "thumb", "thigh", "calf", "upper", "lower", "bar", "asiento"))]
    print("ANIM", name, "canales", len(anim["channels"]), "nodos", len(bones))
    print("  ", interesting[:80])
