"""Reproduce el GLB exportado como lo ve el navegador: cuerpo y barra juntos."""
import bpy
from math import radians

path = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\sentadilla-barra.glb"
out = r"C:\Users\Hide\Desktop\Gym\motion-lab\out"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
bar = bpy.data.objects["barra"]
body_action = bpy.data.actions["Sentadilla con barra"]
bar_action = bpy.data.actions["barraAction"]
arm.animation_data.action = body_action
if arm.animation_data.nla_tracks:
    for track in arm.animation_data.nla_tracks:
        track.mute = True
bar.animation_data.action = bar_action
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.07, 0.09, 0.12)
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 42
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
light_data = bpy.data.lights.new("Key", "AREA")
light_data.energy = 350
light_data.size = 3
light = bpy.data.objects.new("Key", light_data)
bpy.context.collection.objects.link(light)
light.location = (1.4, -2.2, 2.4)

for frame in (1, 24):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    hip = arm.matrix_world @ arm.pose.bones["pelvis"].head
    hand_l = arm.matrix_world @ arm.pose.bones["hand_l"].head
    hand_r = arm.matrix_world @ arm.pose.bones["hand_r"].head
    center = bar.matrix_world.translation
    print(
        "FRAME", frame,
        "hip_z", round(hip.z, 3),
        "bar", tuple(round(v, 3) for v in center),
        "bar_rot", tuple(round(v, 3) for v in bar.matrix_world.to_euler()),
        "gap_l", round((hand_l - center).length, 3),
        "gap_r", round((hand_r - center).length, 3),
    )
    cam.location = (1.8, -1.8, 2.5)
    cam.rotation_euler = (radians(55), 0, radians(40))
    scene.render.filepath = out + rf"\sentadilla-export-{frame}.png"
    bpy.ops.render.render(write_still=True)
