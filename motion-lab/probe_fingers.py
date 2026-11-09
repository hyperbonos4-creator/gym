"""Confirma el cierre en las dos manos y el pulgar."""
import bpy
from math import radians

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")


def dist(side, axis_idx, sign):
    names = [f"{finger}_0{i}_{side}" for finger in ("index", "middle", "ring", "pinky") for i in (1, 2, 3)]
    for name in names:
        bone = arm.pose.bones[name]
        bone.rotation_mode = "XYZ"
        euler = [0.0, 0.0, 0.0]
        euler[axis_idx] = radians(70 * sign)
        bone.rotation_euler = euler
    bpy.context.view_layer.update()
    wrist = arm.matrix_world @ arm.pose.bones[f"hand_{side}"].head
    tip = arm.matrix_world @ arm.pose.bones[f"middle_03_{side}"].tail
    for name in names:
        arm.pose.bones[name].rotation_euler = (0, 0, 0)
    return round((tip - wrist).length, 3)


for side in ("l", "r"):
    bpy.context.view_layer.update()
    wrist = arm.matrix_world @ arm.pose.bones[f"hand_{side}"].head
    tip = arm.matrix_world @ arm.pose.bones[f"middle_03_{side}"].tail
    print(side, "rest", round((tip - wrist).length, 3))
    for axis, idx in (("X", 0), ("Z", 2)):
        for sign in (1, -1):
            print(side, f"{axis}{sign:+d}", dist(side, idx, sign))

# Pulgar izquierdo.
wrist = arm.matrix_world @ arm.pose.bones["hand_l"].head
rest = arm.matrix_world @ arm.pose.bones["thumb_03_l"].tail
print("thumb rest dist", round((rest - wrist).length, 3))
for axis, idx in (("X", 0), ("Y", 1), ("Z", 2)):
    for sign in (1, -1):
        for i in (1, 2, 3):
            bone = arm.pose.bones[f"thumb_0{i}_l"]
            bone.rotation_mode = "XYZ"
            euler = [0.0, 0.0, 0.0]
            euler[idx] = radians(40 * sign)
            bone.rotation_euler = euler
        bpy.context.view_layer.update()
        tip = arm.matrix_world @ arm.pose.bones["thumb_03_l"].tail
        print("thumb", f"{axis}{sign:+d}", "dist", round((tip - wrist).length, 3), "delta", tuple(round(v, 3) for v in (tip - rest)))
        for i in (1, 2, 3):
            arm.pose.bones[f"thumb_0{i}_l"].rotation_euler = (0, 0, 0)
