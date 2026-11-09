"""Primer plano de las manos con la acción asignada, no con las pistas NLA."""
import bpy
from mathutils import Vector

OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out"
PATH = OUT + r"\estudio.glb"
SHOTS = [
    ("sentadilla", "Sentadilla con barra", "Barra sentadilla", ["barra_sentadilla"], 1, "hand_l"),
    ("sentadilla", "Sentadilla con barra", "Barra sentadilla", ["barra_sentadilla"], 73, "hand_l"),
    ("curl", "Curl con mancuernas", None, ["mancuerna_l", "mancuerna_r"], 1, "hand_l"),
    ("curl", "Curl con mancuernas", None, ["mancuerna_l", "mancuerna_r"], 73, "hand_r"),
    ("press", "Press de banca", "Barra press", ["barra_press", "banco"], 1, "hand_l"),
    ("press", "Press de banca", "Barra press", ["barra_press", "banco"], 73, "hand_r"),
]
PROPS = {"barra_sentadilla", "barra_press", "banco", "mancuerna_l", "mancuerna_r"}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=PATH)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 800
scene.render.resolution_y = 800
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.07, 0.09, 0.12)
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 50
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
light_data.energy = 250
light_data.size = 2
light = bpy.data.objects.new("Key", light_data)
bpy.context.collection.objects.link(light)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
arm.animation_data.use_nla = False

for key, body, prop, show, frame, bone in SHOTS:
    arm.animation_data.action = bpy.data.actions[body]
    for obj in bpy.data.objects:
        if obj.type == "MESH" and obj.name in PROPS:
            obj.hide_render = obj.name not in show
        if prop and obj.animation_data and obj.animation_data.action and obj.animation_data.action.name == prop:
            obj.animation_data.use_nla = False
    if prop and prop in bpy.data.objects:
        holder = bpy.data.objects[prop]
        if not holder.animation_data:
            holder.animation_data_create()
        holder.animation_data.use_nla = False
        holder.animation_data.action = bpy.data.actions[prop]
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    head = arm.matrix_world @ arm.pose.bones[bone].head
    aim.location = head
    cam.location = head + Vector((0.18, -0.34, -0.02))
    light.location = cam.location + Vector((0.2, -0.2, 0.4))
    scene.render.filepath = OUT + rf"\mano-{key}-f{frame:02d}.png"
    bpy.ops.render.render(write_still=True)
    print("MANO", key, frame)
