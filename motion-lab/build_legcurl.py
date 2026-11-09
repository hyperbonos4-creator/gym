"""Genera solo la flexión femoral y deja fotos del banco y el rodillo."""

import os
import sys

import bpy

ROOT = r"C:\Users\Hide\Desktop\Gym\motion-lab"
sys.path.insert(0, ROOT)
os.makedirs(ROOT + r"\out\catalog", exist_ok=True)

import build_exercises as ex
import catalog_cycle as cycle
import catalog_specs as specs

spec = next(row for row in specs.SPECS if row["key"] == "femoral-maquina")
cycle.build_one(ex, spec)

shown = {"banco_femoral", "rodillo_femoral"}
for obj in ex.SHARED["props"]:
    obj.hide_render = obj.name not in shown

out = ROOT + r"\out\catalog"
shots = ((1, "recto"), (40, "medio"), (ex.BOTTOM_FRAME, "flex"))
for frame, tag in shots:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    ex.shoot_at(out + rf"\curl-{tag}-lado.png", (2.7, 0.15, 0.85), (0.0, 0.05, 0.55))
    ex.shoot_at(out + rf"\curl-{tag}-frente.png", (0.1, -2.6, 1.15), (0.0, 0.05, 0.55))
print("CURL_SHOTS", out, flush=True)
arm = ex.SHARED["arm"]
bpy.context.view_layer.objects.active = arm
if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
ex.export_glb(ROOT + r"\out\legcurl.glb", [arm, ex.SHARED["body"], *ex.SHARED["props"]])
