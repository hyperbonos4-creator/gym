"""Medidas en reposo para colocar la dominada supina."""
import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
bpy.context.view_layer.update()


def world(name, where="head"):
    return arm.matrix_world @ getattr(arm.pose.bones[name], where)


names = [
    "pelvis", "spine_03", "neck_01", "head",
    "upperarm_l", "lowerarm_l", "hand_l",
    "upperarm_r", "lowerarm_r", "hand_r",
    "thigh_l", "calf_l", "foot_l", "ball_l",
]
for name in names:
    bone = arm.pose.bones[name]
    head = world(name, "head")
    tail = world(name, "tail")
    print(
        name,
        "head", tuple(round(v, 3) for v in head),
        "tail", tuple(round(v, 3) for v in tail),
        "len", round(bone.length, 3),
    )

shoulder = world("upperarm_l", "head")
elbow = world("lowerarm_l", "head")
wrist = world("hand_l", "head")
reach = (elbow - shoulder).length + (wrist - elbow).length
print("REACH", round(reach, 3))
print("SHOULDER_X", round(shoulder.x, 3))
head = world("head", "head")
print("HEAD_ABOVE_SHOULDER", round(head.z - shoulder.z, 3))
ankle = world("calf_l", "tail")
print("ANKLE_Z", round(ankle.z, 3))
foot = world("foot_l", "head")
ball = world("ball_l", "head")
print("FOOT", tuple(round(v, 3) for v in foot), "BALL", tuple(round(v, 3) for v in ball))
