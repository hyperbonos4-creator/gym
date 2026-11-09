import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio-anatomia.glb")
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.name == "cuerpo")
bpy.context.view_layer.update()


def center(name):
    obj = bpy.data.objects[name]
    acc = Vector((0, 0, 0))
    for vert in obj.data.vertices:
        acc += obj.matrix_world @ vert.co
    acc /= len(obj.data.vertices)
    return tuple(round(c, 3) for c in acc)


bone = arm.data.bones["upperarm_l"]
head = arm.matrix_world @ bone.head_local
tail = arm.matrix_world @ bone.tail_local
print("arm", tuple(round(c, 3) for c in head), tuple(round(c, 3) for c in tail), flush=True)
for name in (
    "superficie_biceps_l",
    "superficie_triceps_l",
    "superficie_pecho_l",
    "superficie_deltoides-anterior_l",
    "superficie_cuadriceps_l",
    "superficie_espalda_l",
):
    print(name, center(name), flush=True)
print("body z", round((body.matrix_world @ body.data.vertices[0].co).z, 3), flush=True)
