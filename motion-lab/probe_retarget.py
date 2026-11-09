"""Mide el maniquí del gimnasio para alinear la anatomía de Z-Anatomy."""

import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
print("ARM", arm.name, "world", tuple(round(v, 4) for v in arm.matrix_world.translation), flush=True)
print("ARM euler", tuple(round(v, 4) for v in arm.matrix_world.to_euler()), flush=True)

body = None
for o in bpy.data.objects:
    if o.type == "MESH" and o.name.lower().startswith("cuerpo"):
        body = o
print("BODY", body.name if body else None, flush=True)
if body:
    verts = [body.matrix_world @ v.co for v in body.data.vertices]
    xs = [v.x for v in verts]; ys = [v.y for v in verts]; zs = [v.z for v in verts]
    print("BODY caja x", round(min(xs),3), round(max(xs),3),
          "y", round(min(ys),3), round(max(ys),3),
          "z", round(min(zs),3), round(max(zs),3), "verts", len(verts), flush=True)

key = ["pelvis","spine_01","spine_02","spine_03","neck_01","head",
       "clavicle_l","upperarm_l","lowerarm_l","hand_l",
       "thigh_l","calf_l","foot_l"]
for name in key:
    b = arm.data.bones.get(name)
    if not b:
        print("NO", name, flush=True); continue
    h = arm.matrix_world @ b.head_local
    t = arm.matrix_world @ b.tail_local
    print(f"{name:11} head ({h.x:6.3f},{h.y:6.3f},{h.z:6.3f}) tail ({t.x:6.3f},{t.y:6.3f},{t.z:6.3f})", flush=True)

print("ACCIONES", [a.name for a in bpy.data.actions], flush=True)
