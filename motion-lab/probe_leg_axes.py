"""Ejes de reposo de muslo, espinilla y pie, izquierda contra derecha."""
import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
bpy.context.view_layer.update()
for name in ("thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r"):
    bone = arm.pose.bones[name]
    world = arm.matrix_world @ bone.matrix
    x = world.col[0].xyz.normalized()
    y = world.col[1].xyz.normalized()
    z = world.col[2].xyz.normalized()
    print(
        name,
        "X", tuple(round(c, 2) for c in x),
        "Y", tuple(round(c, 2) for c in y),
        "Z", tuple(round(c, 2) for c in z),
        flush=True,
    )
