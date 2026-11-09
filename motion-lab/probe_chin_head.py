"""Mide si la cabeza cruza la barra o un poste en la dominada."""
import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
action = bpy.data.actions.get("Dominadas agarre supino")
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
bar = bpy.data.objects.get("bar_dominadas-supino")
prop = bpy.data.actions.get("Prop Dominadas agarre supino")
if bar and prop:
    bar.animation_data_create()
    bar.animation_data.action = prop
    bar.animation_data.use_nla = False
    rslots = list(getattr(prop, "slots", []) or [])
    if rslots and hasattr(bar.animation_data, "action_slot"):
        bar.animation_data.action_slot = rslots[0]
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and any(m.type == "ARMATURE" for m in obj.modifiers))
station = bpy.data.objects.get("estructura_dominadas")
print("BAR", None if bar is None else tuple(round(c, 3) for c in bar.location), "dims", None if bar is None else tuple(round(c, 3) for c in bar.dimensions), flush=True)
print("STATION", None if station is None else tuple(round(c, 3) for c in station.location), flush=True)
for frame in (1, 30, 40, 50, 60, 73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    head = arm.matrix_world @ arm.pose.bones["head"].head
    bar_p = bar.matrix_world.translation.copy()
    # Distancia de la cabeza al eje de la barra (la barra va en X).
    delta = head - bar_p
    radial = Vector((0.0, delta.y, delta.z)).length
    print(
        "HEAD", frame,
        "cabeza", tuple(round(c, 3) for c in head),
        "barra", tuple(round(c, 3) for c in bar_p),
        "dy", round(head.y - bar_p.y, 3),
        "dz", round(head.z - bar_p.z, 3),
        "radio", round(radial, 3),
        flush=True,
    )
depsgraph = bpy.context.evaluated_depsgraph_get()
for frame in (30, 40, 50, 60, 73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    head = arm.matrix_world @ arm.pose.bones["head"].head
    eval_obj = body.evaluated_get(depsgraph)
    mesh = eval_obj.to_mesh()
    bar_p = bar.matrix_world.translation.copy()
    worst = None
    for vert in mesh.vertices:
        world = eval_obj.matrix_world @ vert.co
        if (world - head).length > 0.22:
            continue
        delta = world - bar_p
        radial = Vector((0.0, delta.y, delta.z)).length
        if worst is None or radial < worst[0]:
            worst = (radial, world.copy())
    eval_obj.to_mesh_clear()
    print("CARA", frame, None if worst is None else (round(worst[0], 3), tuple(round(c, 3) for c in worst[1])), flush=True)
