"""Posición del esqueleto y un render del jalón tal como quedó en el GLB."""

import bpy
from mathutils import Vector

ESTUDIO = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ESTUDIO)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
print("ARM_LOC", tuple(round(c, 3) for c in arm.location), flush=True)
action = bpy.data.actions["Jalón polea agarre abierto"]
arm.animation_data_create()
arm.animation_data.action = action
slots = list(getattr(action, "slots", []) or [])
if slots and hasattr(arm.animation_data, "action_slot"):
    arm.animation_data.action_slot = slots[0]
    print("SLOT", slots[0].identifier if hasattr(slots[0], "identifier") else slots[0], flush=True)
bar = bpy.data.objects["bar_jalon-abierto"]
prop = bpy.data.actions["Prop Jalón polea agarre abierto"]
bar.animation_data_create()
bar.animation_data.action = prop
pslots = list(getattr(prop, "slots", []) or [])
if pslots and hasattr(bar.animation_data, "action_slot"):
    bar.animation_data.action_slot = pslots[0]

shown = {"cuerpo", "bar_jalon-abierto", "asiento_jalon-abierto", "poste_polea"}
world = bpy.data.worlds.new("fondo")
scene_pre = bpy.context.scene
scene_pre.world = world
world.color = (0.09, 0.10, 0.12)
light_data = bpy.data.lights.new("Key", "AREA")
light_data.energy = 400
light_data.size = 3
light = bpy.data.objects.new("Key", light_data)
bpy.context.collection.objects.link(light)
light.location = (1.2, -2.2, 2.4)
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.hide_render = obj.name not in shown
scene = bpy.context.scene
scene.render.resolution_x = 720
scene.render.resolution_y = 560
scene.render.engine = "BLENDER_EEVEE"
cam_data = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam

def shoot(path, location, target):
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

for frame in (1, 73):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    hand = arm.matrix_world @ arm.pose.bones["hand_l"].head
    foot = arm.matrix_world @ arm.pose.bones["foot_l"].matrix
    ball = arm.matrix_world @ arm.pose.bones["ball_l"].tail
    print(
        "POSE", frame,
        "mano", tuple(round(c, 3) for c in hand),
        "barra", tuple(round(c, 3) for c in bar.matrix_world.translation),
        "planta", tuple(round(c, 2) for c in foot.col[2].xyz),
        "dedos", tuple(round(c, 2) for c in foot.col[1].xyz),
        "pie", round(ball.z, 3),
        flush=True,
    )
    tag = "arriba" if frame == 1 else "pecho"
    shoot(OUT + rf"\visto-{tag}-frente.png", (0.15, -3.1, 1.15), (0.0, 0.15, 0.85))
    shoot(OUT + rf"\visto-{tag}-lado.png", (2.6, -0.2, 1.05), (0.0, -0.05, 0.85))
    shoot(OUT + rf"\visto-{tag}-mano.png", (0.15, -1.15, hand.z), (hand.x, hand.y, hand.z))
