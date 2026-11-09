"""Lista huesos de la mano y sus ejes en reposo."""
import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
bpy.context.view_layer.update()

print("ALL_BONES")
for bone in arm.data.bones:
    print(bone.name)

hand = arm.pose.bones["hand_l"]
mw = arm.matrix_world @ hand.matrix
print("HAND_L_HEAD", tuple(round(v, 4) for v in (arm.matrix_world @ hand.head)))
print("HAND_L_TAIL", tuple(round(v, 4) for v in (arm.matrix_world @ hand.tail)))
print("HAND_L_X", tuple(round(v, 3) for v in mw.col[0].xyz))
print("HAND_L_Y", tuple(round(v, 3) for v in mw.col[1].xyz))
print("HAND_L_Z", tuple(round(v, 3) for v in mw.col[2].xyz))
print("HAND_LEN", round(hand.length, 4))
