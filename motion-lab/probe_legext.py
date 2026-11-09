"""Comprueba el clip de la extensión de pierna dentro del GLB del atlas."""

import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
names = sorted(action.name for action in bpy.data.actions if "xtensi" in action.name or "odillo" in action.name)
print("ACCIONES", names, flush=True)
print("MALLAS", [obj.name for obj in bpy.data.objects if "extension" in obj.name or obj.name == "asiento"], flush=True)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
action = bpy.data.actions.get("Extensión de pierna en máquina")
if action is None:
    raise SystemExit("sin clip")
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
roller = bpy.data.objects.get("rodillo_extension")
prop = bpy.data.actions.get("Rodillo extensión")
print("RODILLO_ACCION", prop.name if prop else "-", flush=True)
if roller and prop and roller.animation_data:
    roller.animation_data.action = prop
    if slots and hasattr(roller.animation_data, "action_slot"):
        rslots = list(getattr(prop, "slots", []) or [])
        if rslots:
            roller.animation_data.action_slot = rslots[0]
for frame, tag in ((1, "flex"), (73, "ext")):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    knee_l = arm.matrix_world @ arm.pose.bones["calf_l"].head
    knee_r = arm.matrix_world @ arm.pose.bones["calf_r"].head
    ankle_l = arm.matrix_world @ arm.pose.bones["calf_l"].tail
    ankle_r = arm.matrix_world @ arm.pose.bones["calf_r"].tail
    hip = arm.matrix_world @ arm.pose.bones["thigh_l"].head
    bar = roller.matrix_world.translation if roller else Vector()
    print(
        "PLAY", tag,
        "rodilla_x", round(knee_l.x - hip.x, 3), round(abs(knee_r.x), 3),
        "tobillo", round(ankle_l.z, 3), round(ankle_r.z, 3),
        "rodillo", round(bar.y, 3), round(bar.z, 3),
        flush=True,
    )
