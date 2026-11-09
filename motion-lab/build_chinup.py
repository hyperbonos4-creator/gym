"""Genera solo la dominada supina y deja fotos para revisar el agarre."""

import os
import sys

import bpy

ROOT = r"C:\Users\Hide\Desktop\Gym\motion-lab"
sys.path.insert(0, ROOT)
os.makedirs(ROOT + r"\out\catalog", exist_ok=True)

import build_exercises as ex
import catalog_cycle as cycle
import catalog_specs as specs

spec = next(row for row in specs.SPECS if row["key"] == "dominadas-supino")
cycle.build_one(ex, spec)

shown = {"bar_dominadas-supino", "estructura_dominadas"}
for obj in ex.SHARED["props"]:
    obj.hide_render = obj.name not in shown

out = ROOT + r"\out\catalog"
shots = ((1, "cuelga"), (40, "medio"), (ex.BOTTOM_FRAME, "arriba"))
for frame, tag in shots:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    ex.shoot_at(out + rf"\chin-{tag}-frente.png", (0.12, -3.15, 1.35), (0.0, -0.02, 1.15))
    ex.shoot_at(out + rf"\chin-{tag}-lado.png", (2.75, -0.2, 1.28), (0.0, -0.04, 1.2))
    ex.shoot_at(out + rf"\chin-{tag}-manos.png", (0.55, -1.05, 1.88), (0.02, -0.05, 1.8))
    ex.shoot_at(out + rf"\chin-{tag}-pies.png", (0.85, -1.7, 0.42), (0.0, 0.02, 0.22))
print("CHIN_SHOTS", out, flush=True)
arm = ex.SHARED["arm"]
bpy.context.view_layer.objects.active = arm
if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
ex.export_glb(ROOT + r"\out\chin-dominadas.glb", [arm, ex.SHARED["body"], *ex.SHARED["props"]])
