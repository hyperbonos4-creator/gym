import bpy
from math import radians
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"

def load():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    for obj in list(bpy.data.objects):
        if obj.name == "Icosphere":
            bpy.data.objects.remove(obj, do_unlink=True)
    arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    return arm

def world_point(arm, name, where):
    bone = arm.pose.bones[name]
    bpy.context.view_layer.update()
    return arm.matrix_world @ getattr(bone, where)

arm = load()
ankles = {}
knees = {}
for side in ("l", "r"):
    ankles[side] = world_point(arm, f"calf_{side}", "tail").copy()
    knees[side] = world_point(arm, f"calf_{side}", "head").copy()

def trial(angle_deg):
    global arm
    arm = load()
    for side in ("l", "r"):
        target = bpy.data.objects.new(f"foot_{side}", None)
        bpy.context.collection.objects.link(target)
        target.location = ankles[side]
        pole = bpy.data.objects.new(f"pole_{side}", None)
        bpy.context.collection.objects.link(pole)
        knee = knees[side]
        pole.location = Vector((knee.x, knee.y - 0.5, knee.z))
        ik = arm.pose.bones[f"calf_{side}"].constraints.new("IK")
        ik.target = target
        ik.pole_target = pole
        ik.chain_count = 2
        ik.pole_angle = radians(angle_deg)
    arm.location = Vector((0, 0.06, -0.32))
    bpy.context.view_layer.update()
    parts = []
    for side in ("l", "r"):
        ankle = world_point(arm, f"calf_{side}", "tail")
        knee = world_point(arm, f"calf_{side}", "head")
        err = (ankle - ankles[side]).length
        parts.append(f"{side} knee=({knee.x:.2f},{knee.y:.2f},{knee.z:.2f}) foot_err={err:.3f}")
    print(f"ANGLE {angle_deg:7.1f}  " + " | ".join(parts))

for angle in (-180, -90, -45, 0, 45, 90, 180):
    trial(angle)
