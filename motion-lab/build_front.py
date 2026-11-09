"""Genera la elevación frontal y mide si la mancuerna entra en la cadera."""

import os
import sys

import bpy
from mathutils import Vector

ROOT = r"C:\Users\Hide\Desktop\Gym\motion-lab"
sys.path.insert(0, ROOT)
os.makedirs(ROOT + r"\out\catalog", exist_ok=True)

import build_exercises as ex
import catalog_cycle as cycle
import catalog_specs as specs

spec = next(row for row in specs.SPECS if row["key"] == "elevacion-frontal")
cycle.build_one(ex, spec)

arm = ex.SHARED["arm"]
body = ex.SHARED["body"]
bells = [obj for obj in ex.SHARED["props"] if obj.name.startswith("db_elevacion-frontal")]
for obj in ex.SHARED["props"]:
    obj.hide_render = obj not in bells


def world_verts(obj):
    mesh = obj.data
    mat = obj.matrix_world
    return [mat @ v.co for v in mesh.vertices]


def nearest(points, cloud):
    best = 1e9
    hit = None
    for point in points:
        for other in cloud:
            gap = (point - other).length
            if gap < best:
                best = gap
                hit = other
    return best, hit


print("MANCUERNAS", [obj.name for obj in bells], flush=True)

for frame in (1, 24, 40, 56, ex.BOTTOM_FRAME):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    hip = [point for point in world_verts(body) if 0.55 < point.z < 1.25]
    pelvis = ex.bone_world(arm, "pelvis", "head")
    for side in ("l", "r"):
        shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
        elbow = ex.bone_world(arm, f"lowerarm_{side}", "head")
        wrist = ex.bone_world(arm, f"hand_{side}", "head")
        upper = elbow - shoulder
        fore = wrist - elbow
        bend = upper.angle(fore) if upper.length > 1e-4 and fore.length > 1e-4 else 0.0
        bell = next(obj for obj in bells if obj.name.endswith(f"_{side}"))
        points = world_verts(bell)
        gap, hit = nearest(points, hip)
        center = bell.matrix_world.translation
        print(
            "FRONT", frame, side,
            "mano", tuple(round(c, 3) for c in wrist),
            "centro", tuple(round(c, 3) for c in center),
            "codo", round(bend * 57.3, 1),
            "hueco", round(gap, 3),
            "pelvis", tuple(round(c, 3) for c in pelvis),
            flush=True,
        )

out = ROOT + r"\out\catalog"
shots = ((1, "abajo"), (24, "sube"), (40, "medio"), (ex.BOTTOM_FRAME, "arriba"))
for frame, tag in shots:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    ex.shoot_at(out + rf"\front-{tag}-frente.png", (0.12, -3.2, 1.15), (0.0, -0.05, 1.0))
    ex.shoot_at(out + rf"\front-{tag}-lado.png", (2.7, -0.55, 1.15), (0.0, -0.12, 1.0))
print("FRONT_SHOTS", out, flush=True)

if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.objects.active = arm
ex.export_glb(ROOT + r"\out\front-elevacion.glb", [arm, body, *ex.SHARED["props"]])
