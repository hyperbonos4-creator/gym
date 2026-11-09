"""Qué eje local de la mano es la palma y cuál cruza el mango."""
import bpy
from math import radians
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
bpy.context.view_layer.update()


def world(bone):
    return arm.matrix_world @ bone.matrix


for side in ("l", "r"):
    hand = arm.pose.bones[f"hand_{side}"]
    finger = arm.pose.bones[f"middle_01_{side}"]
    hw = world(hand)
    wrist = arm.matrix_world @ hand.head
    knuckle = arm.matrix_world @ finger.head
    local_knuckle = hw.to_3x3().inverted() @ (knuckle - wrist)
    print(side, "wrist_to_knuckle", tuple(round(v, 3) for v in local_knuckle))
    fw = world(finger)
    finger_x = fw.col[0].xyz.normalized()
    local_x = (hw.to_3x3().inverted() @ finger_x)
    along = (arm.matrix_world @ finger.tail - arm.matrix_world @ finger.head).normalized()
    local_along = hw.to_3x3().inverted() @ along
    print(
        side,
        "fingerX_in_hand",
        tuple(round(v, 3) for v in local_x),
        "fingerAlong_in_hand",
        tuple(round(v, 3) for v in local_along),
    )
    for index in range(1, 4):
        bone = arm.pose.bones[f"middle_0{index}_{side}"]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (radians(90), 0, 0)
    bpy.context.view_layer.update()
    hw = world(arm.pose.bones[f"hand_{side}"])
    wrist = arm.matrix_world @ arm.pose.bones[f"hand_{side}"].head
    offsets = []
    for finger_name in ("index", "middle", "ring", "pinky"):
        for index in (1, 2, 3):
            bone = arm.pose.bones[f"{finger_name}_0{index}_{side}"]
            offsets.append(arm.matrix_world @ bone.head - wrist)
        offsets.append(arm.matrix_world @ arm.pose.bones[f"{finger_name}_03_{side}"].tail - wrist)
    center = sum(offsets, Vector()) / len(offsets)
    local_curl = hw.to_3x3().inverted() @ center.normalized()
    print(side, "curl_in_hand", tuple(round(v, 3) for v in local_curl))
