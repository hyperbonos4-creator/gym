"""Mide la malla del pie y de los dedos, no solo los huesos."""

import bpy
from mathutils import Vector

ESTUDIO = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ESTUDIO)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers))
print("CUERPO", body.name, flush=True)
action = bpy.data.actions["Jalón polea agarre abierto"]
arm.animation_data_create()
arm.animation_data.action = action
slots = list(action.slots)
arm.animation_data.action_slot = slots[0]
bar = bpy.data.objects["bar_jalon-abierto"]
prop = bpy.data.actions["Prop Jalón polea agarre abierto"]
bar.animation_data_create()
bar.animation_data.action = prop
bar.animation_data.action_slot = list(prop.slots)[0]

deps = bpy.context.evaluated_depsgraph_get()


def mesh_world(obj):
    ev = obj.evaluated_get(deps)
    mat = ev.matrix_world
    return [mat @ v.co for v in ev.data.vertices]


for frame in (1, 73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    pts = mesh_world(body)
    low = sorted(pts, key=lambda p: p.z)[:8]
    print("BAJO", frame, [tuple(round(c, 3) for c in p) for p in low[:4]], flush=True)
    ankle = arm.matrix_world @ arm.pose.bones["foot_l"].head
    near = [p for p in pts if (p - ankle).length < 0.16]
    if near:
        tip = max(near, key=lambda p: (p - ankle).length)
        direction = (tip - ankle).normalized()
        print(
            "PIE_MALLA", frame,
            "tobillo", tuple(round(c, 3) for c in ankle),
            "punta", tuple(round(c, 3) for c in tip),
            "dir", tuple(round(c, 2) for c in direction),
            "zmin", round(min(p.z for p in near), 3),
            flush=True,
        )
    origin = bar.matrix_world.translation
    axis = Vector((1.0, 0.0, 0.0))
    wrist = arm.matrix_world @ arm.pose.bones["hand_l"].head
    fingers = [p for p in pts if (p - wrist).length < 0.12]
    gaps = []
    for p in fingers:
        delta = p - origin
        gaps.append((delta - axis * delta.dot(axis)).length)
    if gaps:
        print("MANO_MALLA", frame, "cerca", round(min(gaps), 3), "lejos", round(max(gaps), 3), "n", len(fingers), flush=True)
