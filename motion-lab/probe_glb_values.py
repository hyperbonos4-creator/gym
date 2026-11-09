"""Lee las curvas reales del jalón dentro del GLB."""

import json
import struct

import numpy as np

path = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
with open(path, "rb") as handle:
    data = handle.read()
json_len = struct.unpack_from("<I", data, 12)[0]
doc = json.loads(data[20 : 20 + json_len])
bin_start = 20 + json_len
bin_len = struct.unpack_from("<I", data, bin_start)[0]
blob = data[bin_start + 8 : bin_start + 8 + bin_len]
nodes = [node.get("name", "") for node in doc["nodes"]]

COMP = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_accessor(index):
    acc = doc["accessors"][index]
    view = doc["bufferViews"][acc["bufferView"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    count = acc["count"]
    comps = NCOMP[acc["type"]]
    fmt = COMP[acc["componentType"]]
    stride = view.get("byteStride") or struct.calcsize(fmt) * comps
    out = []
    for i in range(count):
        off = start + i * stride
        out.append(struct.unpack_from("<" + fmt * comps, blob, off))
    return out


def channels(anim_name):
    for anim in doc["animations"]:
        if anim.get("name") == anim_name:
            return anim
    raise SystemExit(anim_name)


def show(anim_name, bone, path_name, frames=(0, -1)):
    anim = channels(anim_name)
    for channel in anim["channels"]:
        node = nodes[channel["target"]["node"]]
        if node != bone or channel["target"]["path"] != path_name:
            continue
        sampler = anim["samplers"][channel["sampler"]]
        times = read_accessor(sampler["input"])
        values = read_accessor(sampler["output"])
        picked = []
        for frame in frames:
            picked.append((round(times[frame][0], 2), tuple(round(v, 3) for v in values[frame])))
        print(anim_name, bone, path_name, "n", len(values), picked)


for name in ("Jalón polea agarre abierto", "Jalón polea agarre cerrado"):
    show(name, "foot_l", "rotation", (0, -1))
    show(name, "thigh_l", "rotation", (0, -1))
    show(name, "calf_l", "rotation", (0, -1))
    show(name, "middle_01_l", "rotation", (0, -1))
    show(name, "hand_l", "rotation", (0, -1))

show("Prop Jalón polea agarre abierto", "bar_jalon-abierto", "translation", (0, -1))
show("Prop Jalón polea agarre abierto", "bar_jalon-abierto", "rotation", (0, -1))
show("Prop Jalón polea agarre cerrado", "bar_jalon-cerrado", "translation", (0, -1))
show("Prop Jalón polea agarre cerrado", "bar_jalon-cerrado", "rotation", (0, -1))
