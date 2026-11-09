"""Genera el jalón abierto y mide barra, puños y pies."""

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

spec = next(row for row in specs.SPECS if row["key"] == "jalon-abierto")
cycle.build_one(ex, spec)

arm = ex.SHARED["arm"]
body = ex.SHARED["body"]
shown = {"bar_jalon-abierto", "asiento_jalon-abierto", "poste_polea"}
for obj in ex.SHARED["props"]:
    obj.hide_render = obj.name not in shown
bar = bpy.data.objects["bar_jalon-abierto"]


def world_verts(obj):
    mat = obj.matrix_world
    return [mat @ v.co for v in obj.data.vertices]


for frame in (1, 24, 40, 56, ex.BOTTOM_FRAME):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    head = ex.bone_world(arm, "head", "head")
    crown = ex.bone_world(arm, "head", "tail")
    origin = bar.matrix_world.translation
    axis = (bar.matrix_world.to_3x3() @ Vector((1.0, 0.0, 0.0))).normalized()
    near = [p for p in world_verts(body) if (p - head).length < 0.24]
    worst = 9.0
    for point in near:
        delta = point - origin
        radial = (delta - axis * delta.dot(axis)).length
        worst = min(worst, radial)
    feet = []
    for side in ("l", "r"):
        foot = arm.matrix_world @ arm.pose.bones[f"foot_{side}"].matrix
        sole = foot.col[2].xyz
        toes = foot.col[1].xyz
        ball = ex.bone_world(arm, f"ball_{side}", "tail")
        hole = ex.grip_hole(arm, side, axis, 0.018)
        tip = ex.tip_gap(arm, side, origin, axis)
        feet.append((side, round(ball.z, 3), tuple(round(c, 2) for c in sole), tuple(round(c, 2) for c in toes), round(tip, 3), round((hole - origin).length, 3)))
    print(
        "PULL", frame,
        "barra", tuple(round(c, 3) for c in origin),
        "cabeza", tuple(round(c, 3) for c in head),
        "corona", tuple(round(c, 3) for c in crown),
        "hueco", round(worst - 0.016, 3),
        "codo", round(cycle.elbow_deg(ex, arm, "l"), 1),
        "rodilla", round(cycle.knee_deg(ex, arm, "l"), 1),
        "pies", feet,
        "dedo", tuple(round(c, 2) for c in arm.pose.bones["middle_01_l"].rotation_quaternion),
        flush=True,
    )

out = ROOT + r"\out\catalog"
shots = ((1, "arriba"), (40, "medio"), (ex.BOTTOM_FRAME, "pecho"))
for frame, tag in shots:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    ex.shoot_at(out + rf"\jalon-{tag}-frente.png", (0.1, -3.15, 1.15), (0.0, -0.05, 0.95))
    ex.shoot_at(out + rf"\jalon-{tag}-lado.png", (2.8, -0.35, 1.05), (0.0, -0.15, 0.95))
    ex.shoot_at(out + rf"\jalon-{tag}-tres.png", (2.2, -2.1, 1.25), (0.0, -0.05, 0.9))
    ex.shoot_at(out + rf"\jalon-{tag}-atras.png", (0.55, 2.7, 1.45), (0.0, 0.05, 1.0))
    ex.shoot_at(out + rf"\jalon-{tag}-espalda.png", (0.35, 2.9, 1.35), (0.0, 0.0, 0.95))
    wrist = ex.bone_world(arm, "hand_l", "head")
    ex.shoot_at(out + rf"\jalon-{tag}-mano.png", (wrist.x - 0.05, wrist.y - 0.55, wrist.z + 0.08), wrist)
print("JALON_SHOTS", out, flush=True)

if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.objects.active = arm
ex.export_glb(ROOT + r"\out\jalon-abierto.glb", [arm, body, *ex.SHARED["props"]])
