"""Hacia dónde apunta la malla del pie respecto del tobillo."""

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\jalon-abierto.glb")
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers))
action = bpy.data.actions["Jalón polea agarre abierto"]
arm.animation_data_create()
arm.animation_data.action = action
arm.animation_data.action_slot = list(action.slots)[0]
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(deps)
mw = ev.matrix_world
ankle = arm.matrix_world @ arm.pose.bones["foot_l"].head
groups = {g.name: g.index for g in body.vertex_groups}
print("GRUPOS_PIE", [name for name in groups if "foot" in name or "ball" in name or "toe" in name], flush=True)
for name in ("foot_l", "ball_l"):
    index = groups.get(name)
    if index is None:
        continue
    pts = []
    for vert in body.data.vertices:
        for el in vert.groups:
            if el.group == index and el.weight > 0.4:
                pts.append(mw @ ev.data.vertices[vert.index].co)
                break
    if not pts:
        print(name, "vacio", flush=True)
        continue
    center = sum(pts, Vector()) / len(pts)
    far = max(pts, key=lambda p: (p - ankle).length)
    print(
        name, "n", len(pts),
        "centro", tuple(round(c, 3) for c in (center - ankle)),
        "lejos", tuple(round(c, 3) for c in (far - ankle)),
        "z", round(min(p.z for p in pts), 3), round(max(p.z for p in pts), 3),
        flush=True,
    )
