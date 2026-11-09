"""Comprueba el jalón dentro del atlas y quita el asiento duplicado."""

import bpy
from mathutils import Vector

ESTUDIO = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
LABEL = "Jalón polea agarre abierto"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ESTUDIO)
extra = bpy.data.objects.get("asiento_jalon-abierto.001")
if extra:
    print("SOBRA", extra.name, extra.type, tuple(round(c, 3) for c in extra.location), flush=True)
    bpy.data.objects.remove(extra, do_unlink=True)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
action = bpy.data.actions.get(LABEL)
print("ACCION", action.name if action else None, flush=True)
if action is None:
    raise SystemExit(1)
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
bar = bpy.data.objects["bar_jalon-abierto"]
for frame in (1, 73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    head = arm.matrix_world @ arm.pose.bones["head"].head
    ball = arm.matrix_world @ arm.pose.bones["ball_l"].tail
    origin = bar.matrix_world.translation
    print(
        "ATLAS", frame,
        "barra", tuple(round(c, 3) for c in origin),
        "cabeza", tuple(round(c, 3) for c in head),
        "pie", round(ball.z, 3),
        flush=True,
    )
if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=ESTUDIO,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
    export_yup=True,
)
print("LIMPIO", flush=True)
