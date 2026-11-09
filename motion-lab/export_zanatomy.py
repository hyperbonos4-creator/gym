"""Exporta músculos y huesos reales de Z-Anatomy, ya aligerados, a un GLB.

Licencia de origen: Z-Anatomy y BodyParts3D, CC BY-SA 4.0.
"""

import bpy

MUSCLE = r"C:\Users\Hide\Desktop\Gym\motion-lab\anatomy\MuscularSystem100.fbx"
BONE = r"C:\Users\Hide\Desktop\Gym\motion-lab\anatomy\SkeletalSystem100.fbx"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\anatomia.glb"
SKIP = (
    "fascia", "bursa", "septum", "ligament", "aponeurosis", "tract", "tendon",
    "sheath", "retinaculum", "raphe", "intercostal", "membrane", "capsule",
)

bpy.ops.wm.read_factory_settings(use_empty=True)


def wanted(name):
    low = name.lower()
    return not any(word in low for word in SKIP)


def flesh(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.5
    return mat


def take(filepath, prefix, material):
    before = {obj.name for obj in bpy.data.objects}
    bpy.ops.import_scene.fbx(filepath=filepath)
    fresh = [obj for obj in bpy.data.objects if obj.name not in before]
    meshes = [obj for obj in fresh if obj.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    kept = []
    for obj in fresh:
        if obj.type != "MESH" or not wanted(obj.name):
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        obj.data = obj.data.copy()
        obj.name = prefix + obj.name
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for poly in obj.data.polygons:
            poly.use_smooth = True
        kept.append(obj)
    print(prefix, "quedan", len(kept), flush=True)
    return kept


def bounds(objects):
    from mathutils import Vector
    low = Vector((1e9, 1e9, 1e9))
    high = Vector((-1e9, -1e9, -1e9))
    for obj in objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            low.x, high.x = min(low.x, world.x), max(high.x, world.x)
            low.y, high.y = min(low.y, world.y), max(high.y, world.y)
            low.z, high.z = min(low.z, world.z), max(high.z, world.z)
    return low, high


def slim(objects, limit):
    faces = 0
    for obj in objects:
        count = len(obj.data.polygons)
        faces += count
        if count <= limit:
            continue
        ratio = max(0.08, min(0.4, limit / count))
        modifier = obj.modifiers.new("Reducir", "DECIMATE")
        modifier.ratio = ratio
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.modifier_apply(modifier="Reducir")
        except RuntimeError as exc:
            print("NO", obj.name, exc, flush=True)
            obj.modifiers.remove(modifier)
    after = sum(len(obj.data.polygons) for obj in objects)
    print("CARAS", faces, "->", after, flush=True)


muscle_mat = flesh("Carne", (0.71, 0.34, 0.31))
bone_mat = flesh("Hueso", (0.86, 0.83, 0.76))
muscles = take(MUSCLE, "musculo_", muscle_mat)
low, high = bounds(muscles)
print("CAJA", tuple(round(v, 3) for v in (*low, *high)), flush=True)
slim(muscles, 1400)
bones = take(BONE, "hueso_", bone_mat)
slim(bones, 900)
bpy.ops.object.select_all(action="DESELECT")
for obj in bones:
    obj.select_set(True)
bpy.context.view_layer.objects.active = bones[0]
bpy.ops.object.join()
skeleton = bones[0]
skeleton.name = "hueso_cuerpo"
print("HUESO unido caras", len(skeleton.data.polygons), flush=True)

bpy.ops.object.select_all(action="DESELECT")
for obj in muscles + [skeleton]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = muscles[0]
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_animations=False,
    export_skins=False,
    export_yup=True,
)
print("GLB", OUT, flush=True)

scene = bpy.context.scene
scene.render.resolution_x = 720
scene.render.resolution_y = 960
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.16, 0.17, 0.19)
sun = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", "SUN"))
sun.data.energy = 4.2
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (0.9, 0.2, 0.6)
key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
key.data.energy = 250
key.data.size = 3
bpy.context.collection.objects.link(key)
center = (low + high) * 0.5
height = max(high.z - low.z, 0.4)
dist = height * 1.55
key.location = (center.x + 0.7, low.y - dist * 0.4, high.z)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
bpy.context.collection.objects.link(cam)
scene.camera = cam
cam.data.lens = 50
cam.location = (center.x, low.y - dist, center.z)
from mathutils import Vector
aim = Vector(center) - Vector(cam.location)
cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
skeleton.hide_render = True
scene.render.filepath = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog\zanatomia-frente.png"
bpy.ops.render.render(write_still=True)
print("FOTO", scene.render.filepath, flush=True)
