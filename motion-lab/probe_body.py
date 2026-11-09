import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name == "cuerpo")
print("BONES", len(arm.data.bones))
for bone in arm.data.bones:
    head = arm.matrix_world @ bone.head_local
    print(f"  {bone.name} {head.x:.3f} {head.y:.3f} {head.z:.3f}")
print("VERTS", len(body.data.vertices), "FACES", len(body.data.polygons))
print("GROUPS", [g.name for g in body.vertex_groups])
xs, ys, zs = [], [], []
for vert in body.data.vertices:
    w = body.matrix_world @ vert.co
    xs.append(w.x)
    ys.append(w.y)
    zs.append(w.z)
print("BBOX", min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))
