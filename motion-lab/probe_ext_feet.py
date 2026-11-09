"""Ejes de los pies en la extensión de pierna publicada."""
import bpy

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
action = bpy.data.actions.get("Extensión de pierna en máquina")
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
for frame in (1, 40, 73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    for side in ("l", "r"):
        world = arm.matrix_world @ arm.pose.bones[f"foot_{side}"].matrix
        toe = world.col[1].xyz.normalized()
        sole = world.col[2].xyz.normalized()
        side_axis = world.col[0].xyz.normalized()
        print(
            "FOOT", frame, side,
            "dedos", tuple(round(c, 2) for c in toe),
            "planta", tuple(round(c, 2) for c in sole),
            "lado", tuple(round(c, 2) for c in side_axis),
            flush=True,
        )
