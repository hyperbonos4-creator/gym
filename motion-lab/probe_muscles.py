"""Ejes locales del brazo y del pecho, para pintar el músculo en rojo."""

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb")
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers))
print("HUESOS", [b.name for b in arm.data.bones if b.name.startswith(("spine", "clav", "upper", "lower"))], flush=True)

def local_cloud(bone_name, limit=0.35):
    bone = arm.data.bones[bone_name]
    inv = (arm.matrix_world @ bone.matrix_local).inverted()
    index = body.vertex_groups[bone_name].index
    pts = []
    for vert in body.data.vertices:
        weight = 0.0
        for el in vert.groups:
            if el.group == index:
                weight = el.weight
        if weight < limit:
            continue
        pts.append(inv @ body.matrix_world @ vert.co)
    if not pts:
        print(bone_name, "vacio", flush=True)
        return
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    world = arm.matrix_world @ bone.matrix_local
    def side(axis, sign):
        chosen = [p for p in pts if (p.x if axis == 0 else p.z) * sign > 0.01]
        if not chosen:
            return None
        center = sum((world @ p for p in chosen), Vector()) / len(chosen)
        return round(center.y, 3), round(center.z, 3)
    print(
        bone_name, "n", len(pts),
        "+x", side(0, 1), "-x", side(0, -1),
        "+z", side(2, 1), "-z", side(2, -1),
        flush=True,
    )

for name in ("upperarm_l", "lowerarm_l", "spine_03", "clavicle_l"):
    local_cloud(name)
