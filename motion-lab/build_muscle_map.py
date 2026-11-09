"""Mapa muscular del maniquí: cada zona de la piel es un músculo, a ambos lados.

La cabeza, las manos y los pies quedan en la piel. El resto se parte en los
grupos que el atlas enciende según el ejercicio.
"""

import bpy
import bmesh
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio-anatomia.glb"
STILL = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog"

SKIP_PREFIX = (
    "hand",
    "index",
    "middle",
    "pinky",
    "ring",
    "thumb",
    "foot",
    "ball",
    "head",
    "neck",
    "Root",
)

COLORS = {
    "pecho": (0.82, 0.22, 0.18),
    "deltoides-anterior": (0.95, 0.55, 0.15),
    "deltoides-lateral": (0.95, 0.85, 0.2),
    "deltoides-posterior": (0.62, 0.28, 0.82),
    "biceps": (0.2, 0.45, 0.9),
    "triceps": (0.15, 0.72, 0.38),
    "antebrazos": (0.2, 0.75, 0.82),
    "trapecio": (0.9, 0.25, 0.55),
    "dorsal": (0.15, 0.35, 0.72),
    "erectores": (0.92, 0.92, 0.92),
    "abdomen": (0.95, 0.45, 0.62),
    "oblicuos": (0.55, 0.85, 0.25),
    "cuadriceps": (0.15, 0.7, 0.62),
    "isquiotibiales": (0.55, 0.32, 0.16),
    "aductores": (0.85, 0.7, 0.2),
    "gluteos": (0.45, 0.22, 0.62),
    "pantorrillas": (0.9, 0.4, 0.25),
}


def weight_map(mesh):
    names = [group.name for group in mesh.vertex_groups]
    rows = []
    for vert in mesh.data.vertices:
        weights = {}
        for slot in vert.groups:
            if slot.weight > 0.02:
                weights[names[slot.group]] = slot.weight
        rows.append(weights)
    return names, rows


def skipped(weights):
    total = 0.0
    for name, weight in weights.items():
        if name.startswith(SKIP_PREFIX):
            total += weight
    return total


def classify(world, normal, weights):
    if skipped(weights) > 0.32 or world.y > 1.47 or world.y < 0.08:
        return None
    side = "l" if world.x >= 0.0 else "r"
    sign = 1.0 if side == "l" else -1.0
    ax = abs(world.x)
    y = world.y
    front = normal.z
    outward = normal.x * sign
    upper = weights.get(f"upperarm_{side}", 0.0)
    lower = weights.get(f"lowerarm_{side}", 0.0)
    clav = weights.get(f"clavicle_{side}", 0.0)
    thigh = weights.get(f"thigh_{side}", 0.0)
    calf = weights.get(f"calf_{side}", 0.0)
    spine = weights.get("spine_01", 0.0) + weights.get("spine_02", 0.0) + weights.get("spine_03", 0.0)
    pelvis = weights.get("pelvis", 0.0)

    if lower > 0.34 and lower >= upper * 0.8 and y < 1.22:
        return "antebrazos", side
    if y > 1.26 and 0.10 < ax < 0.32 and (upper > 0.15 or clav > 0.22) and lower < 0.28:
        if front > 0.45:
            return "deltoides-anterior", side
        if front < -0.12:
            return "deltoides-posterior", side
        return "deltoides-lateral", side
    if upper > 0.32 and upper >= clav:
        if front > 0.12:
            return "biceps", side
        return "triceps", side

    if calf > 0.28 or (y < 0.5 and thigh < 0.3 and calf > 0.1):
        if front > -0.02:
            return None
        return "pantorrillas", side

    if y > 0.8 and y < 1.02 and front < 0.12 and (pelvis > 0.18 or y > 0.86) and ax < 0.2:
        return "gluteos", side

    if thigh > 0.2 or (0.48 < y < 0.9 and ax > 0.05 and spine < 0.2):
        if y > 0.84 and front < 0.25:
            return "gluteos", side
        if outward < -0.12 and ax < 0.16 and front < 0.35:
            return "aductores", side
        if front > 0.08:
            return "cuadriceps", side
        if y < 0.84:
            return "isquiotibiales", side
        return None

    if y > 1.3 and front < 0.08 and ax < 0.15:
        return "trapecio", side
    if 1.18 < y < 1.38 and front > 0.22 and ax < 0.16:
        return "pecho", side
    if 0.98 < y < 1.18 and front > 0.22 and ax < 0.11:
        return "abdomen", side
    if 0.96 < y < 1.24 and 0.08 < ax < 0.2 and -0.15 < front < 0.45:
        return "oblicuos", side
    if front < 0.02 and 0.98 < y < 1.36:
        if ax < 0.04:
            return "erectores", side
        return "dorsal", side
    return None


def material(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.42
    bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.18
    return mat


def build_shell(body, names, key, side, faces):
    used = {}
    coords = []
    sources = []
    new_faces = []
    for face in faces:
        loop = []
        for index in face:
            slot = used.get(index)
            if slot is None:
                src = body.data.vertices[index]
                normal = src.normal.normalized()
                if normal.length < 1e-5:
                    normal = Vector((0.0, 0.0, 1.0))
                slot = len(coords)
                used[index] = slot
                coords.append(src.co + normal * 0.0032)
                sources.append(index)
            loop.append(slot)
        if len(loop) >= 3:
            new_faces.append(tuple(loop))
    if len(coords) < 40 or len(new_faces) < 20:
        print("CORTO", key, side, len(coords), flush=True)
        return None
    data = bpy.data.meshes.new(f"superficie_{key}_{side}")
    data.from_pydata(coords, [], new_faces)
    data.update()
    obj = bpy.data.objects.new(f"superficie_{key}_{side}", data)
    bpy.context.collection.objects.link(obj)
    obj.parent = body.parent
    obj.matrix_world = body.matrix_world.copy()
    groups = {}
    for new_index, src_index in enumerate(sources):
        for slot in body.data.vertices[src_index].groups:
            if slot.weight <= 0.001:
                continue
            name = names[slot.group]
            group = groups.get(name)
            if group is None:
                group = obj.vertex_groups.new(name=name)
                groups[name] = group
            group.add([new_index], slot.weight, "REPLACE")
    for poly in obj.data.polygons:
        poly.use_smooth = True
    bone = obj.modifiers.new("Armature", "ARMATURE")
    bone.object = arm
    paint = material(f"mat_{key}_{side}", COLORS[key])
    obj.data.materials.append(paint)
    return obj


def thicken(shell):
    volume = shell.copy()
    volume.data = shell.data.copy()
    volume.name = shell.name.replace("superficie_", "musculo_", 1)
    bpy.context.collection.objects.link(volume)
    volume.parent = shell.parent
    volume.matrix_world = shell.matrix_world.copy()
    for mod in list(volume.modifiers):
        if mod.type == "ARMATURE":
            volume.modifiers.remove(mod)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = volume
    volume.select_set(True)
    thick = volume.modifiers.new("Grosor", "SOLIDIFY")
    thick.thickness = 0.007
    thick.offset = 1.0
    bpy.ops.object.modifier_apply(modifier="Grosor")
    bone = volume.modifiers.new("Armature", "ARMATURE")
    bone.object = arm
    for poly in volume.data.polygons:
        poly.use_smooth = True
    return volume


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and obj.name == "cuerpo")
if arm.animation_data:
    arm.animation_data.action = None
for obj in list(bpy.data.objects):
    if obj.name.startswith("musculo_") or obj.name.startswith("superficie_"):
        bpy.data.objects.remove(obj, do_unlink=True)
bpy.context.view_layer.update()

names, weights = weight_map(body)
rot = body.matrix_world.to_3x3()
labels = []
heights = []
fronts = []
for index, vert in enumerate(body.data.vertices):
    world = body.matrix_world @ vert.co
    normal = (rot @ vert.normal).normalized()
    labels.append(classify(world, normal, weights[index]))
    heights.append(world.y)
    fronts.append(normal.z)
neighbors = [set() for _ in labels]
for poly in body.data.polygons:
    ids = list(poly.vertices)
    for index in ids:
        neighbors[index].update(other for other in ids if other != index)
for _pass in range(8):
    blurred = labels[:]
    for index, label in enumerate(labels):
        if skipped(weights[index]) > 0.32:
            continue
        votes = {}
        if label is not None:
            votes[label] = 1
        for other in neighbors[index]:
            near = labels[other]
            if near is not None:
                votes[near] = votes.get(near, 0) + 1
        if not votes:
            continue
        best, count = max(votes.items(), key=lambda item: item[1])
        if best[0] == "gluteos" and heights[index] < 0.8:
            continue
        if best[0] == "pantorrillas" and fronts[index] > 0.0:
            continue
        own = votes.get(label, 0) if label is not None else 0
        if label is None and count >= 4:
            blurred[index] = best
        elif label is not None and best != label and count > own + 1:
            blurred[index] = best
    labels = blurred
counts = {}
for label in labels:
    if label:
        counts[label[0]] = counts.get(label[0], 0) + 1
for key in sorted(counts):
    print("ZONA", key, counts[key], flush=True)
print("SIN", sum(1 for label in labels if label is None), flush=True)

buckets = {}
for poly in body.data.polygons:
    votes = {}
    for index in poly.vertices:
        label = labels[index]
        if label is None:
            continue
        votes[label] = votes.get(label, 0) + 1
    if not votes:
        continue
    label, count = max(votes.items(), key=lambda item: item[1])
    if count < 2:
        continue
    buckets.setdefault(label, []).append(tuple(poly.vertices))

built = []
for (key, side), faces in sorted(buckets.items()):
    shell = build_shell(body, names, key, side, faces)
    if shell is None:
        continue
    built.append(shell)
    print("MALLA", shell.name, len(shell.data.vertices), len(shell.data.polygons), flush=True)

for shell in list(built):
    built.append(thicken(shell))
    print("VOLUMEN", built[-1].name, len(built[-1].data.vertices), flush=True)

scene = bpy.context.scene
scene.render.resolution_x = 900
scene.render.resolution_y = 1200
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.06, 0.07, 0.09)
key_light = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
key_light.data.energy = 500
key_light.data.size = 4
bpy.context.collection.objects.link(key_light)
key_light.location = (1.2, 1.6, 2.4)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
bpy.context.collection.objects.link(cam)
scene.camera = cam


def shoot(path, location, target):
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if obj.name.startswith("musculo_"):
            obj.hide_render = True
        elif obj.name.startswith("superficie_") or obj.name == "cuerpo":
            obj.hide_render = False
        else:
            obj.hide_render = True
    cam.location = location
    aim = Vector(target) - Vector(location)
    cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("FOTO", path, flush=True)


chest = (0.0, 0.95, 0.5)
shoot(STILL + r"\mapa-frente.png", (0.0, 0.95, 3.1), chest)
shoot(STILL + r"\mapa-lado.png", (2.6, 0.95, 0.5), chest)
shoot(STILL + r"\mapa-atras.png", (0.0, 0.95, -2.2), chest)

for obj in (key_light, cam):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.objects:
    if obj.type in {"MESH", "ARMATURE"}:
        obj.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
    export_yup=True,
)
print("GLB", OUT, flush=True)
