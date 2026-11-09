"""Render limpio del GLB de anatomia animada, en reposo y en el curl."""

import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\anatomia-anim.glb"
STILL = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
muscles = [o for o in meshes if o.name.startswith("musculo_")]
print("MALLAS", len(meshes), "musculos", len(muscles), "acciones", len(bpy.data.actions), flush=True)
for o in meshes:
    o.hide_render = o.name.startswith("hueso_")

scene = bpy.context.scene
scene.render.resolution_x = 640
scene.render.resolution_y = 900
scene.view_settings.view_transform = "Standard"
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.16, 0.17, 0.19)
sun = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", "SUN"))
sun.data.energy = 4.5
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (0.9, 0.2, 0.6)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
bpy.context.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
cam.location = (0.0, 0.9, 3.4)
aim = Vector((0.0, 0.9, 0.5)) - Vector(cam.location)
cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()


def play(action_name, frame):
    if action_name:
        act = bpy.data.actions.get(action_name)
        if act:
            if not arm.animation_data:
                arm.animation_data_create()
            arm.animation_data.action = act
            if act.slots:
                arm.animation_data.action_slot = act.slots[0]
    scene.frame_set(frame)
    bpy.context.view_layer.update()


play(None, 1)
scene.render.filepath = STILL + r"\anim2-reposo.png"
bpy.ops.render.render(write_still=True)
print("FOTO reposo", flush=True)

play("Curl con mancuernas", 73)
scene.render.filepath = STILL + r"\anim2-curl.png"
bpy.ops.render.render(write_still=True)
print("FOTO curl", flush=True)

play("Press de banca con mancuernas", 73)
scene.render.filepath = STILL + r"\anim2-press.png"
bpy.ops.render.render(write_still=True)
print("FOTO press", flush=True)
