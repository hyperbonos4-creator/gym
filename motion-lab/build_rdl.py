"""Genera el peso muerto rumano y lo mira de frente, de lado y en tres cuartos."""

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

spec = next(row for row in specs.SPECS if row["key"] == "peso-muerto-rumano")
cycle.build_one(ex, spec)

arm = ex.SHARED["arm"]
bar = bpy.data.objects["bar_peso-muerto-rumano"]
for obj in ex.SHARED["props"]:
    obj.hide_render = obj.name != "bar_peso-muerto-rumano"

for frame in (1, 40, ex.BOTTOM_FRAME):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    head = ex.bone_world(arm, "head", "head")
    hip = ex.bone_world(arm, "pelvis", "head")
    knee = ex.bone_world(arm, "calf_l", "head")
    ankle = ex.bone_world(arm, "calf_l", "tail")
    origin = bar.matrix_world.translation
    axis = (bar.matrix_world.to_3x3() @ Vector((1.0, 0.0, 0.0))).normalized()
    ball = ex.bone_world(arm, "ball_l", "tail")
    print(
        "RDL", frame,
        "barra", tuple(round(c, 3) for c in origin),
        "eje", tuple(round(c, 2) for c in axis),
        "cabeza", tuple(round(c, 3) for c in head),
        "cadera", tuple(round(c, 3) for c in hip),
        "rodilla", tuple(round(c, 3) for c in knee), round(cycle.knee_deg(ex, arm, "l"), 1),
        "delante", round(knee.y - origin.y, 3),
        "codo", round(cycle.elbow_deg(ex, arm, "l"), 1),
        "pie", round(ball.z, 3),
        "punta", round(ex.tip_gap(arm, "l", origin, axis), 3),
        flush=True,
    )

out = ROOT + r"\out\catalog"
shots = ((1, "arriba"), (ex.BOTTOM_FRAME, "abajo"))
for frame, tag in shots:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    ex.shoot_at(out + rf"\rdl-{tag}-frente.png", (0.1, -3.15, 1.05), (0.0, -0.05, 0.85))
    ex.shoot_at(out + rf"\rdl-{tag}-lado.png", (2.8, -0.35, 1.05), (0.0, -0.1, 0.85))
    ex.shoot_at(out + rf"\rdl-{tag}-tres.png", (2.2, -2.1, 1.2), (0.0, -0.05, 0.8))
print("RDL_SHOTS", out, flush=True)

if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.export_scene.gltf(filepath=ROOT + r"\out\rdl.glb", export_format="GLB", use_selection=False, export_animations=True)
