import json, struct

def load(path):
    with open(path, "rb") as f:
        data = f.read()
    length = struct.unpack("<III", data[:12])[2]
    off = 12
    gltf = None
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunk = data[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A:
            gltf = json.loads(chunk.decode("utf-8"))
        off += 8 + clen
    return gltf

def parent_map(gltf):
    pm = {}
    for i, n in enumerate(gltf["nodes"]):
        for c in n.get("children", []):
            pm[c] = i
    return pm

def report(tag, path, want):
    g = load(path)
    nodes = g["nodes"]
    pm = parent_map(g)
    scene = g["scenes"][g.get("scene", 0)]
    print(f"=== {tag} scene roots: {[nodes[r].get('name', r) for r in scene['nodes']]}")
    for i, n in enumerate(nodes):
        nm = n.get("name", "")
        if any(w in nm.lower() for w in want) and "mesh" in n:
            par = pm.get(i)
            parname = nodes[par].get("name") if par is not None else "ROOT"
            print(f"  {nm}  skin={n.get('skin')} parent={parname} T={n.get('translation')} R={n.get('rotation')}")
            break

report("ESTUDIO", r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb", ["cuerpo"])
report("ANATOMIA", r"C:\Users\Hide\Desktop\Gym\motion-lab\out\anatomia-anim.glb", ["musculo_"])
