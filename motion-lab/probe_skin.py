"""Piel vista desde fuera, para apoyar cada músculo."""

import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name == "cuerpo")
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
print("BODY", tuple(round(v, 3) for v in body.location), body.matrix_world.to_euler(), flush=True)

def cast(origin, direction, tag):
    ok, loc, normal, _face = body.ray_cast(origin, direction)
    if not ok:
        print("miss", tag, flush=True)
        return
    print(f"{tag} {tuple(round(v, 3) for v in loc)} n{tuple(round(v, 2) for v in normal)}", flush=True)

print("--- PECHO desde el frente ---", flush=True)
for z in (0.70, 0.76, 0.82, 0.88, 0.94):
    for x in (0.02, 0.06, 0.10, 0.14, 0.18):
        cast(Vector((x, -0.6, z)), Vector((0, 1, 0)), f"p x{x:.2f} z{z:.2f}")

print("--- HOMBRO ---", flush=True)
shoulder = Vector((0.185, 0.168, 0.835))
for name, direction in (
    ("frente", Vector((0, -1, 0))),
    ("fuera", Vector((1, 0, 0))),
    ("arriba", Vector((0, 0, 1))),
    ("atras", Vector((0, 1, 0))),
    ("abajo", Vector((0, 0, -1))),
):
    cast(shoulder + direction * 0.35, -direction, "hombro " + name)

print("--- BRAZO ---", flush=True)
elbow = Vector((0.345, 0.144, 0.654))
for t in (0.15, 0.4, 0.7):
    center = shoulder.lerp(elbow, t)
    for name, direction in (
        ("frente", Vector((0, -1, -0.15)).normalized()),
        ("atras", Vector((0, 1, 0.1)).normalized()),
        ("fuera", Vector((1, 0.2, 0)).normalized()),
        ("dentro", Vector((-1, -0.2, 0)).normalized()),
    ):
        cast(center + direction * 0.25, -direction, f"brazo t{t:.2f} {name}")

print("--- MUSLO ---", flush=True)
hip = Vector((0.106, 0.13, 0.391))
knee = Vector((0.146, 0.038, -0.006))
for t in (0.25, 0.55):
    center = hip.lerp(knee, t)
    for name, direction in (
        ("frente", Vector((0, -1, 0))),
        ("atras", Vector((0, 1, 0))),
        ("fuera", Vector((1, 0, 0))),
    ):
        cast(center + direction * 0.3, -direction, f"muslo t{t:.2f} {name}")

print("--- ESPALDA ---", flush=True)
for z in (0.70, 0.82, 0.95, 1.05):
    cast(Vector((0.08, 0.7, z)), Vector((0, -1, 0)), f"espalda z{z:.2f}")
