"""Huesos, piel del pecho y piezas cerca de la cabeza en el press."""

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb")
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name == "cuerpo")
print("BONES", " ".join(sorted(bone.name for bone in arm.data.bones)), flush=True)

def say(label, point):
    print(label, tuple(round(float(v), 3) for v in point), flush=True)

deps = bpy.context.evaluated_depsgraph_get()
body_eval = body.evaluated_get(deps)

def hit(origin, direction):
    ok, loc, normal, _face = body_eval.ray_cast(origin, direction)
    if not ok:
        return None
    return loc, normal

print("--- PIEL ---", flush=True)
for z in (0.78, 0.82, 0.86, 0.90, 0.94):
    for x in (0.02, 0.06, 0.10, 0.14, 0.18):
        found = hit(Vector((x, -0.4, z)), Vector((0.0, 1.0, 0.0)))
        if found is None:
            print(f"miss x{x:.2f} z{z:.2f}", flush=True)
            continue
        loc, normal = found
        say(f"piel x{x:.2f} z{z:.2f}", loc)
        say("  n", normal)

action = bpy.data.actions["Press de banca con mancuernas"]
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
head = arm.matrix_world @ arm.pose.bones["head"].head
say("HEAD", head)
print("--- CERCA DE LA CABEZA ---", flush=True)
for obj in bpy.data.objects:
    if obj.type != "MESH" or obj.name == "cuerpo":
        continue
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    center = sum(corners, Vector()) / 8
    if (center - head).length > 0.45:
        continue
    size = max((corners[0] - corners[6]).length, 0.001)
    print(
        f"NEAR {obj.name} d {(center - head).length:.2f} size {size:.3f} at",
        tuple(round(float(v), 3) for v in center),
        flush=True,
    )
