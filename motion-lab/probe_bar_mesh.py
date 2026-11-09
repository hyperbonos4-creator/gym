"""Caja del mesh de las dos barras del jalón."""

import json
import struct

path = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
with open(path, "rb") as handle:
    data = handle.read()
json_len = struct.unpack_from("<I", data, 12)[0]
doc = json.loads(data[20 : 20 + json_len])
bin_start = 20 + json_len
bin_len = struct.unpack_from("<I", data, bin_start)[0]
blob = data[bin_start + 8 : bin_start + 8 + bin_len]

for node in doc["nodes"]:
    name = node.get("name", "")
    if "jalon" not in name and name != "asiento" and "asiento_jalon" not in name:
        continue
    mesh = doc["meshes"][node["mesh"]] if "mesh" in node else None
    print("NODE", name, "t", [round(v, 3) for v in node.get("translation", [0, 0, 0])], "r", [round(v, 3) for v in node.get("rotation", [0, 0, 0, 1])], "s", node.get("scale"))
    if mesh is None:
        continue
    mins, maxs = None, None
    for prim in mesh["primitives"]:
        acc = doc["accessors"][prim["attributes"]["POSITION"]]
        print("  bounds", [round(v, 3) for v in acc["min"]], [round(v, 3) for v in acc["max"]])
