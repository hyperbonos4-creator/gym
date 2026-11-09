import json
import os
import struct

folder = r"C:\Users\Hide\Desktop\Gym\motion-lab\out"
for name in os.listdir(folder):
    if not name.endswith(".glb"):
        continue
    blob = open(os.path.join(folder, name), "rb").read()
    offset = 12
    doc = None
    while offset + 8 <= len(blob):
        chunk_len, chunk_type = struct.unpack_from("<II", blob, offset)
        offset += 8
        chunk = blob[offset:offset + chunk_len]
        offset += chunk_len
        if chunk_type == 0x4E4F534A:
            doc = json.loads(chunk)
            break
    print(name, "bytes", len(blob))
    for anim in doc.get("animations", []):
        print(" ", anim.get("name"), "tracks", len(anim.get("channels", [])), "dur_max_sampler", len(anim.get("samplers", [])))
