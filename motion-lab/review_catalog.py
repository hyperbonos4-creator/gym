"""Fotos de revisión del GLB ya exportado. No regenera los ciclos."""

import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog_specs as specs

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
OUT = Path(r"C:\Users\Hide\Desktop\Gym\motion-lab\out\review")
EFFORT = 73


def aim(cam, location, target):
    cam.location = Vector(location)
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def mesh_bounds():
    low = Vector((1e9, 1e9, 1e9))
    high = Vector((-1e9, -1e9, -1e9))
    found = False
    for obj in bpy.data.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        found = True
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            low.x, low.y, low.z = min(low.x, point.x), min(low.y, point.y), min(low.z, point.z)
            high.x, high.y, high.z = max(high.x, point.x), max(high.y, point.y), max(high.z, point.z)
    if not found:
        return Vector((0, 0, 0.8)), 2.2
    center = (low + high) * 0.5
    size = max(high.x - low.x, high.y - low.y, high.z - low.z, 1.2)
    return center, size * 1.35


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 800
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("fondo")
    scene.world = world
    world.color = (0.09, 0.10, 0.12)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 48
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    light_data = bpy.data.lights.new("Key", "AREA")
    light_data.energy = 350
    light_data.size = 3
    light = bpy.data.objects.new("Key", light_data)
    bpy.context.collection.objects.link(light)
    light.location = (1.2, -2.2, 2.6)
    names = {obj.name: obj for obj in bpy.data.objects}
    wanted = set(filter(None, os.environ.get("REVIEW_KEYS", "").split(",")))
    clips = [specs.clip_row(row) for row in specs.SPECS if not wanted or row["key"] in wanted]
    for clip in clips:
        action = bpy.data.actions.get(clip["label"])
        if action is None or arm.animation_data is None:
            print("SIN_CLIP", clip["key"], flush=True)
            continue
        arm.animation_data.action = action
        arm.animation_data.use_nla = False
        shown = set(clip["show"])
        for obj in bpy.data.objects:
            if obj.type != "MESH" or obj == arm:
                continue
            skinned = any(mod.type == "ARMATURE" for mod in obj.modifiers)
            visible = skinned or obj.name in shown
            obj.hide_render = not visible
            if obj.animation_data and obj.animation_data.action:
                obj.animation_data.use_nla = False
                wanted = [name for name in clip["play"] if name != clip["label"]]
                match = next((bpy.data.actions.get(name) for name in wanted if bpy.data.actions.get(name)), None)
                if match and obj.name in shown:
                    obj.animation_data.action = match
        missing = [name for name in clip["show"] if name not in names]
        if missing:
            print("SIN_MALLA", clip["key"], ",".join(missing), flush=True)
        for frame, tag in ((1, "inicio"), (EFFORT, "esfuerzo")):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            center, dist = mesh_bounds()
            aim(cam, (center.x, center.y - dist, center.z + dist * 0.15), center)
            scene.render.filepath = str(OUT / f"{clip['key']}-{tag}-frente.png")
            bpy.ops.render.render(write_still=True)
            aim(cam, (center.x + dist, center.y, center.z + dist * 0.05), center)
            scene.render.filepath = str(OUT / f"{clip['key']}-{tag}-perfil.png")
            bpy.ops.render.render(write_still=True)
        print("REV", clip["key"], flush=True)


if __name__ == "__main__":
    main()
