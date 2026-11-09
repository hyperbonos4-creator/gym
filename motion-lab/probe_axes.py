import bpy
from math import radians
from mathutils import Euler

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
for obj in list(bpy.data.objects):
    if obj.type == "MESH" and obj.name == "Icosphere":
        bpy.data.objects.remove(obj, do_unlink=True)

arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")

def world_tail(name):
    bone = arm.pose.bones[name]
    bpy.context.view_layer.update()
    return arm.matrix_world @ bone.tail

print("ENGINES", [item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items])
print("REST hand_l", tuple(round(v, 3) for v in world_tail("hand_l")))
print("REST calf_l", tuple(round(v, 3) for v in world_tail("calf_l")))
print("REST foot_l", tuple(round(v, 3) for v in world_tail("foot_l")))

for bone_name in ("lowerarm_l", "thigh_l"):
    bone = arm.pose.bones[bone_name]
    bone.rotation_mode = "XYZ"
    for axis in range(3):
        bone.rotation_euler = (0, 0, 0)
        angles = [0, 0, 0]
        angles[axis] = radians(35)
        bone.rotation_euler = Euler(angles, "XYZ")
        bpy.context.view_layer.update()
        child = "hand_l" if bone_name.startswith("lower") else "calf_l"
        print(bone_name, "XYZ"[axis], tuple(round(v, 3) for v in world_tail(child)))
    bone.rotation_euler = (0, 0, 0)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 900
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("World")
scene.world = world
world.color = (0.08, 0.09, 0.11)

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 50
cam = bpy.data.objects.new("Cam", cam_data)
bpy.context.collection.objects.link(cam)
scene.camera = cam
cam.location = (0.0, -3.2, 0.95)
cam.rotation_euler = (radians(90), 0, 0)
light_data = bpy.data.lights.new("Key", "AREA")
light_data.energy = 250
light = bpy.data.objects.new("Key", light_data)
bpy.context.collection.objects.link(light)
light.location = (1.2, -2.0, 2.4)

bpy.ops.object.mode_set(mode="OBJECT")
scene.render.filepath = OUT + r"\rest-front.png"
bpy.ops.render.render(write_still=True)
cam.location = (3.1, -0.2, 0.95)
cam.rotation_euler = (radians(90), 0, radians(90))
scene.render.filepath = OUT + r"\rest-side.png"
bpy.ops.render.render(write_still=True)
print("RENDERED")
