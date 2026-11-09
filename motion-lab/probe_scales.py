"""Qué cierre deja la punta al otro lado de la barra."""
import bpy
from math import radians
from mathutils import Vector

PATH = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=PATH)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
arm.animation_data.use_nla = False
arm.animation_data.action = bpy.data.actions["Sentadilla con barra"]
bar = bpy.data.objects["barra_sentadilla"]
bar.animation_data.use_nla = False
bar.animation_data.action = bpy.data.actions["Barra sentadilla"]
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
origin = bar.matrix_world.translation.copy()
axis = Vector((1, 0, 0))
side = "l"
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
mats = {bone.name: bone.matrix.copy() for bone in arm.pose.bones}
arm.animation_data.action = None
for bone in arm.pose.bones:
    bone.matrix = mats[bone.name]
bpy.context.view_layer.update()

def gap():
    tip = arm.matrix_world @ arm.pose.bones[f"middle_03_{side}"].tail
    delta = tip - origin
    delta = delta - axis * delta.dot(axis)
    return delta

for scale in (0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0):
    angle = radians(90 * scale)
    for finger in ("index", "middle", "ring", "pinky"):
        for index in (1, 2, 3):
            bone = arm.pose.bones[f"{finger}_0{index}_{side}"]
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = (angle, 0, 0)
            bone.rotation_mode = "QUATERNION"
    bpy.context.view_layer.update()
    delta = gap()
    print(f"scale {scale:.2f} dyz ({delta.y:.3f}, {delta.z:.3f}) dist {delta.length:.3f}")
