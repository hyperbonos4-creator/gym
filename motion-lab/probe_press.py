"""Dónde está la piel respecto de los huesos, y cuánto se separa la mancuerna."""

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb")
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name == "cuerpo")
print("ARM", tuple(round(v, 3) for v in arm.matrix_world.translation), tuple(round(v, 3) for v in arm.matrix_world.to_euler()), flush=True)
print("BODY", tuple(round(v, 3) for v in body.matrix_world.translation), tuple(round(v, 3) for v in body.matrix_world.to_euler()), flush=True)
print("PARENT", body.parent.name if body.parent else "-", body.parent_type, flush=True)

def cloud(group, limit=0.45):
    index = body.vertex_groups[group].index
    pts = []
    for vert in body.data.vertices:
        weight = 0.0
        for el in vert.groups:
            if el.group == index:
                weight = el.weight
        if weight >= limit:
            pts.append(body.matrix_world @ vert.co)
    if not pts:
        print(group, "vacio", flush=True)
        return
    xs = [p.x for p in pts]
    ys = [p.y for p in pts]
    zs = [p.z for p in pts]
    bone = arm.matrix_world @ arm.data.bones[group].head_local
    print(
        group, "n", len(pts),
        "x", round(min(xs), 3), round(max(xs), 3),
        "y", round(min(ys), 3), round(max(ys), 3),
        "z", round(min(zs), 3), round(max(zs), 3),
        "hueso", tuple(round(v, 3) for v in bone),
        flush=True,
    )

for name in ("spine_03", "clavicle_l", "upperarm_l", "lowerarm_l", "thigh_l", "pelvis"):
    if name in body.vertex_groups:
        cloud(name)

bells = [obj.name for obj in bpy.data.objects if "press-banca-mancuernas" in obj.name]
print("BELLS", bells, flush=True)
for name in bells:
    obj = bpy.data.objects[name]
    print("PARENT", name, obj.parent.name if obj.parent else "-", obj.parent_type, getattr(obj, "parent_bone", ""), flush=True)

action = bpy.data.actions.get("Press de banca con mancuernas")
print("ACTION", action is not None, flush=True)
if action is None:
    raise SystemExit(0)
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
for frame in (1, 40, 73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    shoulder_l = arm.matrix_world @ arm.pose.bones["upperarm_l"].head
    shoulder_r = arm.matrix_world @ arm.pose.bones["upperarm_r"].head
    hips = arm.matrix_world @ arm.pose.bones["pelvis"].head
    head = arm.matrix_world @ arm.pose.bones["head"].head
    spine = head - hips
    hand = arm.matrix_world @ arm.pose.bones["hand_l"].head
    print(
        "FRAME", frame,
        "hombros_z", round(shoulder_l.z, 3), round(shoulder_r.z, 3),
        "eje", tuple(round(v, 3) for v in spine.normalized()),
        "mano", tuple(round(v, 3) for v in hand),
        flush=True,
    )
    for name in bells:
        obj = bpy.data.objects[name]
        gap = (obj.matrix_world.translation - hand).length
        print("  ", name, tuple(round(v, 3) for v in obj.matrix_world.translation), "gap_mano_l", round(gap, 3), flush=True)
