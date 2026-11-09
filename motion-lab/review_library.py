"""Renderiza el GLB único, un ejercicio por vez."""
import bpy
from mathutils import Vector

OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out"
PATH = OUT + r"\estudio-web.glb"
SHOTS = [
    ("sentadilla", ["Sentadilla con barra", "Barra sentadilla"], ["barra_sentadilla"], 73, "abajo", (3.2, 0.1, 1.2), (0, 0.85, 0)),
    ("curl", ["Curl con mancuernas"], ["mancuerna_l", "mancuerna_r"], 73, "arriba", (0.1, -3.2, 1.3), (0, 0.95, 0)),
    ("press", ["Press de banca", "Barra press"], ["barra_press", "banco"], 73, "arriba", (3.2, 0.8, 1.0), (0, 0.75, 0.5)),
    ("press", ["Press de banca", "Barra press"], ["barra_press", "banco"], 1, "pecho", (3.2, 0.8, 1.0), (0, 0.75, 0.5)),
]
PROPS = {"barra_sentadilla", "barra_press", "banco", "mancuerna_l", "mancuerna_r"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=PATH)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.fps = 24
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.07, 0.09, 0.12)
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 42
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
aim = bpy.data.objects.new("Aim", None)
bpy.context.collection.objects.link(aim)
track = cam.constraints.new("TRACK_TO")
track.target = aim
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"
light_data = bpy.data.lights.new("Key", "AREA")
light_data.energy = 400
light_data.size = 3
light = bpy.data.objects.new("Key", light_data)
bpy.context.collection.objects.link(light)
light.location = (1.4, -2.2, 2.6)

for key, names, show, frame, tag, loc, target in SHOTS:
    for obj in bpy.data.objects:
        if obj.animation_data:
            for nla in obj.animation_data.nla_tracks:
                nla.mute = nla.name not in names
        if obj.type == "MESH" and obj.name in PROPS:
            obj.hide_render = obj.name not in show
    cam.location = loc
    aim.location = Vector(target)
    scene.frame_set(frame)
    scene.render.filepath = OUT + rf"\lib-{key}-{tag}.png"
    bpy.ops.render.render(write_still=True)
    print("SHOT", key, tag)
