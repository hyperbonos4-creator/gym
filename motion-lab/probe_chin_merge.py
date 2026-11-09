"""Comprueba que el clip nuevo quedó en el GLB del atlas."""

import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
names = sorted(action.name for action in bpy.data.actions if "Dominad" in action.name or "dominad" in action.name)
print("ACCIONES", names, flush=True)
print("MALLAS", [obj.name for obj in bpy.data.objects if "dominad" in obj.name], flush=True)
action = bpy.data.actions.get("Dominadas agarre supino")
if action is None:
    raise SystemExit("sin clip")
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
    print("SLOT", slots[0].identifier if hasattr(slots[0], "identifier") else slots[0], flush=True)
bar = bpy.data.objects.get("bar_dominadas-supino")
prop = bpy.data.actions.get("Prop Dominadas agarre supino")
if bar and prop and bar.animation_data:
    bar.animation_data.action = prop
    bar.animation_data.use_nla = False
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    skinned = any(mod.type == "ARMATURE" for mod in obj.modifiers)
    obj.hide_render = not (skinned or obj.name in ("bar_dominadas-supino", "estructura_dominadas"))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 640
scene.render.resolution_y = 800
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.09, 0.10, 0.12)
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
for frame, tag in ((1, "glb-cuelga"), (73, "glb-arriba")):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    head = arm.matrix_world @ arm.pose.bones["head"].head
    wrist = arm.matrix_world @ arm.pose.bones["hand_l"].head
    toe = arm.matrix_world @ arm.pose.bones["ball_l"].tail
    bar_z = bar.matrix_world.translation.z if bar else -1
    print(
        "PLAY", tag,
        "cabeza", round(head.z, 3),
        "muneca", round(wrist.z, 3), round(wrist.x, 3),
        "barra", round(bar_z, 3),
        "pie", round(toe.z, 3),
        flush=True,
    )
    cam.location = (0.15, -3.2, 1.45)
    direction = Vector((0.0, -0.05, 1.2)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = OUT + rf"\{tag}.png"
    bpy.ops.render.render(write_still=True)
