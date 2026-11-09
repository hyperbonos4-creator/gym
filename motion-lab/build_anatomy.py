"""Pectoral, deltoides anterior y tríceps, en dos modos.

Superficie: una lámina de 1,5 mm sobre la piel, sin placa.
Anatomía: el mismo contorno, con vientre y borde fino.
No se mezclan en la misma vista.
"""

import math

import bpy
import bmesh
from mathutils import Matrix, Vector, kdtree

SRC = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio-anatomia.glb"
STILL = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\catalog"

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

FRONT = Vector((0.0, -1.0, 0.0))
world_to_body = body.matrix_world.inverted()
body_rot = body.matrix_world.to_3x3()

tree = kdtree.KDTree(len(body.data.vertices))
for vert in body.data.vertices:
    tree.insert(body.matrix_world @ vert.co, vert.index)
tree.balance()


def bone_point(name, where):
    bone = arm.data.bones[name]
    local = bone.head_local if where == "head" else bone.tail_local
    return arm.matrix_world @ local


def skin(point, prefer):
    _co, index, _dist = tree.find(point)
    vert = body.data.vertices[index]
    world = body.matrix_world @ vert.co
    normal = (body_rot @ vert.normal).normalized()
    if normal.length < 1e-5:
        normal = prefer.normalized()
    if normal.dot(prefer) < 0.0:
        normal.negate()
    return world, normal


def mesh_world(name, rows):
    nv = len(rows)
    nu = len(rows[0])
    verts = list(rows and [point for row in rows for point in row])
    faces = []
    for j in range(nv - 1):
        for i in range(nu - 1):
            a = j * nu + i
            faces.append((a, a + 1, a + 1 + nu, a + nu))
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.matrix_world = Matrix.Identity(4)
    return obj, nu, nv


def rebase(obj):
    inv = body.matrix_world.inverted()
    for vert in obj.data.vertices:
        vert.co = inv @ (obj.matrix_world @ vert.co)
    obj.parent = body.parent
    obj.matrix_world = body.matrix_world.copy()


def close_volume(name, outer, inner):
    nv = len(outer)
    nu = len(outer[0])
    rows = outer + inner
    obj, _nu, _nv = mesh_from_rows(name, rows)
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    mesh.faces.ensure_lookup_table()
    half = nu * nv
    for face in list(mesh.faces):
        if face.verts[0].index >= half:
            face.normal_flip()
    mesh.verts.ensure_lookup_table()

    def vid(layer, j, i):
        return layer * half + j * nu + i

    rim = []
    for i in range(nu - 1):
        rim.append((vid(0, 0, i), vid(0, 0, i + 1), vid(1, 0, i + 1), vid(1, 0, i)))
        rim.append((vid(0, nv - 1, i + 1), vid(0, nv - 1, i), vid(1, nv - 1, i), vid(1, nv - 1, i + 1)))
    for j in range(nv - 1):
        rim.append((vid(0, j + 1, 0), vid(0, j, 0), vid(1, j, 0), vid(1, j + 1, 0)))
        rim.append((vid(0, j, nu - 1), vid(0, j + 1, nu - 1), vid(1, j + 1, nu - 1), vid(1, j, nu - 1)))
    mesh.verts.ensure_lookup_table()
    for face in rim:
        mesh.faces.new([mesh.verts[index] for index in face])
    mesh.normal_update()
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()
    return obj


def bind(obj):
    groups = {group.name: obj.vertex_groups.new(name=group.name) for group in body.vertex_groups}
    for vert in obj.data.vertices:
        world = obj.matrix_world @ vert.co
        _co, index, _dist = tree.find(world)
        for group in body.vertex_groups:
            try:
                weight = group.weight(index)
            except RuntimeError:
                continue
            if weight > 0.001:
                groups[group.name].add([vert.index], weight, "REPLACE")
    bone = obj.modifiers.new("Armature", "ARMATURE")
    bone.object = arm
    for poly in obj.data.polygons:
        poly.use_smooth = True


def aim_out(obj, prefer, cap=None):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    mesh.faces.ensure_lookup_table()
    mesh.normal_update()
    total = Vector()
    faces = mesh.faces[:cap] if cap else mesh.faces
    for face in faces:
        total += face.normal * face.calc_area()
    if total.dot(prefer) < 0.0:
        bmesh.ops.reverse_faces(mesh, faces=mesh.faces)
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def mirror(src):
    dup = src.copy()
    dup.data = src.data.copy()
    dup.name = src.name[:-1] + "r"
    bpy.context.collection.objects.link(dup)
    dup.parent = src.parent
    dup.matrix_world = src.matrix_world.copy()
    for vert in dup.data.vertices:
        vert.co.x *= -1
    mesh = bmesh.new()
    mesh.from_mesh(dup.data)
    bmesh.ops.reverse_faces(mesh, faces=mesh.faces)
    mesh.to_mesh(dup.data)
    mesh.free()
    dup.data.update()
    for group in list(dup.vertex_groups):
        if not group.name.endswith("_l"):
            continue
        target_name = group.name[:-2] + "_r"
        target = dup.vertex_groups.get(target_name)
        if target is None:
            group.name = target_name
            continue
        for vert in dup.data.vertices:
            try:
                weight = group.weight(vert.index)
            except RuntimeError:
                continue
            if weight > 0.0:
                target.add([vert.index], weight, "REPLACE")
        dup.vertex_groups.remove(group)
    if not any(mod.type == "ARMATURE" for mod in dup.modifiers):
        bone = dup.modifiers.new("Armature", "ARMATURE")
        bone.object = arm
    return dup


def material(name, color, emission, strength):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.46
    bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    return mat


CLAV_H = bone_point("clavicle_l", "head")
CLAV_T = bone_point("clavicle_l", "tail")
ARM_H = bone_point("upperarm_l", "head")
ARM_T = bone_point("upperarm_l", "tail")
ELBOW = bone_point("lowerarm_l", "head")
ARM_AXIS = (ARM_T - ARM_H).normalized()
BACK = Vector((0.0, 1.0, 0.0))
ARM_FRONT = (FRONT - ARM_AXIS * FRONT.dot(ARM_AXIS)).normalized()
ARM_SIDE = ARM_AXIS.cross(ARM_FRONT).normalized()
if ARM_SIDE.x < 0.0:
    ARM_SIDE.negate()
ARM_BACK = (BACK - ARM_AXIS * BACK.dot(ARM_AXIS)).normalized()


def ray(origin, direction, reach=0.7):
    hit = body.ray_cast(origin, direction, distance=reach)
    if not hit[0]:
        return None
    normal = hit[2].normalized()
    if normal.dot(direction) > 0.0:
        normal.negate()
    return hit[1], normal


def on_front(x, z):
    found = ray(Vector((x, -0.55, z)), Vector((0.0, 1.0, 0.0)))
    if found is None:
        return Vector((x, -0.1, z)), FRONT.copy()
    loc, normal = found
    if normal.dot(FRONT) < 0.45:
        normal = FRONT.copy()
    return loc, normal


def on_arm(center, direction):
    found = ray(center + direction * 0.12, -direction, 0.28)
    if found is None:
        return center, direction.normalized()
    return found


def grid_of(nu, nv, point_at):
    rows = []
    normals = []
    for j in range(nv):
        v = j / (nv - 1)
        row = []
        normal_row = []
        for i in range(nu):
            u = i / (nu - 1)
            world, normal = point_at(u, v)
            row.append(world)
            normal_row.append(normal)
        rows.append(row)
        normals.append(normal_row)
    return rows, normals


CHEST_OUT = Vector((0.0, 0.0, 1.0))
INTO_CHEST = Vector((0.0, 0.0, -1.0))


def pec_surface():
    """Pectoral mayor sobre el maniquí público: el frente mira a +Z y la altura va en Y."""

    def point_at(u, v):
        # u medial -> lateral, v inferior -> superior. Delante de la piel.
        y = (1.02 * (1.0 - u) + 1.14 * u) * (1.0 - v) + (1.34 * (1.0 - u) + 1.30 * u) * v
        x = 0.02 * (1.0 - u) + (0.09 + v * 0.05) * u
        return Vector((x, y, 1.15)), CHEST_OUT.copy()

    return grid_of(12, 14, point_at)


def delt_surface():
    """Deltoides anterior, separado del pectoral por el surco deltopectoral."""

    def point_at(u, v):
        x = 0.158 + u * 0.052
        y = 1.285 + v * 0.07
        return Vector((x, y, 1.15)), CHEST_OUT.copy()

    return grid_of(5, 6, point_at)


def triceps_surface():
    """Tríceps en la cara posterior del brazo, del hombro al codo."""

    def point_at(u, v):
        center = ARM_H.lerp(ELBOW, 0.22 + 0.55 * v)
        origin = center + ARM_BACK * 0.14 + ARM_SIDE * (u - 0.5) * 0.045
        return origin, ARM_BACK.copy()

    return grid_of(6, 14, point_at)


THIGH_H = bone_point("thigh_l", "head")
THIGH_T = bone_point("thigh_l", "tail")
CALF_H = bone_point("calf_l", "head")
CALF_T = bone_point("calf_l", "tail")
BACK_OUT = Vector((0.0, 0.0, -1.0))
INTO_BACK = Vector((0.0, 0.0, 1.0))


def biceps_surface():
    """Bíceps en la cara anterior del brazo. El frente del maniquí es +Z."""

    def point_at(u, v):
        center = ARM_H.lerp(ELBOW, 0.18 + 0.62 * v)
        origin = Vector((center.x + (u - 0.5) * 0.055, center.y, 1.15))
        return origin, CHEST_OUT.copy()

    return grid_of(6, 12, point_at)


def delt_lateral_surface():
    """Deltoides lateral, en el costado del hombro, separado del anterior."""

    def point_at(u, v):
        center = ARM_H.lerp(ARM_T, 0.02 + 0.22 * v)
        origin = center + ARM_SIDE * (0.09 + u * 0.03)
        return origin, ARM_SIDE.copy()

    return grid_of(5, 6, point_at)


def back_surface():
    """Espalda: dorsal y trapecio como una región educativa sobre la piel posterior."""

    def point_at(u, v):
        y = 1.00 + v * 0.34
        x = 0.025 + u * 0.15
        return Vector((x, y, 0.12)), BACK_OUT.copy()

    return grid_of(8, 12, point_at)


def abs_surface():
    def point_at(u, v):
        y = 0.96 + v * 0.16
        x = 0.015 + u * 0.09
        return Vector((x, y, 1.15)), CHEST_OUT.copy()

    return grid_of(6, 8, point_at)


def quad_surface():
    def point_at(u, v):
        center = THIGH_H.lerp(THIGH_T, 0.12 + 0.68 * v)
        origin = center + Vector(((u - 0.5) * 0.07, 0.0, 0.16))
        return origin, CHEST_OUT.copy()

    return grid_of(6, 12, point_at)


def ham_surface():
    def point_at(u, v):
        center = THIGH_H.lerp(THIGH_T, 0.18 + 0.6 * v)
        origin = center + Vector(((u - 0.5) * 0.055, 0.0, -0.16))
        return origin, BACK_OUT.copy()

    return grid_of(5, 10, point_at)


def glute_surface():
    def point_at(u, v):
        x = 0.035 + u * 0.11
        y = 0.80 + v * 0.13
        return Vector((x, y, 0.18)), BACK_OUT.copy()

    return grid_of(6, 6, point_at)


def calf_surface():
    def point_at(u, v):
        center = CALF_H.lerp(CALF_T, 0.08 + 0.5 * v)
        origin = center + Vector(((u - 0.5) * 0.04, 0.0, -0.12))
        return origin, BACK_OUT.copy()

    return grid_of(5, 10, point_at)


FORE_H = bone_point("lowerarm_l", "head")
FORE_T = bone_point("lowerarm_l", "tail")


def delt_posterior_surface():
    """Deltoides posterior, detrás del hombro."""

    def point_at(u, v):
        center = ARM_H.lerp(ARM_T, 0.04 + 0.22 * v)
        origin = Vector((center.x + (u - 0.5) * 0.05, center.y + 0.01, 0.12))
        return origin, BACK_OUT.copy()

    return grid_of(5, 6, point_at)


def forearm_surface():
    """Antebrazo en la cara anterior, del codo a la muñeca."""

    def point_at(u, v):
        center = FORE_H.lerp(FORE_T, 0.12 + 0.62 * v)
        origin = Vector((center.x + (u - 0.5) * 0.04, center.y, 1.15))
        return origin, CHEST_OUT.copy()

    return grid_of(4, 10, point_at)


def adductor_surface():
    """Aductores en la cara interna del muslo."""

    def point_at(u, v):
        center = THIGH_H.lerp(THIGH_T, 0.16 + 0.55 * v)
        origin = Vector((0.02 + u * 0.03, center.y, center.z))
        return origin, Vector((-1.0, 0.0, 0.0))

    return grid_of(4, 8, point_at)


def swell(rows, normals, base, amount):
    nv = len(rows)
    nu = len(rows[0])
    outer = []
    for j in range(nv):
        v = j / (nv - 1)
        row = []
        for i in range(nu):
            u = i / (nu - 1)
            rim = min(u, 1.0 - u, v, 1.0 - v)
            belly = math.sin(math.pi * u) * math.sin(math.pi * v)
            tendon = 1.0 - 0.55 * v
            depth = base + amount * belly * tendon * min(1.0, rim * 4.0)
            row.append(rows[j][i] + normals[j][i] * depth)
        outer.append(row)
    return outer


built = []


def plant(obj, direction, reach, offset):
    """Apoya cada vértice en la piel, lanzando el rayo hacia el cuerpo."""
    inv = body.matrix_world.inverted()
    rot = body.matrix_world.to_3x3()
    inward = direction.normalized()
    local_dir = (inv.to_3x3() @ inward).normalized()
    missed = []
    for vert in obj.data.vertices:
        origin = obj.matrix_world @ vert.co
        hit, loc, normal, _index = body.ray_cast(inv @ origin, local_dir, distance=reach)
        if not hit:
            missed.append(vert.index)
            continue
        nrm = (rot @ normal).normalized()
        if nrm.dot(-inward) < 0.25:
            missed.append(vert.index)
            continue
        world = body.matrix_world @ loc
        vert.co = obj.matrix_world.inverted() @ (world - inward * offset)
    if not missed:
        return 0
    gone = set(missed)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for vert in obj.data.vertices:
        vert.select = vert.index in gone
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    return len(gone)


def delete_verts(obj, indices):
    gone = set(indices)
    if not gone:
        return 0
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for vert in obj.data.vertices:
        vert.select = vert.index in gone
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")
    return len(gone)


def owns(name, kinds):
    return any(name.startswith(kind) for kind in kinds)


def drop_foreign(obj, kinds, minimum):
    """Quita la piel que pertenece al brazo o a la mano, para que el músculo no se estire con ella."""
    doomed = []
    for vert in obj.data.vertices:
        _co, index, _dist = tree.find(obj.matrix_world @ vert.co)
        total = 0.0
        for group in body.vertex_groups:
            if not owns(group.name, kinds):
                continue
            try:
                total += group.weight(index)
            except RuntimeError:
                continue
        if total < minimum:
            doomed.append(vert.index)
    return delete_verts(obj, doomed)


def clamp_weights(obj, kinds, fallback):
    for vert in obj.data.vertices:
        kept = []
        total = 0.0
        for group in list(obj.vertex_groups):
            try:
                weight = group.weight(vert.index)
            except RuntimeError:
                continue
            if owns(group.name, kinds):
                kept.append((group, weight))
                total += weight
            elif weight > 0.0:
                group.remove([vert.index])
        if total < 0.001:
            obj.vertex_groups[fallback].add([vert.index], 1.0, "REPLACE")
            continue
        for group, weight in kept:
            group.add([vert.index], weight / total, "REPLACE")


def add_pair(key, surface, _normals, prefer=FRONT, project=None, reach=0.9, kinds=("spine",), fallback="spine_03", minimum=0.35):
    shell, _nu, _nv = mesh_world(f"superficie_{key}_l", surface)
    if project is None:
        project = Vector((0.0, 1.0, 0.0))
    missed = plant(shell, project, reach, 0.0022)
    foreign = drop_foreign(shell, kinds, minimum)
    if len(shell.data.vertices) < 4:
        print(key, "DESCARTADO", "verts", len(shell.data.vertices), "fuera", missed, "ajenos", foreign, flush=True)
        bpy.data.objects.remove(shell, do_unlink=True)
        return
    rebase(shell)
    aim_out(shell, prefer)
    bind(shell)
    clamp_weights(shell, kinds, fallback)
    built.append(shell)
    volume = shell.copy()
    volume.data = shell.data.copy()
    volume.name = f"musculo_{key}_l"
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
    thick.thickness = 0.008
    thick.offset = 1.0
    bpy.ops.object.modifier_apply(modifier="Grosor")
    bone = volume.modifiers.new("Armature", "ARMATURE")
    bone.object = arm
    built.append(volume)
    print(key, "verts", len(shell.data.vertices), "fuera", missed, "ajenos", foreign, flush=True)


add_pair(
    "pecho",
    *pec_surface(),
    CHEST_OUT,
    project=INTO_CHEST,
    reach=1.2,
    kinds=("spine", "clavicle", "neck", "pelvis"),
    fallback="spine_03",
    minimum=0.4,
)
add_pair(
    "deltoides-anterior",
    *delt_surface(),
    CHEST_OUT,
    project=INTO_CHEST,
    reach=1.2,
    kinds=("clavicle", "upperarm"),
    fallback="upperarm_l",
    minimum=0.45,
)
add_pair(
    "triceps",
    *triceps_surface(),
    ARM_BACK,
    project=-ARM_BACK,
    reach=0.22,
    kinds=("upperarm",),
    fallback="upperarm_l",
    minimum=0.55,
)
add_pair(
    "biceps",
    *biceps_surface(),
    CHEST_OUT,
    project=INTO_CHEST,
    reach=1.2,
    kinds=("upperarm",),
    fallback="upperarm_l",
    minimum=0.45,
)
add_pair(
    "deltoides-lateral",
    *delt_lateral_surface(),
    ARM_SIDE,
    project=-ARM_SIDE,
    reach=0.22,
    kinds=("upperarm", "clavicle"),
    fallback="upperarm_l",
    minimum=0.4,
)
add_pair(
    "espalda",
    *back_surface(),
    BACK_OUT,
    project=INTO_BACK,
    reach=1.1,
    kinds=("spine", "clavicle", "pelvis"),
    fallback="spine_02",
    minimum=0.3,
)
add_pair(
    "abdomen",
    *abs_surface(),
    CHEST_OUT,
    project=INTO_CHEST,
    reach=1.2,
    kinds=("spine", "pelvis"),
    fallback="spine_01",
    minimum=0.3,
)
add_pair(
    "cuadriceps",
    *quad_surface(),
    CHEST_OUT,
    project=INTO_CHEST,
    reach=0.4,
    kinds=("thigh",),
    fallback="thigh_l",
    minimum=0.4,
)
add_pair(
    "isquiotibiales",
    *ham_surface(),
    BACK_OUT,
    project=INTO_BACK,
    reach=0.4,
    kinds=("thigh",),
    fallback="thigh_l",
    minimum=0.4,
)
add_pair(
    "gluteos",
    *glute_surface(),
    BACK_OUT,
    project=INTO_BACK,
    reach=0.7,
    kinds=("pelvis", "thigh"),
    fallback="pelvis",
    minimum=0.25,
)
add_pair(
    "pantorrillas",
    *calf_surface(),
    BACK_OUT,
    project=INTO_BACK,
    reach=0.35,
    kinds=("calf",),
    fallback="calf_l",
    minimum=0.4,
)
add_pair(
    "deltoides-posterior",
    *delt_posterior_surface(),
    BACK_OUT,
    project=INTO_BACK,
    reach=1.0,
    kinds=("upperarm", "clavicle"),
    fallback="upperarm_l",
    minimum=0.35,
)
add_pair(
    "antebrazos",
    *forearm_surface(),
    CHEST_OUT,
    project=INTO_CHEST,
    reach=1.2,
    kinds=("lowerarm",),
    fallback="lowerarm_l",
    minimum=0.4,
)
add_pair(
    "aductores",
    *adductor_surface(),
    Vector((-1.0, 0.0, 0.0)),
    project=Vector((1.0, 0.0, 0.0)),
    reach=0.35,
    kinds=("thigh",),
    fallback="thigh_l",
    minimum=0.35,
)

for src in list(built):
    built.append(mirror(src))

graphite = material("musculo_grafito", (0.42, 0.44, 0.47), (0.0, 0.0, 0.0), 0.0)
coral = material("musculo_coral", (0.77, 0.27, 0.22), (0.35, 0.06, 0.04), 0.12)
pale = material("musculo_tenue", (0.55, 0.34, 0.31), (0.16, 0.04, 0.03), 0.04)


def paint(active):
    for obj in built:
        kind = obj.name.split("_", 1)[1].rsplit("_", 1)[0]
        if not active:
            chosen = graphite
        elif kind in {"pecho", "deltoides-anterior", "triceps"}:
            chosen = coral
        else:
            chosen = pale
        obj.data.materials.clear()
        obj.data.materials.append(chosen)


scene = bpy.context.scene
scene.render.resolution_x = 960
scene.render.resolution_y = 720
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except TypeError:
    scene.render.engine = "BLENDER_EEVEE"
world = bpy.data.worlds.new("fondo")
scene.world = world
world.color = (0.07, 0.08, 0.10)
key = bpy.data.objects.new("Key", bpy.data.lights.new("Key", "AREA"))
key.data.energy = 450
key.data.size = 3
bpy.context.collection.objects.link(key)
key.location = (1.4, -2.4, 2.2)
fill = bpy.data.objects.new("Fill", bpy.data.lights.new("Fill", "AREA"))
fill.data.energy = 180
fill.data.size = 3
bpy.context.collection.objects.link(fill)
fill.location = (-1.6, -1.2, 1.4)
cam = bpy.data.objects.new("Cam", bpy.data.cameras.new("Cam"))
bpy.context.collection.objects.link(cam)
scene.camera = cam


def shoot(path, location, target, extra, mode):
    allow = {"cuerpo", *extra}
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if obj.name.startswith("superficie_"):
            obj.hide_render = mode != "superficie"
        elif obj.name.startswith("musculo_"):
            obj.hide_render = mode != "anatomia"
        else:
            obj.hide_render = obj.name not in allow
    cam.location = location
    aim = Vector(target) - Vector(location)
    cam.rotation_euler = aim.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("FOTO", path, flush=True)


def play(name):
    action = bpy.data.actions[name]
    arm.animation_data_create()
    arm.animation_data.action = action
    slots = list(getattr(action, "slots", []) or [])
    if slots and hasattr(arm.animation_data, "action_slot"):
        arm.animation_data.action_slot = slots[0]


paint(True)
chest = Vector((0.0, -0.1, 0.82))
shoot(STILL + r"\anat3-reposo-frente.png", (0.05, -2.5, 1.05), chest, set(), "superficie")
shoot(STILL + r"\anat3-reposo-lado.png", (2.3, 0.05, 1.0), chest, set(), "superficie")
shoot(STILL + r"\anat3-reposo-tres.png", (1.7, -1.7, 1.15), chest, set(), "superficie")
shoot(STILL + r"\anat3-reposo-anatomia.png", (1.5, -1.8, 1.2), chest, set(), "anatomia")

BENCH = {
    "frente": ((0.2, 3.05, 1.85), (0.0, 0.85, 0.45)),
    "lado": ((2.7, 0.85, 0.95), (0.0, 1.0, 0.55)),
    "tres": ((1.7, -0.15, 1.45), (0.0, 1.05, 0.55)),
}


def exercise(action, props, tag):
    play(action)
    for frame, moment in ((1, "abajo"), (73, "arriba")):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        hand = arm.matrix_world @ arm.pose.bones["hand_l"].head
        bell_name = next(name for name in props if name.endswith("_l"))
        bell = bpy.data.objects[bell_name]
        gap = (bell.matrix_world.translation - hand).length
        print(tag, moment, "agarre", round(gap, 3), flush=True)
        for view, (location, target) in BENCH.items():
            shoot(STILL + rf"\anat3-{tag}-{moment}-{view}.png", location, target, set(props), "superficie")


exercise(
    "Press de banca con mancuernas",
    ["db_press-banca-mancuernas_l", "db_press-banca-mancuernas_r", "banco"],
    "press",
)
exercise(
    "Aperturas con mancuernas",
    ["db_aperturas_l", "db_aperturas_r", "banco"],
    "fly",
)

for obj in (key, fill, cam):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.object.select_all(action="SELECT")
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
