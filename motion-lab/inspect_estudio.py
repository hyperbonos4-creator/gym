import json, struct

path = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
with open(path, "rb") as f:
    data = f.read()

magic, ver, length = struct.unpack("<III", data[:12])
off = 12
gltf = None
bin_data = None
while off < length:
    clen, ctype = struct.unpack("<II", data[off:off + 8])
    chunk = data[off + 8:off + 8 + clen]
    if ctype == 0x4E4F534A:
        gltf = json.loads(chunk.decode("utf-8"))
    elif ctype == 0x004E4942:
        bin_data = chunk
    off += 8 + clen

nodes = gltf["nodes"]
meshes = gltf["meshes"]
accs = gltf["accessors"]
bviews = gltf["bufferViews"]
skins = gltf.get("skins", [])

print("nodes", len(nodes), "skins", len(skins))

# rig
for i, n in enumerate(nodes):
    if n.get("name") == "rig":
        print("RIG", i, "T", n.get("translation"), "R", n.get("rotation"), "S", n.get("scale"))

# cuerpo node + bounds
for i, n in enumerate(nodes):
    nm = n.get("name", "")
    if nm.lower().startswith("cuerpo") and "mesh" in n:
        mesh = meshes[n["mesh"]]
        pa = accs[mesh["primitives"][0]["attributes"]["POSITION"]]
        print("CUERPO node", i, nm, "skin", n.get("skin"),
              "T", n.get("translation"), "R", n.get("rotation"), "S", n.get("scale"))
        print("  POSITION min", pa.get("min"), "max", pa.get("max"), "count", pa.get("count"))

# primera IBM del skin
if skins:
    s = skins[0]
    print("skin joints", len(s["joints"]), "joint0", nodes[s["joints"][0]].get("name"))
    ibm_acc = accs[s["inverseBindMatrices"]]
    bv = bviews[ibm_acc["bufferView"]]
    start = bv.get("byteOffset", 0) + ibm_acc.get("byteOffset", 0)
    m0 = struct.unpack("<16f", bin_data[start:start + 64])
    print("IBM[0]", [round(x, 3) for x in m0])
