"""Relee el GLB exportado y comprueba si la muñeca sigue al antebrazo."""
import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
action = bpy.data.actions["Curl con mancuernas"]
arm.animation_data.action = action
arm.animation_data.use_nla = False
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")

def world(name, where="head"):
    bone = arm.pose.bones[name]
    point = bone.head if where == "head" else bone.tail
    return arm.matrix_world @ point

for frame in (1, 38, 73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    elbow = world("lowerarm_l")
    wrist = world("hand_l")
    knuckle = world("middle_01_l")
    forearm = (wrist - elbow).normalized()
    finger = (knuckle - wrist).normalized()
    print(
        "RE",
        frame,
        "dot",
        round(forearm.dot(finger), 3),
        "fore",
        tuple(round(v, 2) for v in forearm),
        "kn",
        tuple(round(v, 2) for v in (knuckle - wrist)),
    )
