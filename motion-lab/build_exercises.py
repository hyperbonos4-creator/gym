"""Genera tres ciclos propios sobre el maniquí CC0. No usa Mixamo."""

import json
import math
from math import radians
from mathutils import Vector, Matrix
import bpy

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out"
FPS = 24
# Una repetición de 5 s: 3 s de bajada, 0,2 s abajo, 1,5 s de subida, 0,3 s arriba.
ECC_S = 3.0
HOLD_BOTTOM_S = 0.2
CON_S = 1.5
HOLD_TOP_S = 0.3
CYCLE_S = ECC_S + HOLD_BOTTOM_S + CON_S + HOLD_TOP_S
FRAMES = int(round(CYCLE_S * FPS))
BOTTOM_FRAME = int(round(ECC_S * FPS)) + 1
SHARED = {"arm": None, "body": None, "props": []}


def clean_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def new_mesh(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def cylinder(name, radius, depth, along="X", at=(0, 0, 0)):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=at)
    obj = bpy.context.active_object
    obj.name = name
    if along == "X":
        obj.rotation_euler = (0, radians(90), 0)
    elif along == "Y":
        obj.rotation_euler = (radians(90), 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return obj


def empty(name, location):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_size = 0.04
    obj.location = Vector(location)
    return obj


def load_body():
    clean_scene()
    bpy.ops.import_scene.gltf(filepath=SRC)
    arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    meshes = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    # El archivo de origen trae un icosferoide suelto además del maniquí.
    body = max(meshes, key=lambda obj: len(obj.data.vertices))
    for obj in meshes:
        if obj is not body:
            bpy.data.objects.remove(obj, do_unlink=True)
    arm.name = "rig"
    body.name = "cuerpo"
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.context.view_layer.update()
    return arm, body


def bone_world(arm, name, where="head"):
    bpy.context.view_layer.update()
    return arm.matrix_world @ getattr(arm.pose.bones[name], where)


def rest_pose(arm):
    """Vuelve al reposo y suelta la acción, sin borrar las que ya se hornearon."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.location = (0, 0, 0)
    arm.rotation_mode = "XYZ"
    arm.rotation_euler = (0, 0, 0)
    bpy.ops.object.mode_set(mode="POSE")
    for bone in arm.pose.bones:
        for constraint in list(bone.constraints):
            bone.constraints.remove(constraint)
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.pose.transforms_clear()
    bpy.ops.pose.select_all(action="DESELECT")
    if arm.animation_data:
        arm.animation_data.action = None
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()


def keep_action(obj, name):
    action = obj.animation_data.action if obj.animation_data else None
    if not action:
        return None
    action.name = name
    action.use_fake_user = True
    return action


def acquire_body():
    """Los tres ejercicios comparten la misma malla. Cada uno trae su propia acción."""
    if SHARED["arm"] is None:
        arm, body = load_body()
        SHARED["arm"] = arm
        SHARED["body"] = body
        prepare_render()
    else:
        rest_pose(SHARED["arm"])
    return SHARED["arm"], SHARED["body"]


def sole_reference(arm):
    """Guarda la orientación del pie con la planta apoyada, antes de mover nada."""
    bpy.context.view_layer.update()
    return {
        side: (arm.matrix_world @ arm.pose.bones[f"foot_{side}"].matrix).to_quaternion()
        for side in ("l", "r")
    }


def add_ik(arm, bone, target, pole, chain, angle_deg):
    ik = arm.pose.bones[bone].constraints.new("IK")
    ik.target = target
    ik.pole_target = pole
    ik.chain_count = chain
    ik.pole_angle = radians(angle_deg)
    return ik


def parent_keep(child, parent, bone=None):
    bpy.context.view_layer.update()
    world = child.matrix_world.copy()
    child.parent = parent
    if bone:
        child.parent_type = "BONE"
        child.parent_bone = bone
    else:
        child.parent_type = "OBJECT"
    child.matrix_world = world


def metal(obj, color):
    mat = bpy.data.materials.new(obj.name + "_mat")
    mat.diffuse_color = (*color, 1)
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def barbell(name, length=1.35, plate=0.18):
    bar = cylinder(name, 0.016, length, "X")
    left = cylinder(name + "_l", plate, 0.04, "X", (-length / 2, 0, 0))
    right = cylinder(name + "_r", plate, 0.04, "X", (length / 2, 0, 0))
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (bar, left, right):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = bar
    bpy.ops.object.join()
    bar = bpy.context.active_object
    bar.name = name
    metal(bar, (0.25, 0.27, 0.30))
    return bar


def dumbbell(name):
    return barbell(name, length=0.28, plate=0.07)


def gym_bench(head, hips):
    """Banco plano visible: colchoneta de la cabeza a la cadera y cuatro patas."""
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    along = Vector((head.x - hips.x, head.y - hips.y, 0))
    if along.length < 0.2:
        along = Vector((0, 1, 0))
    along.normalize()
    side = Vector((-along.y, along.x, 0))
    center = (Vector((head.x, head.y, 0)) + Vector((hips.x, hips.y, 0))) * 0.5
    # El hueso "head" está en la base del cráneo: la colchoneta se extiende más
    # allá para que la nuca quede apoyada y no colgando.
    center += along * 0.16
    top = 0.42
    bpy.ops.mesh.primitive_cube_add(size=1, location=(center.x, center.y, top - 0.03))
    pad = bpy.context.active_object
    pad.name = "banco"
    length = max(1.3, (head - hips).length + 0.6)
    pad.scale = (0.15, length / 2, 0.035)
    yaw = math.atan2(along.y, along.x) - radians(90)
    pad.rotation_euler = (0, 0, yaw)
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    metal(pad, (0.72, 0.74, 0.76))
    parts = [pad]
    for sx in (-1, 1):
        for sy in (-1, 1):
            leg_at = center + side * (0.11 * sx) + along * (length * 0.38 * sy)
            leg_at.z = top / 2 - 0.03
            leg = cylinder(f"pata_{sx}_{sy}", 0.02, top - 0.06, "Z", (leg_at.x, leg_at.y, leg_at.z))
            metal(leg, (0.32, 0.34, 0.36))
            parts.append(leg)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = pad
    bpy.ops.object.join()
    bench = bpy.context.active_object
    bench.name = "banco"
    return bench


def key_object(obj, frame, data_path="location"):
    obj.keyframe_insert(data_path, frame=frame)


def prepare_render():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 640
    scene.render.resolution_y = 800
    scene.render.fps = FPS
    scene.frame_start = 1
    scene.frame_end = FRAMES
    world = bpy.data.worlds.new("fondo")
    scene.world = world
    world.color = (0.09, 0.10, 0.12)
    if "Cam" not in bpy.data.objects:
        cam_data = bpy.data.cameras.new("Cam")
        cam_data.lens = 48
        cam = bpy.data.objects.new("Cam", cam_data)
        bpy.context.collection.objects.link(cam)
        scene.camera = cam
        light_data = bpy.data.lights.new("Key", "AREA")
        light_data.energy = 280
        light_data.size = 2
        light = bpy.data.objects.new("Key", light_data)
        bpy.context.collection.objects.link(light)
        light.location = (1.1, -1.8, 2.5)


def shoot(path, location, rotation):
    cam = bpy.data.objects["Cam"]
    cam.location = location
    cam.rotation_euler = rotation
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def shoot_at(path, location, target):
    cam = bpy.data.objects["Cam"]
    cam.location = location
    direction = Vector(target) - Vector(location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def bake_pose(arm):
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="POSE")
    bpy.ops.pose.select_all(action="SELECT")
    bpy.ops.nla.bake(
        frame_start=1,
        frame_end=FRAMES,
        step=1,
        only_selected=True,
        visual_keying=True,
        clear_constraints=True,
        clear_parents=False,
        use_current_action=True,
        bake_types={"POSE"},
    )
    action = arm.animation_data.action if arm.animation_data else None
    bpy.ops.object.mode_set(mode="OBJECT")
    return action


def export_glb(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_skins=True,
        export_yup=True,
    )


def angle_deg(a, b, c):
    u = (a - b).normalized()
    v = (c - b).normalized()
    return math.degrees(math.acos(max(-1, min(1, u.dot(v)))))


def measure(arm, prop_names):
    rows = []
    for frame in range(1, FRAMES + 1, 2):
        bpy.context.scene.frame_set(frame)
        hip = bone_world(arm, "pelvis", "head")
        knee_l = bone_world(arm, "calf_l", "head")
        ankle_l = bone_world(arm, "calf_l", "tail")
        hip_l = bone_world(arm, "thigh_l", "head")
        knee_r = bone_world(arm, "calf_r", "head")
        ankle_r = bone_world(arm, "calf_r", "tail")
        hip_r = bone_world(arm, "thigh_r", "head")
        hand_l = bone_world(arm, "hand_l", "head")
        hand_r = bone_world(arm, "hand_r", "head")
        elbow_l = angle_deg(bone_world(arm, "upperarm_l", "head"), bone_world(arm, "lowerarm_l", "head"), hand_l)
        row = {
            "frame": frame,
            "hip_z": round(hip.z, 3),
            "ankle_l": [round(ankle_l.x, 3), round(ankle_l.y, 3), round(ankle_l.z, 3)],
            "ankle_r": [round(ankle_r.x, 3), round(ankle_r.y, 3), round(ankle_r.z, 3)],
            "knee_l_deg": round(angle_deg(hip_l, knee_l, ankle_l), 1),
            "knee_r_deg": round(angle_deg(hip_r, knee_r, ankle_r), 1),
            "elbow_l_deg": round(elbow_l, 1),
            "hand_l": [round(hand_l.x, 3), round(hand_l.y, 3), round(hand_l.z, 3)],
            "hand_r": [round(hand_r.x, 3), round(hand_r.y, 3), round(hand_r.z, 3)],
            "planta_izq_deg": round(sole_pitch(arm, "l"), 1),
            "planta_der_deg": round(sole_pitch(arm, "r"), 1),
        }
        for prop_name in prop_names:
            prop = bpy.data.objects[prop_name]
            center = prop.matrix_world.translation
            row[prop_name] = [round(center.x, 3), round(center.y, 3), round(center.z, 3)]
            row[prop_name + "_gap_l"] = round((hand_l - center).length, 3)
            if prop_name.startswith("barra"):
                # La barra es un eje a lo largo de X: lo que importa es cuánto se
                # aleja la mano de ese eje, no del centro.
                row["barra_eje_l"] = round(math.dist((hand_l.y, hand_l.z), (center.y, center.z)), 3)
                row["barra_eje_r"] = round(math.dist((hand_r.y, hand_r.z), (center.y, center.z)), 3)
        rows.append(row)
    return rows


def sole_pitch(arm, side):
    """Cuánto se despega la planta de la horizontal, en grados. 0 = pie plano."""
    heel = bone_world(arm, f"foot_{side}", "head")
    toe = bone_world(arm, f"ball_{side}", "tail")
    span = toe - heel
    flat = math.hypot(span.x, span.y)
    if flat < 1e-5:
        return 90.0
    return abs(math.degrees(math.atan2(span.z, flat)))


def summarize(rows, label):
    first, last = rows[0], rows[-1]
    foot = max(
        math.dist(row["ankle_l"], first["ankle_l"])
        for row in rows
    )
    foot_r = max(math.dist(row["ankle_r"], first["ankle_r"]) for row in rows)
    loop = math.dist(first["hip_z"] and [first["hip_z"]], [last["hip_z"]])
    knees = [row["knee_l_deg"] for row in rows]
    elbows = [row["elbow_l_deg"] for row in rows]
    return {
        "ejercicio": label,
        "fotogramas": FRAMES,
        "fps": FPS,
        "deslizamiento_pie_izq_m": round(foot, 3),
        "deslizamiento_pie_der_m": round(foot_r, 3),
        "cadera_z_min": min(row["hip_z"] for row in rows),
        "cadera_z_max": max(row["hip_z"] for row in rows),
        "rodilla_grados": [min(knees), max(knees)],
        "codo_grados": [min(elbows), max(elbows)],
        "cierre_cadera_m": round(abs(first["hip_z"] - last["hip_z"]), 3),
        "planta_max_deg": max(max(row["planta_izq_deg"], row["planta_der_deg"]) for row in rows),
        "planta_variacion_deg": round(
            max(max(row["planta_izq_deg"], row["planta_der_deg"]) for row in rows)
            - min(min(row["planta_izq_deg"], row["planta_der_deg"]) for row in rows),
            2,
        ),
        "agarre_max_m": (
            max(max(row["barra_eje_l"], row["barra_eje_r"]) for row in rows)
            if "barra_eje_l" in first
            else None
        ),
        "muestras": rows[::4],
    }


def smooth(u):
    u = max(0.0, min(1.0, u))
    return u * u * (3 - 2 * u)


def fade(frame):
    """0 en la postura de inicio, 1 en el punto de más esfuerzo. La bajada dura el doble."""
    t = (frame - 1) / FPS
    if t < ECC_S:
        return smooth(t / ECC_S)
    if t < ECC_S + HOLD_BOTTOM_S:
        return 1.0
    risen = t - ECC_S - HOLD_BOTTOM_S
    if risen < CON_S:
        return 1.0 - smooth(risen / CON_S)
    return 0.0


def flatten_feet(arm, refs, frame):
    """Mantiene la planta como al inicio. El tobillo no se dobla al bajar."""
    bpy.context.view_layer.update()
    for side, quat in refs.items():
        foot = arm.pose.bones[f"foot_{side}"]
        world = arm.matrix_world @ foot.matrix
        held = Matrix.Translation(world.to_translation()) @ quat.to_matrix().to_4x4()
        foot.rotation_mode = "QUATERNION"
        foot.matrix = arm.matrix_world.inverted() @ held
        foot.keyframe_insert("rotation_quaternion", frame=frame)
        ball = arm.pose.bones[f"ball_{side}"]
        ball.rotation_mode = "XYZ"
        ball.rotation_euler = (0, 0, 0)
        ball.keyframe_insert("rotation_euler", frame=frame)


def build_squat():
    arm, body = acquire_body()
    bpy.context.scene.frame_set(1)
    foot_refs = sole_reference(arm)
    ankles = {side: bone_world(arm, f"calf_{side}", "tail").copy() for side in ("l", "r")}
    knees = {side: bone_world(arm, f"calf_{side}", "head").copy() for side in ("l", "r")}
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        foot = empty(f"pie_{side}", ankles[side])
        pole = empty(f"polo_rodilla_{side}", (knees[side].x + sign * 0.28, knees[side].y - 0.42, knees[side].z))
        add_ik(arm, f"calf_{side}", foot, pole, 2, -90)
    bar = barbell("barra_sentadilla", length=1.35, plate=0.16)
    SHARED["props"].append(bar)
    grips = {}
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        grips[side] = empty(f"agarre_{side}", (sign * 0.38, 0.05, 1.35))
        pole = empty(f"polo_codo_{side}", (sign * 0.46, -0.05, 1.05))
        parent_keep(pole, arm)
        add_ik(arm, f"hand_{side}", grips[side], pole, 3, -90)
    for frame in range(1, FRAMES + 1):
        u = fade(frame)
        bpy.context.scene.frame_set(frame)
        arm.location = (0, 0.05 * u, -0.34 * u)
        arm.rotation_mode = "XYZ"
        arm.rotation_euler = (0, 0, 0)
        key_object(arm, frame)
        key_object(arm, frame, "rotation_euler")
        lean = radians(16) * u
        for bone_name, angle in (("spine_01", lean * 0.45), ("spine_02", lean * 0.3)):
            bone = arm.pose.bones[bone_name]
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = (angle, 0, 0)
            bone.keyframe_insert("rotation_euler", frame=frame)
        bpy.context.view_layer.update()
        flatten_feet(arm, foot_refs, frame)
        neck = bone_world(arm, "neck_01", "head")
        center = Vector((neck.x, neck.y + 0.07, neck.z - 0.06))
        bar.rotation_mode = "XYZ"
        bar.location = center
        bar.rotation_euler = (0, 0, 0)
        key_object(bar, frame, "location")
        key_object(bar, frame, "rotation_euler")
        for side, grip in grips.items():
            sign = 1 if side == "l" else -1
            grip.location = center + Vector((sign * 0.36, -0.015, -0.01))
            key_object(grip, frame)
            close_hand(arm, side, frame)
    bake_pose(arm)
    keep_action(arm, "Sentadilla con barra")
    for frame in range(1, FRAMES + 1):
        wrap_hands(arm, bar, frame)
    keep_action(bar, "Barra sentadilla")
    report = summarize(measure(arm, ["barra_sentadilla"]), "sentadilla-barra")
    for frame, tag in ((1, "depie"), (BOTTOM_FRAME, "abajo")):
        bpy.context.scene.frame_set(frame)
        shoot(OUT + rf"\sentadilla-{tag}-frente.png", (0, -3.4, 0.9), (radians(82), 0, 0))
        shoot(OUT + rf"\sentadilla-{tag}-perfil.png", (3.3, 0.2, 0.9), (radians(82), 0, radians(90)))
    return report


CURL_DEGREES = (78, 100, 88)
THUMB_DEGREES = (48, 62, 42)


def apply_curl(arm, side, scale, frame):
    """Cierra los dedos hacia la palma. El mismo signo vale en las dos manos."""
    curls = tuple(radians(scale * angle) for angle in CURL_DEGREES)
    for finger in ("index", "middle", "ring", "pinky"):
        for index, angle in enumerate(curls, start=1):
            bone = arm.pose.bones[f"{finger}_0{index}_{side}"]
            bone.rotation_mode = "XYZ"
            bone.rotation_euler = (angle, 0, 0)
            bone.rotation_mode = "QUATERNION"
            bone.keyframe_insert("rotation_quaternion", frame=frame)
    thumb = tuple(radians(scale * angle) for angle in THUMB_DEGREES)
    for index, angle in enumerate(thumb, start=1):
        bone = arm.pose.bones[f"thumb_0{index}_{side}"]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (angle, 0, 0)
        bone.rotation_mode = "QUATERNION"
        bone.keyframe_insert("rotation_quaternion", frame=frame)


def close_hand(arm, side, frame):
    apply_curl(arm, side, 1.0, frame)


def axis_offset(point, origin, axis):
    delta = point - origin
    return delta - axis * delta.dot(axis)


def middle_tip(arm, side):
    return arm.matrix_world @ arm.pose.bones[f"middle_03_{side}"].tail


def tip_gap(arm, side, origin, axis):
    return axis_offset(middle_tip(arm, side), origin, axis).length


def choose_side(arm, side, origin, axis, frame):
    """Se queda con la media vuelta que acerca los dedos a la barra."""
    apply_curl(arm, side, 1.0, frame)
    bpy.context.view_layer.update()
    gap = tip_gap(arm, side, origin, axis)
    flip_hand(arm, side, axis)
    apply_curl(arm, side, 1.0, frame)
    bpy.context.view_layer.update()
    if tip_gap(arm, side, origin, axis) > gap:
        flip_hand(arm, side, axis)
        apply_curl(arm, side, 1.0, frame)


def best_scale(arm, side, origin, axis, frame):
    """El cierre que deja la punta del dedo más cerca de la barra."""
    best, best_gap = 1.0, 1e9
    for scale in (0.55, 0.75, 0.95, 1.15, 1.35, 1.55):
        apply_curl(arm, side, scale, frame)
        bpy.context.view_layer.update()
        gap = tip_gap(arm, side, origin, axis)
        if gap < best_gap:
            best, best_gap = scale, gap
    apply_curl(arm, side, best, frame)
    return best_gap


def pose_mode(arm):
    bpy.context.view_layer.objects.active = arm
    if bpy.context.object.mode != "POSE":
        bpy.ops.object.mode_set(mode="POSE")


def write_hand_matrix(arm, side, axes, origin):
    hand = arm.pose.bones[f"hand_{side}"]
    matrix = Matrix.Identity(4)
    for index, axis in enumerate(axes):
        matrix.col[index][:3] = axis
    matrix.translation = origin
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ matrix


def rotation_from_to(src, dst):
    src = src.normalized()
    dst = dst.normalized()
    cross = src.cross(dst)
    if cross.length < 1e-8:
        if src.dot(dst) > 0:
            return Matrix.Identity(3)
        return Matrix.Rotation(math.pi, 3, src.orthogonal())
    angle = math.acos(max(-1.0, min(1.0, src.dot(dst))))
    return Matrix.Rotation(angle, 3, cross)


def align_curl_axis(arm, side, bar_axis):
    """Gira la mano hasta que los dedos se cierran alrededor de la barra."""
    hand = arm.pose.bones[f"hand_{side}"]
    finger = arm.pose.bones[f"middle_01_{side}"]
    hand_world = arm.matrix_world @ hand.matrix
    finger_world = arm.matrix_world @ finger.matrix
    src = finger_world.col[0].xyz.normalized()
    dst = bar_axis.normalized()
    if src.dot(dst) < 0:
        dst = -dst
    rotated = rotation_from_to(src, dst) @ hand_world.to_3x3()
    matrix = rotated.to_4x4()
    matrix.translation = hand_world.translation.copy()
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ matrix


def palm_center(arm, side, reach):
    hand = arm.pose.bones[f"hand_{side}"]
    world = arm.matrix_world @ hand.matrix
    return world.translation + world.col[1].xyz.normalized() * reach


def spin_hand(arm, side, axis, angle):
    """Gira la mano alrededor del mango sin mover la muñeca."""
    hand = arm.pose.bones[f"hand_{side}"]
    world = arm.matrix_world @ hand.matrix
    spun = Matrix.Rotation(angle, 3, axis) @ world.to_3x3()
    matrix = spun.to_4x4()
    matrix.translation = world.translation.copy()
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ matrix


def finger_points(arm, side):
    points = []
    for finger in ("index", "middle", "ring", "pinky"):
        for index in (1, 2, 3):
            bone = arm.pose.bones[f"{finger}_0{index}_{side}"]
            points.append(arm.matrix_world @ bone.head)
        points.append(arm.matrix_world @ arm.pose.bones[f"{finger}_03_{side}"].tail)
    return points


def curl_direction(arm, side, axis):
    """Hacia dónde se cierra el puño, visto desde la muñeca."""
    wrist = arm.matrix_world @ arm.pose.bones[f"hand_{side}"].head
    offsets = []
    for point in finger_points(arm, side):
        delta = point - wrist
        offsets.append(delta - axis * delta.dot(axis))
    return sum(offsets, Vector()) / len(offsets)


def grip_hole(arm, side, axis, clearance=0.030):
    """Centro del puño: la barra entra hasta rozar los dedos, sin atravesarlos."""
    wrist = arm.matrix_world @ arm.pose.bones[f"hand_{side}"].head
    offsets = []
    for point in finger_points(arm, side):
        delta = point - wrist
        offsets.append(delta - axis * delta.dot(axis))
    center = sum(offsets, Vector()) / len(offsets)
    if center.length < 1e-5:
        return wrist.copy()
    direction = center.normalized()
    span = center.length
    low, high = 0.0, span
    for _ in range(18):
        mid = (low + high) * 0.5
        candidate = direction * mid
        gap = min((offset - candidate).length for offset in offsets)
        if gap > clearance:
            low = mid
        else:
            high = mid
    hole = wrist + direction * low
    along = (hole - wrist).dot(axis)
    return hole - axis * along


def flip_hand(arm, side, axis):
    spin_hand(arm, side, axis, math.pi)


def same_grip(arm, axis):
    """Las dos manos tienen que cerrar hacia el mismo lado de la barra."""
    if curl_direction(arm, "l", axis).dot(curl_direction(arm, "r", axis)) < 0:
        flip_hand(arm, "r", axis)
        apply_curl(arm, "r", 0.75, bpy.context.scene.frame_current)
        bpy.context.view_layer.update()


def tuck_target(arm, sides, axis):
    """La barra queda justo antes de la punta, del lado del nudillo, para que el dedo la envuelva."""
    tips = []
    knuckles = []
    for side in sides:
        tips.append(middle_tip(arm, side))
        knuckles.append(arm.matrix_world @ arm.pose.bones[f"middle_01_{side}"].head)
    tip = sum(tips, Vector()) / len(tips)
    knuckle = sum(knuckles, Vector()) / len(knuckles)
    toward = axis_offset(knuckle, tip, axis)
    if toward.length < 1e-4:
        return tip
    return tip + toward.normalized() * 0.018


def wrap_hands(arm, bar, frame):
    """Cierra las dos manos sobre el mismo eje y mete la barra en los puños."""
    pose_mode(arm)
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    axis = Vector((1, 0, 0))
    for side in ("l", "r"):
        align_curl_axis(arm, side, axis)
        apply_curl(arm, side, 0.75, frame)
    bpy.context.view_layer.update()
    same_grip(arm, axis)
    for side in ("l", "r"):
        apply_curl(arm, side, 0.75, frame)
    bpy.context.view_layer.update()
    target = tuck_target(arm, ("l", "r"), axis)
    bar.location.y = target.y
    bar.location.z = target.z
    bar.rotation_mode = "XYZ"
    bar.rotation_euler = (0, 0, 0)
    key_object(bar, frame, "location")
    key_object(bar, frame, "rotation_euler")
    for side in ("l", "r"):
        arm.pose.bones[f"hand_{side}"].keyframe_insert("rotation_quaternion", frame=frame)


# Ejes del dedo medio, medidos en el espacio local de la mano en reposo.
# El primero sigue el dedo; el segundo es el eje sobre el que se cierra el puño.
FINGER_ALONG = {
    "l": Vector((0.006, 0.108, -0.011)),
    "r": Vector((-0.006, 0.108, -0.011)),
}
FINGER_AXIS = {
    "l": Vector((0.696, -0.189, -0.693)),
    "r": Vector((0.696, 0.189, 0.693)),
}


def finger_frame(side):
    """Base ortonormal de la mano: dedo, eje del puño y palma."""
    along = FINGER_ALONG[side].normalized()
    axis = FINGER_AXIS[side]
    axis = (axis - along * axis.dot(along)).normalized()
    palm = along.cross(axis).normalized()
    return along, axis, palm


def supinate_curl(arm, side, frame, goal=None, scale=0.85):
    """Muñeca recta. La palma mira hacia `goal`: arriba en el curl, al frente si el brazo cuelga."""
    pose_mode(arm)
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    elbow = bone_world(arm, f"lowerarm_{side}", "head")
    wrist = bone_world(arm, f"hand_{side}", "head")
    forearm = wrist - elbow
    if forearm.length < 1e-5:
        forearm = Vector((0, 0, -1))
    forearm.normalize()
    # Hacia el techo, y hacia el frente cuando el brazo cuelga.
    # Los dedos se cierran hacia ese lado: la mancuerna queda sobre la palma.
    palm = goal.copy() if goal is not None else Vector((0.0, -0.2, 1.0))
    palm = palm - forearm * palm.dot(forearm)
    if palm.length < 1e-4:
        palm = Vector((0, -1, 0))
    palm.normalize()
    axis = forearm.cross(palm).normalized()
    palm = forearm.cross(axis).normalized()
    src_along, src_axis, src_palm = finger_frame(side)
    src = Matrix((src_along, src_axis, src_palm)).transposed()
    dst = Matrix((forearm, axis, palm)).transposed()
    rotation = dst @ src.inverted()
    world = rotation.to_4x4()
    world.translation = wrist
    hand = arm.pose.bones[f"hand_{side}"]
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ world
    hand.keyframe_insert("rotation_quaternion", frame=frame)
    apply_curl(arm, side, scale, frame)


def seat_dumbbell(arm, bell, side):
    """Deja el mango dentro del puño, cruzado sobre la palma, y lo ata al hueso."""
    bpy.context.view_layer.update()
    finger = arm.pose.bones[f"middle_01_{side}"]
    handle = (arm.matrix_world.to_3x3() @ finger.matrix.to_3x3()).col[0].xyz
    if handle.length < 1e-5:
        handle = Vector((1, 0, 0))
    handle.normalize()
    helper = Vector((0, 0, 1))
    if abs(handle.dot(helper)) > 0.9:
        helper = Vector((0, 1, 0))
    side_axis = handle.cross(helper).normalized()
    up_axis = side_axis.cross(handle).normalized()
    wrist = arm.matrix_world @ arm.pose.bones[f"hand_{side}"].head
    knuckle = arm.matrix_world @ arm.pose.bones[f"middle_01_{side}"].head
    hole = wrist.lerp(knuckle, 0.62)
    matrix = Matrix.Identity(4)
    matrix.col[0][:3] = handle
    matrix.col[1][:3] = side_axis
    matrix.col[2][:3] = up_axis
    matrix.translation = hole
    bell.matrix_world = matrix
    if bell.animation_data:
        bell.animation_data_clear()
    parent_keep(bell, arm, bone=f"hand_{side}")


def build_curl():
    arm, body = acquire_body()
    bpy.context.scene.frame_set(1)
    foot_refs = sole_reference(arm)
    ankles = {side: bone_world(arm, f"calf_{side}", "tail").copy() for side in ("l", "r")}
    knees = {side: bone_world(arm, f"calf_{side}", "head").copy() for side in ("l", "r")}
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        foot = empty(f"pie_{side}", ankles[side])
        pole = empty(f"polo_rodilla_{side}", (knees[side].x + sign * 0.2, knees[side].y - 0.4, knees[side].z))
        add_ik(arm, f"calf_{side}", foot, pole, 2, -90)
    bells = {}
    # Curl supino: el codo quieto al costado y el antebrazo gira hacia el frente.
    # Abajo la palma mira al frente; a media altura, al techo.
    for side in ("l", "r"):
        shoulder = bone_world(arm, f"upperarm_{side}", "head")
        elbow = bone_world(arm, f"lowerarm_{side}", "head")
        wrist = bone_world(arm, f"hand_{side}", "head")
        upper_len = (elbow - shoulder).length
        fore_len = (wrist - elbow).length
        # Codo fijo, justo debajo del hombro. El antebrazo gira en el plano lateral.
        anchor = Vector((shoulder.x, shoulder.y - 0.03, shoulder.z - upper_len))
        grip = empty(f"agarre_{side}", anchor + Vector((0, -0.08, -fore_len)))
        pole = empty(f"polo_codo_{side}", (anchor.x, anchor.y + 0.32, anchor.z))
        parent_keep(pole, arm)
        add_ik(arm, f"hand_{side}", grip, pole, 3, -90)
        bell = dumbbell(f"mancuerna_{side}")
        SHARED["props"].append(bell)
        bells[side] = (grip, anchor, fore_len, bell)
    for frame in range(1, FRAMES + 1):
        u = fade(frame)
        bpy.context.scene.frame_set(frame)
        arm.location = (0, 0, 0)
        arm.rotation_mode = "XYZ"
        arm.rotation_euler = (0, 0, 0)
        key_object(arm, frame)
        key_object(arm, frame, "rotation_euler")
        for side, (grip, anchor, fore_len, bell) in bells.items():
            start = Vector((0, -0.15, -1)).normalized()
            end = Vector((0, -0.38, 0.92)).normalized()
            grip.location = anchor + start.lerp(end, u).normalized() * fore_len
            key_object(grip, frame)
            close_hand(arm, side, frame)
        flatten_feet(arm, foot_refs, frame)
    bake_pose(arm)
    keep_action(arm, "Curl con mancuernas")
    for frame in range(1, FRAMES + 1):
        for side in ("l", "r"):
            supinate_curl(arm, side, frame)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    for side, (grip, anchor, fore_len, bell) in bells.items():
        seat_dumbbell(arm, bell, side)
    report = summarize(measure(arm, ["mancuerna_l"]), "curl-mancuernas")
    cam = bpy.data.objects["Cam"]
    cam.data.lens = 62
    for frame, tag in ((1, "abajo"), (38, "medio"), (BOTTOM_FRAME, "arriba")):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        wrist = bone_world(arm, "hand_l", "head")
        both = (wrist + bone_world(arm, "hand_r", "head")) * 0.5
        shoot_at(OUT + rf"\curl-{tag}-frente.png", (0, both.y - 2.4, both.z + 0.2), both + Vector((0, 0, 0.05)))
        shoot_at(OUT + rf"\curl-{tag}-perfil.png", (wrist.x + 1.35, wrist.y - 0.15, wrist.z + 0.05), wrist)
    cam.data.lens = 48
    return report


def build_bench():
    arm, body = acquire_body()
    bpy.context.scene.frame_set(1)
    # De pie la planta ya está apoyada y los dedos miran a -Y, igual que los pies
    # del banco. Hay que leerla antes de acostar el cuerpo.
    foot_refs = sole_reference(arm)
    arm.rotation_mode = "XYZ"
    arm.rotation_euler = (radians(-90), 0, 0)
    arm.location = (0, 0, 0)
    bpy.context.view_layer.update()
    back_z = min(bone_world(arm, name, "head").z for name in ("pelvis", "spine_01", "spine_02", "spine_03"))
    arm.location.z += 0.46 - back_z
    bpy.context.view_layer.update()
    head = bone_world(arm, "head", "head")
    pelvis = bone_world(arm, "pelvis", "head")
    bench = gym_bench(head, pelvis)
    SHARED["props"].append(bench)
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        hip = bone_world(arm, f"thigh_{side}", "head")
        ankle = bone_world(arm, f"calf_{side}", "tail")
        along = Vector((ankle.x - hip.x, ankle.y - hip.y, 0))
        if along.length < 0.05:
            along = Vector((0, -1, 0))
        along.normalize()
        foot = empty(f"pie_{side}", Vector((hip.x, hip.y, 0.03)) + along * 0.46 + Vector((sign * 0.02, 0, 0)))
        pole = empty(f"polo_rodilla_{side}", Vector((hip.x + sign * 0.08, hip.y, 0)) + along * 0.22 + Vector((0, 0, 0.72)))
        add_ik(arm, f"calf_{side}", foot, pole, 2, -90)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    shoulder = (bone_world(arm, "upperarm_l", "head") + bone_world(arm, "upperarm_r", "head")) * 0.5
    chest = bone_world(arm, "spine_03", "head")
    toward_head = Vector((head.x - pelvis.x, head.y - pelvis.y, 0))
    if toward_head.length > 1e-4:
        toward_head.normalize()
    else:
        toward_head = Vector((0, 1, 0))
    reach = arm.pose.bones["upperarm_l"].length + arm.pose.bones["lowerarm_l"].length
    # El toque es el centro del pecho: ni el cuello ni el abdomen.
    # spine_03 cae más abajo, hacia el estómago, y no sirve de diana.
    pec = shoulder - toward_head * 0.17
    low = Vector((0, pec.y, chest.z + 0.10))
    high = Vector((0, shoulder.y, shoulder.z + reach * 0.92))
    bar = barbell("barra_press", length=1.4, plate=0.16)
    SHARED["props"].append(bar)
    grips = {}
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        grips[side] = empty(f"agarre_{side}", low + Vector((sign * 0.28, 0, 0)))
        pole = empty(
            f"polo_codo_{side}",
            shoulder + Vector((sign * 0.22, 0, 0)) - toward_head * 0.06 + Vector((0, 0, -0.08)),
        )
        add_ik(arm, f"hand_{side}", grips[side], pole, 3, -90)
    for frame in range(1, FRAMES + 1):
        u = fade(frame)
        bpy.context.scene.frame_set(frame)
        key_object(arm, frame, "location")
        key_object(arm, frame, "rotation_euler")
        # Arco corto hacia los hombros en la mitad del recorrido, no una línea recta.
        center = low.lerp(high, u) + toward_head * (math.sin(math.pi * u) * 0.03)
        for side, grip in grips.items():
            sign = 1 if side == "l" else -1
            grip.location = center + Vector((sign * 0.28, 0, 0))
            key_object(grip, frame)
            close_hand(arm, side, frame)
        flatten_feet(arm, foot_refs, frame)
        bpy.context.view_layer.update()
        left = bone_world(arm, "hand_l", "head")
        right = bone_world(arm, "hand_r", "head")
        bar.location = (left + right) * 0.5
        key_object(bar, frame)
    bake_pose(arm)
    keep_action(arm, "Press de banca")
    for frame in range(1, FRAMES + 1):
        wrap_hands(arm, bar, frame)
    keep_action(bar, "Barra press")
    report = summarize(measure(arm, ["barra_press"]), "press-banca")
    for frame, tag in ((1, "pecho"), (BOTTOM_FRAME, "arriba")):
        bpy.context.scene.frame_set(frame)
        shoot(OUT + rf"\press-{tag}-lado.png", (2.8, pelvis.y, 0.85), (radians(78), 0, radians(90)))
        shoot(OUT + rf"\press-{tag}-frente.png", (0.15, pelvis.y - 2.5, 1.15), (radians(68), 0, 0))
    return report


def publish(path):
    arm = SHARED["arm"]
    body = SHARED["body"]
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.location = (0, 0, 0)
    arm.rotation_euler = (0, 0, 0)
    export_glb(path, [arm, body, *SHARED["props"]])
    print("GLB", path)
    for action in bpy.data.actions:
        print("ACTION", action.name, "users", action.users)


def main():
    import os
    global shoot, shoot_at
    os.makedirs(OUT, exist_ok=True)
    SHARED["arm"] = None
    SHARED["body"] = None
    SHARED["props"] = []
    SHARED["shoot_at"] = shoot_at
    if os.environ.get("CATALOG_FAST") == "1":
        def shoot(path, location, rotation):
            return None
        def shoot_at(path, location, target):
            return None
    only = os.environ.get("CATALOG_ONLY", "")
    reports = [] if only else [build_squat(), build_curl(), build_bench()]
    import sys
    sys.path.insert(0, r"C:\Users\Hide\Desktop\Gym\motion-lab")
    import catalog_cycle
    catalog_cycle.build_all(sys.modules["__main__"])
    if only:
        print("CATALOG_ONLY_DONE", only)
        return
    path = OUT + r"\informe.json"
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(reports, handle, ensure_ascii=False, indent=2)
    print("INFORME", path)
    for report in reports:
        print(
            report["ejercicio"],
            "pie", report["deslizamiento_pie_izq_m"],
            "planta", report["planta_variacion_deg"],
            "agarre", report["agarre_max_m"],
            "cadera", report["cadera_z_min"], report["cadera_z_max"],
            "rodilla", report["rodilla_grados"],
            "codo", report["codo_grados"],
        )
    publish(OUT + r"\estudio.glb")


if __name__ == "__main__":
    import sys
    if "squat" in sys.argv:
        import os
        os.makedirs(OUT, exist_ok=True)
        report = build_squat()
        print(report["ejercicio"], "pie", report["deslizamiento_pie_izq_m"], "rodilla", report["rodilla_grados"])
    elif "lifts" in sys.argv:
        import os
        os.makedirs(OUT, exist_ok=True)
        reports = [build_squat(), build_bench()]
        for report in reports:
            print(
                report["ejercicio"],
                "pie", report["deslizamiento_pie_izq_m"],
                "cadera", report["cadera_z_min"], report["cadera_z_max"],
                "rodilla", report["rodilla_grados"],
                "codo", report["codo_grados"],
            )
    elif "curl" in sys.argv:
        import os
        os.makedirs(OUT, exist_ok=True)
        report = build_curl()
        print(report["ejercicio"], "codo", report["codo_grados"], "muestras", len(report["muestras"]))
    elif "bench" in sys.argv:
        import os
        os.makedirs(OUT, exist_ok=True)
        report = build_bench()
        print(report["ejercicio"], "codo", report["codo_grados"], "rodilla", report["rodilla_grados"], "cadera", report["cadera_z_min"])
    else:
        main()
