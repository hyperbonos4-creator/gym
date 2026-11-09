"""Bind v2: musculos superficiales de Z-Anatomy sobre el esqueleto del gym.

Fuente anatomia: Z-Anatomy y BodyParts3D, CC BY-SA 4.0.

Clave de que funcione:
- Solo musculos superficiales grandes (los que se ven en las referencias).
- Los brazos de Z-Anatomy cuelgan; el maniqui esta en pose A. Antes de copiar
  pesos levantamos los musculos de cada brazo a la direccion hombro->muneca del
  maniqui, para que la bind-pose coincida con el reposo del esqueleto.
- Copiamos pesos por cercania desde la piel 'cuerpo' (en reposo A), limitamos a
  4 huesos y normalizamos. Asi, al animar, cada musculo sigue al hueso correcto.
"""

import bpy
from mathutils import Vector, Matrix, kdtree
import math

GYM = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
MUSCLE = r"C:\Users\Hide\Desktop\Gym\motion-lab\anatomy\MuscularSystem100.fbx"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\anatomia-anim.glb"
STILL = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog"

# Antebrazo y distales del pie fuera: su geometria en ZA no casa con el
# esqueleto y, se pese como se pese, se estira en laminas feas al mover muneca
# y tobillo. Dejamos los musculos grandes que se ven en las referencias.
KEEP = (
    "pectoralis major", "part of deltoid", "biceps brachii", "triceps",
    "brachialis", "coracobrachialis",
    "latissimus", "trapezius", "teres major", "teres minor", "infraspinatus",
    "supraspinatus", "rhomboid",
    "rectus abdominis", "external abdominal oblique",
    "gluteus maximus", "gluteus medius", "tensor",
    "rectus femoris", "vastus lateralis", "vastus medialis", "vastus intermedius",
    "sartorius", "biceps femoris", "semitendinosus", "semimembranosus",
    "gracilis", "adductor longus", "adductor magnus", "adductor brevis",
    "gastrocnemius", "soleus",
    "sternocleidomastoid",
)
UPPER = ("part of deltoid", "biceps brachii", "triceps", "brachialis", "coracobrachialis")
FORE = ()
ARM = UPPER + FORE


# OJO: "tensor" (de KEEP) matchea "exTENSOR"; por eso excluimos aqui extensor/
# flexor (dedos y muneca), que no coinciden con el esqueleto y se estiran feo.
SKIP = ("bursa", "tendon", "sheath", "fascia", "retinaculum", "aponeurosis",
        "raphe", "extensor", "flexor")


def keep(name):
    low = name.lower()
    return any(w in low for w in KEEP) and not any(w in low for w in SKIP)


def is_upper(name):
    low = name.lower()
    return any(w in low for w in UPPER)


def is_fore(name):
    low = name.lower()
    return any(w in low for w in FORE)


def side(name):
    low = name.lower()
    if low.endswith(".l") or ".l." in low or ".l " in low:
        return 1
    if low.endswith(".r") or ".r." in low or ".r " in low:
        return -1
    return 0


def flesh(name, color):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = 0.6
    return mat


# -------------------------------------------------- maniqui
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GYM)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
cuerpo = next(o for o in bpy.data.objects if o.type == "MESH" and o.name.lower().startswith("cuerpo"))
arm.data.pose_position = "REST"
bpy.context.view_layer.update()

bv = [cuerpo.matrix_world @ v.co for v in cuerpo.data.vertices]
gym_low = Vector((min(v.x for v in bv), min(v.y for v in bv), min(v.z for v in bv)))
gym_high = Vector((max(v.x for v in bv), max(v.y for v in bv), max(v.z for v in bv)))


def bpoint(name, tail=False):
    b = arm.data.bones[name]
    return arm.matrix_world @ (b.tail_local if tail else b.head_local)


shoulder = {1: bpoint("upperarm_l"), -1: bpoint("upperarm_r")}
elbow = {1: bpoint("lowerarm_l"), -1: bpoint("lowerarm_r")}
wrist = {1: bpoint("hand_l"), -1: bpoint("hand_r")}

# -------------------------------------------------- importar musculos
mat = flesh("Carne", (0.74, 0.36, 0.33))
before = {o.name for o in bpy.data.objects}
bpy.ops.import_scene.fbx(filepath=MUSCLE)
fresh = [o for o in bpy.data.objects if o.name not in before]
bpy.ops.object.select_all(action="DESELECT")
for o in [o for o in fresh if o.type == "MESH"]:
    o.select_set(True)
bpy.context.view_layer.objects.active = next(o for o in fresh if o.type == "MESH")
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
muscles = []
for o in fresh:
    if o.type != "MESH" or not keep(o.name):
        bpy.data.objects.remove(o, do_unlink=True)
        continue
    o.data = o.data.copy()
    o.name = "musculo_" + o.name
    o.data.materials.clear()
    o.data.materials.append(mat)
    for poly in o.data.polygons:
        poly.use_smooth = True
    muscles.append(o)
print("MUSCULOS", len(muscles), flush=True)

# -------------------------------------------------- alinear al gym (Z arriba->Y arriba, -Y->+Z)
for o in muscles:
    o.matrix_world = Matrix.Rotation(math.radians(-90), 4, "X") @ o.matrix_world
bpy.context.view_layer.update()


def box(objs):
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    return lo, hi


lo, hi = box(muscles)
s = (gym_high.y - gym_low.y) / (hi.y - lo.y)
for o in muscles:
    o.matrix_world = Matrix.Scale(s, 4) @ o.matrix_world
bpy.context.view_layer.update()
lo, hi = box(muscles)
c0 = (lo + hi) * 0.5
cg = (gym_low + gym_high) * 0.5
shift = Vector((cg.x - c0.x, gym_low.y - lo.y, cg.z - c0.z))
for o in muscles:
    o.matrix_world = Matrix.Translation(shift) @ o.matrix_world
bpy.context.view_layer.update()
print("ESCALA", round(s, 4), flush=True)

# -------------------------------------------------- levantar brazos a la pose A (2 tramos)
def verts_of(objs):
    return [o.matrix_world @ v.co for o in objs for v in o.data.vertices]


def move(objs, mat):
    for o in objs:
        o.matrix_world = mat @ o.matrix_world


def about(pivot, za_axis, gym_axis):
    quat = za_axis.normalized().rotation_difference(gym_axis.normalized())
    return (Matrix.Translation(pivot) @ quat.to_matrix().to_4x4()
            @ Matrix.Translation(-pivot)), quat


def lift(sign):
    upper = [o for o in muscles if is_upper(o.name) and side(o.name) == sign]
    fore = [o for o in muscles if is_fore(o.name) and side(o.name) == sign]
    arm_all = upper + fore
    if not arm_all:
        print("BRAZO vacio", sign, flush=True); return
    # tramo 1: hombro->codo. El codo ZA es el fondo del tramo superior.
    up_pts = verts_of(upper)
    za_sh = max(up_pts, key=lambda p: p.y)
    za_el = min(up_pts, key=lambda p: p.y)
    pre = Matrix.Translation(shoulder[sign] - za_sh)
    move(arm_all, pre)
    za_el2 = za_el + (shoulder[sign] - za_sh)
    r1, q1 = about(shoulder[sign], za_el2 - shoulder[sign], elbow[sign] - shoulder[sign])
    move(arm_all, r1)
    # tramo 2: codo->muneca, solo el antebrazo
    fo_pts = verts_of(fore) if fore else verts_of(upper)
    za_w = min(fo_pts, key=lambda p: p.y)
    r2, q2 = about(elbow[sign], za_w - elbow[sign], wrist[sign] - elbow[sign])
    move(fore, r2)
    print("BRAZO", "L" if sign > 0 else "R", len(arm_all),
          "giro1", round(math.degrees(q1.angle), 1), "giro2", round(math.degrees(q2.angle), 1), flush=True)


lift(1)
lift(-1)
bpy.context.view_layer.update()

# -------------------------------------------------- pesos: copiados de la piel
# El cuerpo del maniqui ya se deforma perfecto con cada ejercicio. En vez de
# pegar cada musculo a un solo hueso (eso estalla al doblar codo/rodilla),
# COPIAMOS los pesos suaves y multi-hueso de la piel 'cuerpo' a cada musculo
# por cercania de superficie. Asi cada musculo se mueve como la piel que tiene
# justo encima: hombros, codos y rodillas doblan sin romperse.
deform = [g.name for g in cuerpo.vertex_groups]
for o in muscles:
    have = {g.name for g in o.vertex_groups}
    for name in deform:
        if name not in have:
            o.vertex_groups.new(name=name)

# KDTree de la piel en mundo + su vector de pesos por vertice.
cw = [cuerpo.matrix_world @ v.co for v in cuerpo.data.vertices]
kd = kdtree.KDTree(len(cw))
for i, co in enumerate(cw):
    kd.insert(co, i)
kd.balance()
cname = {g.index: g.name for g in cuerpo.vertex_groups}
cwei = [[(cname[g.group], g.weight) for g in v.groups if g.weight > 0.0]
        for v in cuerpo.data.vertices]

# Cada vertice del musculo toma los pesos de los 3 vertices de piel mas
# cercanos, mezclados por distancia inversa. Nunca queda en cero -> no colapsa.
for o in muscles:
    gi = {g.name: g for g in o.vertex_groups}
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        acc = {}
        tot = 0.0
        for co, idx, dist in kd.find_n(p, 3):
            wgt = 1.0 / (dist * dist + 1e-6)
            tot += wgt
            for name, w in cwei[idx]:
                acc[name] = acc.get(name, 0.0) + w * wgt
        if tot <= 0.0:
            continue
        for name, val in acc.items():
            gi[name].add([v.index], val / tot, "REPLACE")

# Brazos: ZA no coincide con el esqueleto en hombro/codo, y con pesos mezclados
# los musculos del brazo se estiran en laminas feas al levantar/presionar. Para
# ellos usamos binding RIGIDO al hueso de su tramo (hombro->upperarm,
# antebrazo->lowerarm): giran enteros con el miembro, sin estirarse.
def arm_target(o):
    s = side(o.name)
    sfx = "_l" if s > 0 else "_r" if s < 0 else None
    if sfx is None:
        return None
    if is_upper(o.name):
        return "upperarm" + sfx
    # El antebrazo conserva los pesos de la piel (deforma bien); solo el brazo
    # superior (deltoides/biceps/triceps) va rigido para no estirarse.
    return None


rigidos = 0
for o in muscles:
    tgt = arm_target(o)
    if not tgt or tgt not in deform:
        continue
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    vg = o.vertex_groups.new(name=tgt)
    vg.add([v.index for v in o.data.vertices], 1.0, "REPLACE")
    rigidos += 1
print("BRAZOS rigidos", rigidos, flush=True)

# Cintura escapular: pectoral, dorsal, redondos, serrato, trapecio, etc.
# atacan al humero, asi que con pesos de piel una parte sigue al brazo y otra
# al torso -> se estiran en abanico al presionar/levantar. Los fijamos RIGIDOS
# al hueso de torso mas cercano (columna/clavicula): quedan como placas sobre
# el tronco y no se estiran.
SHOULDER = (
    "pectoralis major", "latissimus", "teres major", "teres minor",
    "infraspinatus", "supraspinatus", "rhomboid", "trapezius",
)
torso_bones = [b for b in ("spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r")
               if b in deform]
tb_head = {b: arm.matrix_world @ arm.data.bones[b].head_local for b in torso_bones}


def is_shoulder(o):
    low = o.name.lower()
    return any(w in low for w in SHOULDER)


hombro = 0
for o in muscles:
    if not is_shoulder(o) or not torso_bones:
        continue
    cen = sum((o.matrix_world @ v.co for v in o.data.vertices), Vector()) / len(o.data.vertices)
    tgt = min(torso_bones, key=lambda b: (cen - tb_head[b]).length)
    for g in list(o.vertex_groups):
        o.vertex_groups.remove(g)
    vg = o.vertex_groups.new(name=tgt)
    vg.add([v.index for v in o.data.vertices], 1.0, "REPLACE")
    hombro += 1
print("HOMBRO rigidos", hombro, flush=True)

# glTF admite 4 huesos por vertice: recortamos y normalizamos.
for o in muscles:
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
print("PESOS copiados de la piel (kdtree)", flush=True)

# -------------------------------------------------- adelgazar
for o in muscles:
    count = len(o.data.polygons)
    if count <= 1600:
        continue
    m = o.modifiers.new("Reducir", "DECIMATE")
    m.ratio = max(0.1, min(0.5, 1600 / count))
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    try:
        bpy.ops.object.modifier_apply(modifier="Reducir")
    except RuntimeError:
        o.modifiers.remove(m)
print("CARAS", sum(len(o.data.polygons) for o in muscles), flush=True)

# -------------------------------------------------- armadura + padre (igual que 'cuerpo')
# cuerpo cuelga del rig con local identidad y sus vertices en el espacio del
# esqueleto. Replicamos eso: horneamos los vertices a ese espacio y dejamos la
# transform del objeto igual a la del rig. Asi deforman identico a la piel.
inv = arm.matrix_world.inverted()
for o in muscles:
    o.data.transform(inv @ o.matrix_world)   # vertices -> espacio del esqueleto
    o.parent = arm
    o.parent_type = "OBJECT"
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.matrix_local = Matrix.Identity(4)      # igual que 'cuerpo': NO duplicar el giro del rig
    md = o.modifiers.new("Armature", "ARMATURE")
    md.object = arm
    md.use_vertex_groups = True
arm.data.pose_position = "POSE"
bpy.context.view_layer.update()

bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True)
for o in muscles:
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True,
    export_animations=True, export_skins=True, export_yup=True,
)
print("GLB", OUT, flush=True)

# -------------------------------------------------- render de prueba
scene = bpy.context.scene
scene.render.resolution_x = 640
scene.render.resolution_y = 900
scene.view_settings.view_transform = "Standard"
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
world = bpy.data.worlds.new("fondo"); scene.world = world; world.color = (0.16, 0.17, 0.19)
sun = bpy.data.objects.new("Sol", bpy.data.lights.new("Sol", "SUN"))
sun.data.energy = 4.5; bpy.context.collection.objects.link(sun); sun.rotation_euler = (0.9, 0.2, 0.6)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
bpy.context.collection.objects.link(cam); scene.camera = cam; cam.data.lens = 45
cam.location = (0.0, 0.9, 3.6)
cam.rotation_euler = (Vector((0, 0.9, 0.5)) - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
# dejar solo musculos + rig; borrar maniqui, piel y props
for o in list(bpy.data.objects):
    if o.type == "MESH" and not o.name.startswith("musculo_"):
        bpy.data.objects.remove(o, do_unlink=True)


def shot(action_name, frame, path):
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
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("FOTO", path, flush=True)


shot(None, 1, STILL + r"\v2-reposo.png")
shot("Curl con mancuernas", 73, STILL + r"\v2-curl.png")
shot("Press de banca con mancuernas", 73, STILL + r"\v2-press.png")
shot("Sentadilla con barra", 73, STILL + r"\v2-sentadilla.png")
