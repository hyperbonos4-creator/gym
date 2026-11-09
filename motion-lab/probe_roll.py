"""Busca el giro de muñeca que mete los dedos en la barra. Un solo frame."""
import bpy
from math import radians
from mathutils import Matrix, Vector

PATH = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=PATH)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
arm.animation_data.use_nla = False
arm.animation_data.action = bpy.data.actions["Press de banca"]
bar = bpy.data.objects["barra_press"]
bar.animation_data.use_nla = False
bar.animation_data.action = bpy.data.actions["Barra press"]
bpy.context.scene.frame_set(73)
bpy.context.view_layer.update()
origin = bar.matrix_world.translation.copy()
axis = Vector((1, 0, 0))
side = "r"
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
mats = {bone.name: bone.matrix.copy() for bone in arm.pose.bones}
arm.animation_data.action = None
for bone in arm.pose.bones:
    bone.matrix = mats[bone.name]
bpy.context.view_layer.update()
hand = arm.pose.bones[f"hand_{side}"]
base = hand.matrix.copy()

def roll(angle):
    world_base = arm.matrix_world @ base
    spun = Matrix.Rotation(angle, 3, axis) @ world_base.to_3x3()
    matrix = spun.to_4x4()
    matrix.translation = world_base.translation.copy()
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ matrix

def tip_delta():
    tip = arm.matrix_world @ arm.pose.bones[f"middle_03_{side}"].tail
    delta = tip - origin
    return delta - axis * delta.dot(axis)

best = (1e9, 0, 0)
for deg in range(0, 360, 15):
    for scale in (0.4, 0.7, 1.0, 1.3):
        roll(radians(deg))
        angle = radians(80 * scale)
        for finger in ("index", "middle", "ring", "pinky"):
            for index in (1, 2, 3):
                bone = arm.pose.bones[f"{finger}_0{index}_{side}"]
                bone.rotation_mode = "XYZ"
                bone.rotation_euler = (angle, 0, 0)
                bone.rotation_mode = "QUATERNION"
        bpy.context.view_layer.update()
        delta = tip_delta()
        if delta.length < best[0]:
            best = (delta.length, deg, scale, round(delta.y, 3), round(delta.z, 3))
print("BEST", best)
