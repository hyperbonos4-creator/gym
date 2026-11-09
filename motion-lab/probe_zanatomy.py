"""Qué trae el FBX muscular de Z-Anatomy: objetos, volumen y nombres."""

import bpy

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\anatomy\MuscularSystem100.fbx"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=SRC)
meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
armatures = [obj for obj in bpy.data.objects if obj.type == "ARMATURE"]
print("MALLAS", len(meshes), "ARMADURAS", len(armatures), "OBJETOS", len(bpy.data.objects), flush=True)
verts = sum(len(obj.data.vertices) for obj in meshes)
faces = sum(len(obj.data.polygons) for obj in meshes)
print("VERTS", verts, "CARAS", faces, flush=True)

needles = ("pector", "delto", "tricep", "bicep", "latiss", "quad", "glut", "femor", "gastroc", "abdom", "trap")
hits = []
for obj in meshes:
    low = obj.name.lower()
    if any(needle in low for needle in needles):
        hits.append(obj.name)
print("COINCIDEN", len(hits), flush=True)
for name in sorted(hits)[:80]:
    print(" ", name, flush=True)

big = sorted(meshes, key=lambda obj: len(obj.data.polygons), reverse=True)[:12]
print("GRANDES", flush=True)
for obj in big:
    print(f"  {obj.name} caras {len(obj.data.polygons)}", flush=True)
if meshes:
    sample = meshes[0]
    print("EJEMPLO", sample.name, "mundo", tuple(round(v, 3) for v in sample.matrix_world.translation), flush=True)
    xs, ys, zs = [], [], []
    for obj in meshes[:: max(1, len(meshes) // 40)]:
        for corner in obj.bound_box:
            world = obj.matrix_world @ __import__("mathutils").Vector(corner)
            xs.append(world.x)
            ys.append(world.y)
            zs.append(world.z)
    print(
        "CAJA",
        "x", round(min(xs), 3), round(max(xs), 3),
        "y", round(min(ys), 3), round(max(ys), 3),
        "z", round(min(zs), 3), round(max(zs), 3),
        flush=True,
    )
