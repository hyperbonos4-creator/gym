"""Pega los musculos y huesos de Z-Anatomy al esqueleto del maniqui del gym.

Fuente anatomia: Z-Anatomy y BodyParts3D, CC BY-SA 4.0.

Idea: el maniqui (estudio.glb) ya tiene esqueleto y 68 clips. Importamos la
anatomia real, la alineamos a la pose de reposo del maniqui, levantamos los
brazos a la pose en A, copiamos por cercania los pesos de la piel 'cuerpo' a
cada malla y les ponemos el mismo Armature. Asi la anatomia se mueve con cada
ejercicio. Exportamos un GLB con piel + animaciones.
"""

import bpy
from mathutils import Vector, Matrix, Quaternion
import math

GYM = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
MUSCLE = r"C:\Users\Hide\Desktop\Gym\motion-lab\anatomy\MuscularSystem100.fbx"
BONE = r"C:\Users\Hide\Desktop\Gym\motion-lab\anatomy\SkeletalSystem100.fbx"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\anatomia-anim.glb"
STILL = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog"

SKIP = (
    "fascia", "bursa", "septum", "ligament", "aponeurosis", "tract", "tendon",
    "sheath", "retinaculum", "raphe", "intercostal", "membrane", "capsule",
)


def wanted(name):
    low = name.lower()
    return not any(word in low for word in SKIP)


def flesh(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.6
    return mat


# ---------------------------------------------------------------- maniqui
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GYM)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
cuerpo = next(o for o in bpy.data.objects if o.type == "MESH" and o.name.lower().startswith("cuerpo"))
arm.data.pose_position = "REST"
bpy.context.view_layer.update()

body_verts = [cuerpo.matrix_world @ v.co for v in cuerpo.data.vertices]
bx = [v.x for v in body_verts]; by = [v.y for v in body_verts]; bz = [v.z for v in body_verts]
gym_low = Vector((min(bx), min(by), min(bz)))
gym_high = Vector((max(bx), max(by), max(bz)))
print("GYM caja", tuple(round(v, 3) for v in gym_low), tuple(round(v, 3) for v in gym_high), flush=True)


def bone_point(name, tail=False):
    b = arm.data.bones[name]
    return arm.matrix_world @ (b.tail_local if tail else b.head_local)


shoulder_l = bone_point("upperarm_l")
shoulder_r = bone_point("upperarm_r")
hand_l = bone_point("hand_l")
hand_r = bone_point("hand_r")


# ---------------------------------------------------------------- importar ZA
def take(filepath, prefix, material):
    before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.fbx(filepath=filepath)
    fresh = [o for o in bpy.data.objects if o.name not in before]
    meshes = [o for o in fresh if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    if meshes:
        bpy.context.view_layer.objects.active = meshes[0]
        bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    kept = []
    for o in fresh:
        if o.type != "MESH" or not wanted(o.name):
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        o.data = o.data.copy()
        o.name = prefix + o.name
        o.data.materials.clear()
        o.data.materials.append(material)
        for poly in o.data.polygons:
            poly.use_smooth = True
        kept.append(o)
    print(prefix, "importados", len(kept), flush=True)
    return kept


muscle_mat = flesh("Carne", (0.74, 0.36, 0.33))
bone_mat = flesh("Hueso", (0.86, 0.83, 0.76))
muscles = take(MUSCLE, "musculo_", muscle_mat)
bones = take(BONE, "hueso_", bone_mat)
za = muscles + bones


# ---------------------------------------------------------------- alinear ZA al gym
# ZA viene Z arriba, frente -Y. El gym tiene Y arriba, frente +Z.
# Rotacion -90 en X lleva (x,y,z) -> (x, z, -y): Z arriba -> Y arriba, -Y -> +Z.
rot = Matrix.Rotation(math.radians(-90), 4, "X")
for o in za:
    o.matrix_world = rot @ o.matrix_world
bpy.context.view_layer.update()


def za_bounds(objs):
    low = Vector((1e9, 1e9, 1e9)); high = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            low.x, high.x = min(low.x, w.x), max(high.x, w.x)
            low.y, high.y = min(low.y, w.y), max(high.y, w.y)
            low.z, high.z = min(low.z, w.z), max(high.z, w.z)
    return low, high


low, high = za_bounds(za)
scale = (gym_high.y - gym_low.y) / (high.y - low.y)
print("ESCALA", round(scale, 4), flush=True)
scl = Matrix.Scale(scale, 4)
for o in za:
    o.matrix_world = scl @ o.matrix_world
bpy.context.view_layer.update()

low, high = za_bounds(za)
za_center = (low + high) * 0.5
gym_center = (gym_low + gym_high) * 0.5
shift = Vector((gym_center.x - za_center.x, gym_low.y - low.y, gym_center.z - za_center.z))
mt = Matrix.Translation(shift)
for o in za:
    o.matrix_world = mt @ o.matrix_world
bpy.context.view_layer.update()
low, high = za_bounds(za)
print("ZA alineado", tuple(round(v, 3) for v in low), tuple(round(v, 3) for v in high), flush=True)


# ---------------------------------------------------------------- levantar brazos a la pose en A
def centroid(o):
    acc = Vector((0, 0, 0)); n = 0
    for v in o.data.vertices:
        acc += o.matrix_world @ v.co; n += 1
    return acc / max(n, 1)


def lift_arm(sign, shoulder, hand):
    members = []
    for o in muscles + bones:
        c = centroid(o)
        if c.y > 0.65 and (sign > 0 and c.x > 0.16 or sign < 0 and c.x < -0.16):
            members.append(o)
    if not members:
        return
    pts = [o.matrix_world @ v.co for o in members for v in o.data.vertices]
    top = max(pts, key=lambda p: p.y)
    bottom = min(pts, key=lambda p: p.y)
    za_axis = (bottom - top).normalized()
    gym_axis = (hand - shoulder).normalized()
    quat = za_axis.rotation_difference(gym_axis)
    pre = Matrix.Translation(shoulder - top)
    rotm = Matrix.Translation(shoulder) @ quat.to_matrix().to_4x4() @ Matrix.Translation(-shoulder)
    full = rotm @ pre
    for o in members:
        o.matrix_world = full @ o.matrix_world
    print("BRAZO", "L" if sign > 0 else "R", len(members), "giro", round(math.degrees(quat.angle), 1), flush=True)


lift_arm(1, shoulder_l, hand_l)
lift_arm(-1, shoulder_r, hand_r)
bpy.context.view_layer.update()


# ---------------------------------------------------------------- pesos por cercania
groups = [g.name for g in cuerpo.vertex_groups]
for o in za:
    o.data = o.data  # noop
    for name in groups:
        if name not in o.vertex_groups:
            o.vertex_groups.new(name=name)
    dt = o.modifiers.new("Pesos", "DATA_TRANSFER")
    dt.object = cuerpo
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier="Pesos")
    except RuntimeError as exc:
        print("NOPESO", o.name, exc, flush=True)
        o.modifiers.remove(dt)
print("PESOS copiados", flush=True)


# ---------------------------------------------------------------- adelgazar
def slim(objects, limit):
    before = sum(len(o.data.polygons) for o in objects)
    for o in objects:
        count = len(o.data.polygons)
        if count <= limit:
            continue
        m = o.modifiers.new("Reducir", "DECIMATE")
        m.ratio = max(0.08, min(0.4, limit / count))
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        try:
            bpy.ops.object.modifier_apply(modifier="Reducir")
        except RuntimeError:
            o.modifiers.remove(m)
    after = sum(len(o.data.polygons) for o in objects)
    print("CARAS", before, "->", after, flush=True)


slim(muscles, 1400)
slim(bones, 900)

# unir huesos en una sola malla
bpy.ops.object.select_all(action="DESELECT")
for o in bones:
    o.select_set(True)
bpy.context.view_layer.objects.active = bones[0]
bpy.ops.object.join()
skeleton = bones[0]
skeleton.name = "hueso_cuerpo"
final = muscles + [skeleton]


# ---------------------------------------------------------------- armadura + padre
for o in final:
    mod = o.modifiers.new("Armature", "ARMATURE")
    mod.object = arm
    o.parent = arm
    o.matrix_parent_inverse = arm.matrix_world.inverted()

arm.data.pose_position = "POSE"
bpy.context.view_layer.update()

# quitar la piel y props del gym del archivo de anatomia: solo exportamos ZA + arm
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
for o in final:
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_skins=True,
    export_yup=True,
)
print("GLB", OUT, flush=True)


# ---------------------------------------------------------------- render de prueba
def setup_render(tag, action_name, frame):
    scene = bpy.context.scene
    scene.render.resolution_x = 640
    scene.render.resolution_y = 900
    scene.view_settings.view_transform = "Standard"
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"
    if action_name:
        act = bpy.data.actions.get(action_name)
        if act:
            if not arm.animation_data:
                arm.animation_data_create()
            arm.animation_data.action = act
            if act.slots:
                arm.animation_data.action_slot = act.slots[0]
        scene.frame_set(frame)
    bpy.context.view_layer.update()


world = bpy.data.worlds.new("fondo")
bpy.context.scene.world = world
world.color = (0.16, 0.17, 0.19)
sun = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", "SUN"))
sun.data.energy = 4.5
bpy.context.collection.objects.link(sun)
sun.rotation_euler = (0.9, 0.2, 0.6)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
bpy.context.collection.objects.link(cam)
bpy.context.scene.camera = cam
cam.data.lens = 50
cam.location = (0.0, 0.9, 3.4)
aim = Vector((0.0, 0.9, 0.5)) - Vector(cam.location)
cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
skeleton.hide_render = True

setup_render("reposo", None, 1)
bpy.context.scene.render.filepath = STILL + r"\anim-reposo.png"
bpy.ops.render.render(write_still=True)
print("FOTO reposo", flush=True)

setup_render("curl", "Curl con mancuernas", 73)
bpy.context.scene.render.filepath = STILL + r"\anim-curl.png"
bpy.ops.render.render(write_still=True)
print("FOTO curl", flush=True)
