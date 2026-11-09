"""Dónde quedan muñeca, puntas y barra. No modifica el archivo."""
import bpy
from mathutils import Vector

PATH = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
SHOTS = [
    ("Sentadilla con barra", "Barra sentadilla", "barra_sentadilla", (1, 73)),
    ("Press de banca", "Barra press", "barra_press", (1, 73)),
    ("Curl con mancuernas", None, "mancuerna_l", (1, 73)),
]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=PATH)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
arm.animation_data.use_nla = False


def axis_delta(point, origin, axis):
    delta = point - origin
    return delta - axis * delta.dot(axis)


for body, prop, obj_name, frames in SHOTS:
    arm.animation_data.action = bpy.data.actions[body]
    holder = bpy.data.objects.get(obj_name)
    if prop:
        if not holder.animation_data:
            holder.animation_data_create()
        holder.animation_data.use_nla = False
        holder.animation_data.action = bpy.data.actions[prop]
    for frame in frames:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        origin = holder.matrix_world.translation.copy()
        axis = Vector((1, 0, 0))
        print(f"--- {body} f{frame} prop {tuple(round(v, 3) for v in origin)}")
        for side in ("l", "r"):
            hand = arm.pose.bones[f"hand_{side}"]
            wrist = arm.matrix_world @ hand.head
            names = [f"middle_0{i}_{side}" for i in (1, 2, 3)]
            pts = []
            for name in names:
                bone = arm.pose.bones[name]
                pts.append(arm.matrix_world @ bone.head)
            tip = arm.matrix_world @ arm.pose.bones[names[-1]].tail
            pts.append(tip)
            print(f"  {side}")
            for label, point in (("wrist", wrist), ("m1", pts[0]), ("m2", pts[1]), ("m3", pts[2]), ("tip", tip)):
                delta = axis_delta(point, origin, axis)
                print(f"    {label} dyz ({delta.y:.3f}, {delta.z:.3f}) dist {delta.length:.3f}")
