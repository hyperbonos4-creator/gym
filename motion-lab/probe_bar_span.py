"""Recorrido real de las dos barras, de punta a punta."""

import json
import struct

path = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
with open(path, "rb") as handle:
    data = handle.read()
json_len = struct.unpack_from("<I", data, 12)[0]
doc = json.loads(data[20 : 20 + json_len])
bin_start = 20 + json_len
bin_len = struct.unpack_from("<I", data, bin_start)[0]
blob = data[bin_start + 8 : bin_start + 8 + bin_len]
nodes = [node.get("name", "") for node in doc["nodes"]]
parents = {}
for index, node in enumerate(doc["nodes"]):
    for child in node.get("children", []):
        parents[child] = nodes[index]


def read_accessor(index):
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    kind = acc["type"]
    comps = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[kind]
    fmt = {5126: "f"}[acc["componentType"]]
    stride = view.get("byteStride") or 4 * comps
    out = []
    for i in range(count):
        out.append(struct.unpack_from("<" + fmt * comps, blob, start + i * stride))
    return out


for anim in doc["animations"]:
    name = anim.get("name", "")
    if "Jal" not in name:
        continue
    print("==", name)
    for channel in anim["channels"]:
        node = nodes[channel["target"]["node"]]
        path_name = channel["target"]["path"]
        if "bar_jalon" not in node:
            continue
        sampler = anim["samplers"][channel["sampler"]]
        values = read_accessor(sampler["output"])
        cols = list(zip(*values))
        span = [round(max(col) - min(col), 3) for col in cols]
        print(" ", node, path_name, "parent", parents.get(channel["target"]["node"]), "span", span, "first", tuple(round(v, 3) for v in values[0]), "mid", tuple(round(v, 3) for v in values[len(values) // 2]))
