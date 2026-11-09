import json, struct, sys

path = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\anatomia-anim.glb"
with open(path, "rb") as f:
    data = f.read()

magic, ver, length = struct.unpack("<III", data[:12])
off = 12
gltf = None
while off < length:
    clen, ctype = struct.unpack("<II", data[off:off + 8])
    chunk = data[off + 8:off + 8 + clen]
    if ctype == 0x4E4F534A:  # JSON
        gltf = json.loads(chunk.decode("utf-8"))
    off += 8 + clen

nodes = gltf["nodes"]
skins = gltf.get("skins", [])
meshes = gltf["meshes"]

print("nodes", len(nodes), "skins", len(skins), "meshes", len(meshes))

# nodos con mesh + skin
skinned = []
for i, n in enumerate(nodes):
    if "mesh" in n and "skin" in n:
        skinned.append((i, n))

print("skinned nodes", len(skinned))
for i, n in skinned[:6]:
    name = n.get("name", "?")
    print(" node", i, name,
          "| T", n.get("translation"),
          "| R", n.get("rotation"),
          "| S", n.get("scale"),
          "| matrix", n.get("matrix"),
          "| skin", n.get("skin"))

# a que skin apunta cada uno, y cuantos joints
for s_i, s in enumerate(skins):
    print("skin", s_i, "joints", len(s["joints"]), "ibm acc", s.get("inverseBindMatrices"))

# nombre de los nodos raiz de escena
scene = gltf["scenes"][gltf.get("scene", 0)]
print("scene roots", [nodes[r].get("name", r) for r in scene["nodes"]])

# rig node transform
for i, n in enumerate(nodes):
    if n.get("name") == "rig":
        print("RIG node", i, "T", n.get("translation"), "R", n.get("rotation"), "S", n.get("scale"), "M", n.get("matrix"))

accs = gltf["accessors"]

# bounds de POSITION del primer musculo
first_node = skinned[0][1]
mesh = meshes[first_node["mesh"]]
prim = mesh["primitives"][0]
pos_acc = accs[prim["attributes"]["POSITION"]]
print("POSITION acc", skinned[0][1].get("name"), "min", pos_acc.get("min"), "max", pos_acc.get("max"), "count", pos_acc.get("count"))

# primera matriz IBM
import struct as _s
bviews = gltf["bufferViews"]
# localizar el buffer binario (BIN chunk)
off2 = 12
bin_data = None
while off2 < length:
    clen, ctype = _s.unpack("<II", data[off2:off2 + 8])
    if ctype == 0x004E4942:
        bin_data = data[off2 + 8:off2 + 8 + clen]
    off2 += 8 + clen
ibm_acc = accs[skins[0]["inverseBindMatrices"]]
bv = bviews[ibm_acc["bufferView"]]
start = bv.get("byteOffset", 0) + ibm_acc.get("byteOffset", 0)
m0 = _s.unpack("<16f", bin_data[start:start + 64])
print("IBM[0]", [round(x, 3) for x in m0])
print("joint[0] node", skins[0]["joints"][0], nodes[skins[0]["joints"][0]].get("name"))
