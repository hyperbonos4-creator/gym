"""Ejes de la mano en reposo y hacia dónde se cierra el puño."""
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

def cols(bone):
    m = arm.matrix_world @ bone.matrix
    return [tuple(round(v, 2) for v in m.col[i].xyz) for i in range(3)]

for side in ("l", "r"):
    hand = arm.pose.bones[f"hand_{side}"]
    finger = arm.pose.bones[f"middle_01_{side}"]
    print(side, "hand", cols(hand), "fingerX", cols(finger)[0])

# Cierra la izquierda y mira a dónde va la punta.
side = "l"
for name_i in range(1, 4):
    bone = arm.pose.bones[f"middle_0{name_i}_{side}"]
    bone.rotation_mode = "XYZ"
    bone.rotation_euler = (radians(80), 0, 0)
bpy.context.view_layer.update()
wrist = arm.matrix_world @ arm.pose.bones[f"hand_{side}"].head
tip = arm.matrix_world @ arm.pose.bones[f"middle_03_{side}"].tail
knuckle = arm.matrix_world @ arm.pose.bones[f"middle_01_{side}"].head
print("curl delta tip-wrist", tuple(round(v, 3) for v in (tip - wrist)))
print("curl delta knuckle-tip", tuple(round(v, 3) for v in (knuckle - tip)))
