"""Genera solo la extensión de pierna y deja fotos para revisar las rodillas."""

import os
import sys

import bpy

ROOT = r"C:\Users\Hide\Desktop\Gym\motion-lab"
sys.path.insert(0, ROOT)
os.makedirs(ROOT + r"\out\catalog", exist_ok=True)

import build_exercises as ex
import catalog_cycle as cycle
import catalog_specs as specs

spec = next(row for row in specs.SPECS if row["key"] == "extension-pierna")
cycle.build_one(ex, spec)

shown = {"bar_extension-pierna", "maquina_extension", "rodillo_extension"}
for obj in ex.SHARED["props"]:
    obj.hide_render = obj.name not in shown

out = ROOT + r"\out\catalog"
shots = ((1, "flex"), (40, "medio"), (ex.BOTTOM_FRAME, "ext"))
for frame, tag in shots:
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    ex.shoot_at(out + rf"\ext-{tag}-frente.png", (0.05, -3.05, 0.95), (0.0, -0.05, 0.72))
    ex.shoot_at(out + rf"\ext-{tag}-lado.png", (2.6, -0.15, 0.9), (0.0, -0.05, 0.7))
print("EXT_SHOTS", out, flush=True)
arm = ex.SHARED["arm"]
bpy.context.view_layer.objects.active = arm
if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
ex.export_glb(ROOT + r"\out\legext.glb", [arm, ex.SHARED["body"], *ex.SHARED["props"]])
