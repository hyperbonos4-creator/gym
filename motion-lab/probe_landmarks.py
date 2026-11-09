"""Marcas del cuerpo en reposo, para apoyar los músculos en la piel."""

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb")
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers))
print("VERTS", len(body.data.vertices), "CARAS", len(body.data.polygons), flush=True)
print("MALLA", body.name, "MAT", [m.name for m in body.data.materials], flush=True)

def world_bone(name, where):
    bone = arm.data.bones[name]
    head = arm.matrix_world @ bone.head_local
    tail = arm.matrix_world @ bone.tail_local
    point = head if where == "head" else tail
    print(f"HUESO {name}.{where} {tuple(round(v, 3) for v in point)}", flush=True)
    return point

for name in (
    "pelvis", "spine_01", "spine_02", "spine_03", "neck", "head",
    "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l",
    "thigh_l", "calf_l",
):
    if name not in arm.data.bones:
        print("FALTA", name, flush=True)
        continue
    world_bone(name, "head")
    world_bone(name, "tail")

# Rayos desde el interior hacia adelante (-Y es el frente).
depsgraph = bpy.context.evaluated_depsgraph_get()
body_eval = body.evaluated_get(depsgraph)

def hit(origin, direction):
    ok, loc, normal, face = body_eval.ray_cast(origin, direction)
    if not ok:
        return None
    return loc, normal

print("--- FRENTE ---", flush=True)
for z in (1.35, 1.28, 1.22, 1.16, 1.10, 1.04, 0.98, 0.90, 0.75, 0.55):
    for x in (0.0, 0.06, 0.12, 0.18, 0.24):
        found = hit(Vector((x, 0.05, z)), Vector((0, -1, 0)))
        if found is None:
            print(f"miss x{x:.2f} z{z:.2f}", flush=True)
            continue
        loc, normal = found
        print(
            f"piel x{x:.2f} z{z:.2f} -> {tuple(round(v, 3) for v in loc)} n{tuple(round(v, 2) for v in normal)}",
            flush=True,
        )
