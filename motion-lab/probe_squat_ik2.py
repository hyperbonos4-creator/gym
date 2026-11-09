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

arm = load()

def world_point(arm, name, where):
    bpy.context.view_layer.update()
    return arm.matrix_world @ getattr(arm.pose.bones[name], where)

ankles = {side: world_point(arm, f"calf_{side}", "tail").copy() for side in ("l", "r")}
knees = {side: world_point(arm, f"calf_{side}", "head").copy() for side in ("l", "r")}

def trial(angle_deg, out, forward):
    rig = load()
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        target = bpy.data.objects.new(f"foot_{side}", None)
        bpy.context.collection.objects.link(target)
        target.location = ankles[side]
        pole = bpy.data.objects.new(f"pole_{side}", None)
        bpy.context.collection.objects.link(pole)
        knee = knees[side]
        pole.location = Vector((knee.x + sign * out, knee.y - forward, knee.z))
        ik = rig.pose.bones[f"calf_{side}"].constraints.new("IK")
        ik.target = target
        ik.pole_target = pole
        ik.chain_count = 2
        ik.pole_angle = radians(angle_deg)
    rig.location = Vector((0, 0.08, -0.34))
    bpy.context.view_layer.update()
    score = 0
    bits = []
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        knee = world_point(rig, f"calf_{side}", "head")
        bits.append(f"{side}({knee.x:.2f},{knee.y:.2f},{knee.z:.2f})")
        forwardness = -knee.y
        spread = knee.x * sign
        score += forwardness + spread
        if forwardness < 0.05:
            score -= 2
        if spread < 0.08:
            score -= 2
    print(f"a={angle_deg:4} out={out:.2f} fwd={forward:.2f} score={score:.2f} " + " ".join(bits))

for angle in (-120, -90, -60, -30, 60, 90, 120):
    for out in (0.0, 0.18, 0.35):
        trial(angle, out, 0.55)
