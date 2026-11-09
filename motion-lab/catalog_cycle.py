"""Ciclos del resto del catálogo. Sentadilla, curl y press no se regeneran aquí."""

import os
import sys
import time
import traceback
from math import acos, atan2, cos, degrees, radians, sin, sqrt
from pathlib import Path

import bpy
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import catalog_specs as specs

NO_FLAT = {"calf", "legpress", "legcurl", "legext", "deadbug", "crunch"}
PREVIEWS = (
    "prensa-piernas",
    "sentadilla-bulgara",
)
CALF_RISE = 0.09


def add_box(ex, name, location, scale, color=(0.62, 0.64, 0.66)):
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ex.metal(obj, color)
    return obj


def join_named(name, parts):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    return obj


def keep(ex, ctx, obj):
    ex.SHARED["props"].append(obj)
    ctx["created"].append(obj)
    return obj


def settle(ex, arm, angle, target_z):
    arm.rotation_mode = "XYZ"
    arm.rotation_euler = (angle, 0, 0)
    arm.location = (0, 0, 0)
    bpy.context.view_layer.update()
    back = min(ex.bone_world(arm, name, "head").z for name in ("pelvis", "spine_01", "spine_02", "spine_03"))
    arm.location.z += target_z - back
    bpy.context.view_layer.update()


def set_spine(arm, frame, bend, yaw=0.0):
    for name, weight in (("spine_01", 0.34), ("spine_02", 0.40), ("spine_03", 0.26)):
        bone = arm.pose.bones[name]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (bend * weight, 0.0, yaw * weight)
        bone.keyframe_insert("rotation_euler", frame=frame)


def pose_hinge(arm, frame, amount):
    """La cadera va atrás y el tronco baja largo. No es una espalda redonda."""
    pelvis = arm.pose.bones["pelvis"]
    pelvis.rotation_mode = "XYZ"
    pelvis.rotation_euler = (radians(70) * amount, 0.0, 0.0)
    pelvis.keyframe_insert("rotation_euler", frame=frame)
    for name, weight in (("spine_01", 0.25), ("spine_02", 0.35), ("spine_03", 0.40)):
        bone = arm.pose.bones[name]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (radians(-8) * amount * weight, 0.0, 0.0)
        bone.keyframe_insert("rotation_euler", frame=frame)


def set_shrug(arm, frame, u):
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        bone = arm.pose.bones[f"clavicle_{side}"]
        bone.rotation_mode = "XYZ"
        bone.rotation_euler = (radians(-8) * u, radians(8) * u * sign, radians(18) * u * sign)
        bone.keyframe_insert("rotation_euler", frame=frame)


def body_axes(ex, arm):
    head = ex.bone_world(arm, "head", "head")
    pelvis = ex.bone_world(arm, "pelvis", "head")
    toward = Vector((head.x - pelvis.x, head.y - pelvis.y, 0))
    if toward.length < 1e-4:
        toward = Vector((0, 1, 0))
    return toward.normalized(), Vector((0, 0, 1))


def pose_plank(ex, arm):
    """Cuerpo horizontal: hombros y cadera a la misma altura, brazos casi rectos al suelo."""
    arm.rotation_mode = "XYZ"
    arm.rotation_euler = (radians(90), 0, 0)
    arm.location = (0, 0, 0)
    bpy.context.view_layer.update()
    for _ in range(4):
        shoulder = (ex.bone_world(arm, "upperarm_l", "head") + ex.bone_world(arm, "upperarm_r", "head")) * 0.5
        hip = ex.bone_world(arm, "pelvis", "head")
        dy = hip.y - shoulder.y
        dz = hip.z - shoulder.z
        arm.rotation_euler.x -= atan2(dz, max(abs(dy), 0.05)) * (1 if dy >= 0 else -1)
        bpy.context.view_layer.update()
    reach = arm.pose.bones["upperarm_l"].length + arm.pose.bones["lowerarm_l"].length
    shoulder = (ex.bone_world(arm, "upperarm_l", "head") + ex.bone_world(arm, "upperarm_r", "head")) * 0.5
    hip = ex.bone_world(arm, "pelvis", "head")
    height = 0.03 + reach * 0.92
    arm.location.z += height - (shoulder.z + hip.z) * 0.5
    bpy.context.view_layer.update()
    shoulder = (ex.bone_world(arm, "upperarm_l", "head") + ex.bone_world(arm, "upperarm_r", "head")) * 0.5
    hip = ex.bone_world(arm, "pelvis", "head")
    print("PLANK", f"hombro {shoulder.z:.3f}", f"cadera {hip.z:.3f}", flush=True)


def legcurl_bench(ex, arm):
    """El pecho, la cara y los muslos apoyan. Las rodillas quedan libres."""
    head = ex.bone_world(arm, "head", "head")
    hip = ex.bone_world(arm, "pelvis", "head")
    knee = (ex.bone_world(arm, "calf_l", "head") + ex.bone_world(arm, "calf_r", "head")) * 0.5
    along = Vector((head.x - hip.x, head.y - hip.y, 0.0))
    if along.length < 0.05:
        along = Vector((0.0, 1.0, 0.0))
    along.normalize()
    start = head + along * 0.08
    end = hip.lerp(knee, 0.58)
    center = (start + end) * 0.5
    center.z = min(head.z, hip.z) - 0.09
    span = Vector((end.x - start.x, end.y - start.y, 0.0)).length
    length = max(1.05, span + 0.1)
    top = add_box(ex, "banco_femoral_tapa", (center.x, center.y, center.z), (0.44, length, 0.08), (0.78, 0.80, 0.82))
    parts = [top]
    for x in (-0.16, 0.16):
        parts.append(add_box(
            ex,
            f"banco_femoral_pata_{x}",
            (center.x + x, center.y, center.z * 0.5),
            (0.06, 0.08, max(0.2, center.z)),
            (0.16, 0.17, 0.19),
        ))
    return join_named("banco_femoral", parts)


def legcurl_roller(ex):
    """Almohadilla acostada sobre los dos tendones. No es un poste."""
    roller = ex.cylinder("rodillo_femoral", 0.04, 0.42, "X", (0, 0, 0.7))
    ex.metal(roller, (0.86, 0.87, 0.88))
    return roller


def pose_legcurl(ex, arm):
    """Boca abajo y horizontal. El curl de femoral no se hace de pie ni de espaldas."""
    arm.rotation_mode = "XYZ"
    arm.rotation_euler = (radians(90), 0, 0)
    arm.location = (0, 0, 0)
    bpy.context.view_layer.update()
    for _ in range(6):
        shoulder = (ex.bone_world(arm, "upperarm_l", "head") + ex.bone_world(arm, "upperarm_r", "head")) * 0.5
        hip = ex.bone_world(arm, "pelvis", "head")
        dy = hip.y - shoulder.y
        dz = hip.z - shoulder.z
        arm.rotation_euler.x -= atan2(dz, max(abs(dy), 0.05)) * (1 if dy >= 0 else -1)
        bpy.context.view_layer.update()
    shoulder = (ex.bone_world(arm, "upperarm_l", "head") + ex.bone_world(arm, "upperarm_r", "head")) * 0.5
    hip = ex.bone_world(arm, "pelvis", "head")
    bench = 0.62
    arm.location.z += bench - (shoulder.z + hip.z) * 0.5
    bpy.context.view_layer.update()
    shoulder = (ex.bone_world(arm, "upperarm_l", "head") + ex.bone_world(arm, "upperarm_r", "head")) * 0.5
    hip = ex.bone_world(arm, "pelvis", "head")
    knee = ex.bone_world(arm, "calf_l", "head")
    print(
        "LEG_CURL_BASE",
        f"hombro {shoulder.z:.3f}",
        f"cadera {hip.z:.3f}",
        f"rodilla {knee.z:.3f}",
        f"largo {abs(hip.y - shoulder.y):.3f}",
        flush=True,
    )


def pose_bridge(ex, arm, ctx):
    """Los hombros quedan quietos sobre el banco. La cadera es lo que sube."""
    arm.rotation_mode = "XYZ"
    arm.rotation_euler = (radians(-62), 0, 0)
    arm.location = (0, 0, 0)
    bpy.context.view_layer.update()
    shoulder = ex.bone_world(arm, "upperarm_l", "head")
    arm.location.z += 0.50 - shoulder.z
    bpy.context.view_layer.update()
    ctx["shoulder_lock"] = ex.bone_world(arm, "upperarm_l", "head").copy()


def setup_base(ex, arm, spec, ctx):
    body = spec["body"]
    arm.rotation_mode = "XYZ"
    if body in ("lie", "legpress", "deadbug"):
        settle(ex, arm, radians(-90), 0.46)
    elif body == "incline":
        settle(ex, arm, radians(-58), 0.58)
    elif body == "legcurl":
        pose_legcurl(ex, arm)
    elif body == "plank":
        pose_plank(ex, arm)
    elif body == "pushup":
        settle(ex, arm, radians(90), 0.32)
    elif body == "side":
        arm.rotation_euler = (radians(68), radians(78), 0)
        arm.location = (0, 0, 0)
        bpy.context.view_layer.update()
        lows = [ex.bone_world(arm, name, "head").z for name in ("pelvis", "spine_02", "upperarm_l", "upperarm_r")]
        arm.location.z += 0.22 - min(lows)
        bpy.context.view_layer.update()
    elif body in ("sit", "legext"):
        # El jalón se hace con el pecho abierto y un poco de inclinación atrás.
        arm.rotation_euler = (radians(-15) if spec.get("arms") == "pulldown" else radians(-8), 0, 0)
        arm.location = (0, 0, 0)
        bpy.context.view_layer.update()
        if spec.get("arms") == "pulldown":
            # La cadera queda a una espinilla del suelo para que la planta apoye.
            calf = arm.pose.bones["calf_l"].length
            hip = ex.bone_world(arm, "thigh_l", "head")
            arm.location.z += (0.055 + calf * 0.98) - hip.z
        else:
            pelvis = ex.bone_world(arm, "pelvis", "head")
            arm.location.z += 0.52 - pelvis.z
        bpy.context.view_layer.update()
    elif body == "crunch":
        arm.rotation_euler = (radians(18), 0, 0)
        arm.location = (0, 0.06, 0)
        bpy.context.view_layer.update()
        pelvis = ex.bone_world(arm, "pelvis", "head")
        arm.location.z += 0.46 - pelvis.z
        bpy.context.view_layer.update()
    elif body == "bridge":
        pose_bridge(ex, arm, ctx)
    elif body == "hinge" and not spec.get("hinge_anim", True):
        arm.location = (0, 0.10, -0.04)
        arm.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
        set_spine(arm, 1, radians(64))
        bpy.context.view_layer.update()
    else:
        arm.location = (0, 0, 0)
        arm.rotation_euler = (0, 0, 0)
        bpy.context.view_layer.update()
    ctx["base_loc"] = arm.location.copy()
    ctx["base_rot"] = (arm.rotation_euler.x, arm.rotation_euler.y, arm.rotation_euler.z)
    ctx["axes"] = body_axes(ex, arm)


def pullup_station(ex, arm, ctx):
    """Dos postes hasta la barra. La altura se corrige cuando el puño ya cerró."""
    shoulder = ex.bone_world(arm, "upperarm_l", "head")
    reach = arm.pose.bones["upperarm_l"].length + arm.pose.bones["lowerarm_l"].length
    top = shoulder.z + reach * 0.985 + 0.03
    y = shoulder.y - 0.045
    ctx["station_top"] = top
    ctx["station_y"] = y
    parts = []
    for x in (-0.58, 0.58):
        post = ex.cylinder(f"poste_dom_{x}", 0.028, top, "Z", (x, y, top * 0.5))
        ex.metal(post, (0.22, 0.24, 0.27))
        parts.append(post)
        foot = add_box(ex, f"base_dom_{x}", (x, y, 0.015), (0.14, 0.16, 0.03), (0.18, 0.19, 0.21))
        parts.append(foot)
    return join_named("estructura_dominadas", parts)


def ensure_gear(ex, ctx, spec, arm):
    def poste():
        parts = []
        for x in (-0.58, 0.58):
            parts.append(ex.cylinder(f"poste_x_{x}", 0.03, 2.2, "Z", (x, -1.08, 1.1)))
        parts.append(ex.cylinder("poste_top", 0.025, 1.24, "X", (0, -1.08, 2.16)))
        for part in parts:
            ex.metal(part, (0.32, 0.34, 0.36))
        return join_named("poste_polea", parts)

    def parallels():
        parts = []
        for x in (-0.3, 0.3):
            bar = ex.cylinder(f"paralela_{x}", 0.025, 1.05, "Y", (x, 0.22, 0.9))
            ex.metal(bar, (0.3, 0.32, 0.34))
            parts.append(bar)
        return join_named("paralelas", parts)

    def seat():
        pelvis = ex.bone_world(arm, "pelvis", "head")
        return add_box(ex, "asiento", (pelvis.x, pelvis.y + 0.02, pelvis.z - 0.18), (0.46, 0.42, 0.12))

    def step():
        ankle = ex.bone_world(arm, "calf_l", "tail")
        return add_box(ex, "escalon", (0, ankle.y - 0.02, 0.07), (0.52, 0.34, 0.14), (0.45, 0.46, 0.48))

    def pad(name, drop):
        head = ex.bone_world(arm, "head", "head")
        hips = ex.bone_world(arm, "pelvis", "head")
        center = (head + hips) * 0.5
        center.z -= drop
        length = max(0.7, (Vector((head.x, head.y, 0)) - Vector((hips.x, hips.y, 0))).length)
        return add_box(ex, name, (center.x, center.y, center.z), (0.18, length * 0.55, 0.045))

    def row_pad():
        chest = ex.bone_world(arm, "spine_03", "head")
        return add_box(ex, "banco_remo", (chest.x, chest.y - 0.02, chest.z - 0.1), (0.2, 0.42, 0.05))

    def thrust_pad():
        left = ex.bone_world(arm, "upperarm_l", "head")
        right = ex.bone_world(arm, "upperarm_r", "head")
        shoulder = (left + right) * 0.5
        return add_box(ex, "banco_thrust", (shoulder.x, shoulder.y, shoulder.z - 0.16), (0.32, 0.46, 0.12))

    def plate():
        hip = ex.bone_world(arm, "pelvis", "head")
        return add_box(ex, "plataforma_prensa", (hip.x, hip.y, hip.z + 0.9), (0.56, 0.52, 0.08), (0.78, 0.80, 0.82))

    makers = {
        "poste_polea": poste,
        "paralelas": parallels,
        "asiento": seat,
        "escalon": step,
        "banco_bulgaro": lambda: add_box(ex, "banco_bulgaro", (-0.12, 0.46, 0.16), (0.36, 0.30, 0.32)),
        "cajon_asistencia": lambda: add_box(ex, "cajon_asistencia", (0, 0.02, 0.12), (0.48, 0.38, 0.24)),
        "banco_prensa": lambda: pad("banco_prensa", 0.1),
        "plataforma_prensa": plate,
        "banco_inclinado": lambda: pad("banco_inclinado", 0.1),
        "banco_remo": row_pad,
        "banco_thrust": thrust_pad,
        "banco_femoral": lambda: legcurl_bench(ex, arm),
        "rodillo_femoral": lambda: legcurl_roller(ex),
        "maquina_extension": lambda: legext_machine(ex, arm),
        "rodillo_extension": lambda: legext_roller(ex),
        "estructura_dominadas": lambda: pullup_station(ex, arm, ctx),
    }
    for name in spec.get("gear", []):
        if name == "banco" or bpy.data.objects.get(name):
            continue
        maker = makers.get(name)
        if maker is None and name.startswith("asiento"):
            maker = makers["asiento"]
        keep(ex, ctx, maker())
    if spec.get("arms") == "pulldown":
        seat = bpy.data.objects.get("asiento")
        if seat is not None:
            pelvis = ex.bone_world(arm, "pelvis", "head")
            # El asiento queda bajo los muslos, no detrás de la cadera.
            seat.location = (pelvis.x, pelvis.y - 0.1, pelvis.z - 0.15)
            seat.name = f"asiento_{spec['key']}"


def setup_feet(ex, arm, spec, prefix, ctx):
    body = spec["body"]
    feet = {}
    ctx["foot_home"] = {}
    ctx["pole_home"] = {}
    for side in ("l", "r"):
        sign = 1 if side == "l" else -1
        hip = ex.bone_world(arm, f"thigh_{side}", "head")
        knee = ex.bone_world(arm, f"calf_{side}", "head")
        ankle = ex.bone_world(arm, f"calf_{side}", "tail")
        leg = arm.pose.bones[f"thigh_{side}"].length + arm.pose.bones[f"calf_{side}"].length
        along = Vector((ankle.x - hip.x, ankle.y - hip.y, 0))
        if along.length < 0.05:
            along = Vector((0, -1, 0))
        along.normalize()
        if body == "deadbug":
            at = hip + Vector((sign * 0.08, 0.02, 0.3))
            pole_at = hip + Vector((sign * 0.1, -0.12, 0.16))
        elif body in ("lie", "incline", "legpress"):
            at = Vector((hip.x, hip.y, 0.04)) + along * 0.44
            pole_at = Vector((knee.x + sign * 0.06, knee.y, max(knee.z, 0.2) + 0.35))
        elif body == "plank":
            shoulder = ex.bone_world(arm, "upperarm_l", "head")
            toward = Vector((hip.x - shoulder.x, hip.y - shoulder.y, 0))
            if toward.length < 0.05:
                toward = along
            else:
                toward.normalize()
            drop = max(hip.z - 0.06, 0.0)
            horizontal = sqrt(max(leg * leg - drop * drop, 0.04))
            at = Vector((hip.x, hip.y, 0.06)) + toward * horizontal
            pole_at = Vector((at.x + sign * 0.06, at.y, hip.z * 0.55))
        elif body == "bridge":
            head = ex.bone_world(arm, "head", "head")
            toward = Vector((hip.x - head.x, hip.y - head.y, 0))
            if toward.length < 0.05:
                toward = Vector((0, -1, 0))
            toward.normalize()
            at = Vector((hip.x, hip.y, 0.04)) + toward * 0.5 + Vector((sign * 0.07, 0, 0))
            pole_at = at + Vector((0, 0, 0.42)) - toward * 0.12
        elif body == "legcurl":
            knee_now = ex.bone_world(arm, f"calf_{side}", "head")
            hip_now = ex.bone_world(arm, f"thigh_{side}", "head")
            away = Vector((knee_now.x - hip_now.x, knee_now.y - hip_now.y, 0))
            if away.length < 0.05:
                away = Vector((0, -1, 0))
            away.normalize()
            calf = arm.pose.bones[f"calf_{side}"].length
            at = knee_now + away * (calf * cos(radians(12))) + Vector((sign * 0.015, 0, calf * sin(radians(12))))
            # La rótula mira al suelo. El polo de costado abre las piernas en plancha.
            pole_at = knee_now + Vector((sign * 0.05, 0, -0.42))
        elif body == "pushup":
            at = Vector((hip.x, hip.y, 0.05)) + along * (leg * 0.9)
            pole_at = knee + Vector((sign * 0.12, 0, 0.18))
        elif body == "legext":
            at = Vector((hip.x + sign * 0.05, hip.y - 0.08, hip.z - 0.42))
            pole_at = Vector((hip.x + sign * 0.05, hip.y - 0.28, hip.z))
        elif body == "sit" and spec.get("arms") == "pulldown":
            # Muslo casi horizontal, espinilla hacia el suelo, rodillas separadas.
            thigh = arm.pose.bones[f"thigh_{side}"].length
            at = Vector((hip.x + sign * 0.03, hip.y - thigh * 0.92, 0.045))
            pole_at = Vector((hip.x + sign * 0.09, hip.y - thigh * 0.42, hip.z + 0.02))
        elif body == "sit":
            at = Vector((hip.x + sign * 0.02, hip.y - 0.38, 0.05))
            pole_at = Vector((hip.x + sign * 0.04, hip.y - 0.2, 0.46))
        elif body == "lunge":
            shift = -0.3 if side == "l" else 0.42
            at = Vector((ankle.x, ankle.y + shift, 0.04 if side == "r" else ankle.z))
            pole_at = Vector((knee.x + sign * 0.14, knee.y - 0.2, knee.z))
        elif body == "bulgarian":
            if side == "l":
                at = Vector((ankle.x, ankle.y - 0.32, 0.04))
                pole_at = Vector((knee.x + sign * 0.08, knee.y - 0.28, 0.28))
            else:
                # Empeine sobre el banco, del mismo lado. El polo bajo obliga a bajar la rodilla.
                at = Vector((ankle.x, 0.40, 0.36))
                pole_at = Vector((ankle.x - 0.04, 0.08, 0.16))
        elif body == "calf":
            at = Vector((ankle.x, ankle.y - 0.02, 0.14))
            pole_at = Vector((knee.x + sign * 0.12, knee.y - 0.32, knee.z))
        elif spec.get("grip") == "chin":
            # Pies bajo los hombros y rodillas hacia afuera, para que no se junten.
            at = Vector((sign * 0.07, ankle.y, 0.18))
            pole_at = Vector((sign * 0.18, ankle.y - 0.22, 0.48))
        elif body == "pullup" and spec.get("rise", 0.28) < 0.2:
            at = Vector((ankle.x, ankle.y, 0.24))
            pole_at = Vector((knee.x + sign * 0.12, knee.y - 0.2, knee.z + 0.1))
        elif body == "crunch":
            at = Vector((ankle.x + sign * 0.02, ankle.y + 0.16, 0.05))
            pole_at = Vector((knee.x, knee.y, knee.z + 0.2))
        else:
            at = ankle.copy()
            pole_at = Vector((knee.x + sign * 0.22, knee.y - 0.38, knee.z))
        foot = ex.empty(f"{prefix}_pie_{side}", at)
        pole = ex.empty(f"{prefix}_polo_rodilla_{side}", pole_at)
        # En el femoral el muslo se queda en el banco. Solo flexiona la rodilla.
        ex.add_ik(arm, f"calf_{side}", foot, pole, 1 if body in ("legcurl", "legext") else 2, -90)
        feet[side] = foot
        ctx["foot_home"][side] = Vector(at)
        ctx["pole_home"][side] = Vector(pole_at)
        ctx["leg_along"] = along
        ctx["leg_len"] = leg
    return feet


def capture_fixed(ex, arm, spec):
    body = spec["body"]
    width = spec.get("width", 0.22)
    fixed = {}
    if body == "pullup" and spec.get("grip") == "chin":
        # Agarre supino, al ancho de hombros. La muñeca queda justo debajo de la barra fija.
        shoulder = ex.bone_world(arm, "upperarm_l", "head")
        reach = arm.pose.bones["upperarm_l"].length + arm.pose.bones["lowerarm_l"].length
        y = shoulder.y - 0.045
        z = shoulder.z + reach * 0.985
        half = spec.get("width", 0.17)
        for side in ("l", "r"):
            sign = 1 if side == "l" else -1
            fixed[side] = Vector((sign * half, y, z))
        return fixed
    if body == "pullup":
        zs = []
        ys = []
        for side in ("l", "r"):
            sign = 1 if side == "l" else -1
            shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
            reach = arm.pose.bones[f"upperarm_{side}"].length + arm.pose.bones[f"lowerarm_{side}"].length
            fixed[side] = Vector((shoulder.x + sign * width, shoulder.y - 0.02, shoulder.z + reach * 0.96))
            zs.append(fixed[side].z)
            ys.append(fixed[side].y)
        z = sum(zs) / len(zs)
        y = sum(ys) / len(ys)
        for side in fixed:
            fixed[side].y = y
            fixed[side].z = z
        return fixed
    if body == "dip":
        for side in ("l", "r"):
            sign = 1 if side == "l" else -1
            fixed[side] = Vector((sign * 0.3, 0.18, 0.9))
        return fixed
    if body in ("pushup", "plank"):
        for side in ("l", "r"):
            shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
            fixed[side] = Vector((shoulder.x, shoulder.y, 0.02))
        return fixed
    if body == "side":
        left = ex.bone_world(arm, "upperarm_l", "head")
        right = ex.bone_world(arm, "upperarm_r", "head")
        low = "l" if left.z <= right.z else "r"
        high = "r" if low == "l" else "l"
        low_s = left if low == "l" else right
        hip = ex.bone_world(arm, "pelvis", "head")
        sign = 1 if high == "l" else -1
        fixed[low] = Vector((low_s.x, low_s.y - 0.02, 0.08))
        fixed[high] = hip + Vector((sign * 0.12, -0.04, 0.12))
        return fixed
    if body == "legcurl":
        hip = ex.bone_world(arm, "pelvis", "head")
        head = ex.bone_world(arm, "head", "head")
        forward = Vector((head.x - hip.x, head.y - hip.y, 0))
        if forward.length < 0.05:
            forward = Vector((0, 1, 0))
        forward.normalize()
        for side in ("l", "r"):
            sign = 1 if side == "l" else -1
            shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
            # Puños sobre el banco, delante de los hombros.
            fixed[side] = shoulder + forward * 0.16 + Vector((sign * 0.02, 0.0, -0.06))
        return fixed
    if spec["arms"] == "floor":
        for side in ("l", "r"):
            sign = 1 if side == "l" else -1
            shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
            fixed[side] = Vector((shoulder.x + sign * 0.16, shoulder.y, max(0.08, shoulder.z - 0.22)))
        return fixed
    return {}


def capture_elbows(ex, arm):
    anchors = {}
    fores = {}
    for side in ("l", "r"):
        shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
        elbow = ex.bone_world(arm, f"lowerarm_{side}", "head")
        wrist = ex.bone_world(arm, f"hand_{side}", "head")
        upper = max((elbow - shoulder).length, 0.2)
        anchors[side] = Vector((shoulder.x, shoulder.y - 0.03, shoulder.z - upper))
        fores[side] = max((wrist - elbow).length, 0.18)
    return anchors, fores


def setup_arms(ex, arm, spec, prefix, ctx):
    grips = {}
    poles = {}
    ctx["fixed"] = capture_fixed(ex, arm, spec)
    if spec["arms"] in ("curl", "pushdown"):
        ctx["elbow"], ctx["fore"] = capture_elbows(ex, arm)
    for side in ("l", "r"):
        wrist = ex.bone_world(arm, f"hand_{side}", "head")
        start = ctx["fixed"].get(side, wrist)
        grip = ex.empty(f"{prefix}_mano_{side}", start)
        pole = ex.empty(f"{prefix}_polo_codo_{side}", (start.x, start.y + 0.25, start.z))
        if spec.get("grip") == "chin" or spec.get("arms") == "pulldown" or (spec.get("body") == "hinge" and spec.get("hinge_anim", True)):
            # La muñeca sigue la barra. Si el IK agarra la punta, el puño se sale del mango.
            ex.add_ik(arm, f"lowerarm_{side}", grip, pole, 2, -90)
        else:
            ex.add_ik(arm, f"hand_{side}", grip, pole, 3, -90)
        grips[side] = grip
        poles[side] = pole
    return grips, poles


def setup_props(ex, spec, ctx):
    kind = spec["prop"]
    key = spec["key"]
    objs = []
    if kind == "none":
        return objs
    if kind == "bells":
        names = [f"db_{key}"] if spec.get("unilateral") else [f"db_{key}_l", f"db_{key}_r"]
        for name in names:
            objs.append(keep(ex, ctx, ex.dumbbell(name)))
        return objs
    if kind in ("one", "goblet"):
        return [keep(ex, ctx, ex.dumbbell(f"db_{key}"))]
    if spec.get("pullup_bar") or spec.get("arms") == "pulldown":
        # Barra larga y fina. Los discos grandes, vistos de lado, parecen un palo vertical.
        return [keep(ex, ctx, ex.barbell(f"bar_{key}", length=1.20, plate=0.03))]
    if spec.get("body") == "hinge" and spec.get("hinge_anim", True) and kind == "bar":
        return [keep(ex, ctx, ex.barbell(f"bar_{key}", length=1.35, plate=0.045))]
    length = spec.get("length", 1.28 if kind == "bar" else 0.34)
    plate = 0.14 if kind == "bar" else 0.04
    return [keep(ex, ctx, ex.barbell(f"bar_{key}", length=length, plate=plate))]


def body_channels(spec, u, ctx):
    body = spec["body"]
    if body == "squat":
        return Vector((0, 0.05 * u, -0.32 * u)), (0, 0, 0), radians(14) * u
    if body == "hinge":
        amount = u if spec.get("hinge_anim", True) else 1.0
        if spec.get("hinge_anim", True):
            # La cadera retrocede. El tronco lo inclina pose_hinge, no un redondeo.
            return Vector((0, 0.14 * amount, -0.06 * amount)), (0, 0, 0), 0.0
        return Vector((0, 0.10 * amount, -0.04 * amount)), (0, 0, 0), radians(64) * amount
    if body == "farmer":
        return Vector((0, 0.12 * u, 0.012 * u)), (0, 0, 0), 0.0
    if body == "calf":
        return Vector((0, 0, CALF_RISE * (1.0 + u))), (0, 0, 0), 0.0
    if body == "lunge":
        return Vector((0, -0.03 * u, -0.18 * u)), (0, 0, 0), radians(8) * u
    if body == "bulgarian":
        # La altura la fija plant_bulgarian: el pie delantero no puede quedarse en el aire.
        return Vector((0.0, -0.02 * u, 0.0)), (0, 0, 0), radians(8) * u
    if body == "pushup":
        loc = ctx["base_loc"].copy()
        loc.z -= 0.13 * u
        return loc, ctx["base_rot"], 0.0
    if body == "dip":
        return Vector((0, 0, 0.18 - 0.34 * u)), (0, 0, 0), 0.0
    if body == "pullup" and spec.get("grip") == "chin":
        rise = spec.get("rise", 0.36)
        base = ctx["base_loc"]
        # El pecho sube hacia la barra. La extensión es corta para no arquear la lumbar.
        # La cabeza pasa por detrás de la barra. Si sube en línea recta, el cráneo la atraviesa.
        behind = 0.05 * u + 0.07 * sin(radians(180) * u)
        return base + Vector((0.0, behind, rise * u)), (0, 0, 0), radians(-6) * u
    if body == "pullup":
        return Vector((0, 0, spec.get("rise", 0.28) * u)), (0, 0, 0), 0.0
    if body == "crunch":
        return ctx["base_loc"].copy(), ctx["base_rot"], radians(40) * u
    if body == "bridge":
        rot_x = radians(-62 + (-88 - -62) * u)
        return ctx["base_loc"].copy(), (rot_x, 0, 0), 0.0
    if body == "shrug":
        return Vector((0, 0, 0)), (0, 0, 0), 0.0
    return ctx["base_loc"].copy(), ctx["base_rot"], 0.0


def reach_of(arm, side):
    return arm.pose.bones[f"upperarm_{side}"].length + arm.pose.bones[f"lowerarm_{side}"].length


def put(origin, offset, distance):
    direction = Vector(offset)
    if direction.length < 1e-5:
        direction = Vector((0, -1, 0))
    return origin + direction.normalized() * distance


def clamp_reach(shoulder, point, limit):
    delta = point - shoulder
    if delta.length > limit > 1e-5:
        return shoulder + delta.normalized() * limit
    return point


def place_hands(ex, arm, spec, u, grips, poles, ctx):
    mode = spec["arms"]
    body = spec["body"]
    width = spec.get("width", 0.18)
    points = {}
    for side, grip in grips.items():
        sign = 1 if side == "l" else -1
        shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
        dist = reach_of(arm, side)
        if spec.get("unilateral") and side == "r":
            knee = ex.bone_world(arm, "calf_r", "head")
            point = Vector((knee.x, knee.y - 0.08, knee.z + 0.05))
        elif mode == "fixed" or (mode == "floor" and side in ctx.get("fixed", {})):
            point = ctx["fixed"][side].copy()
        elif mode == "hang" and body == "hinge" and spec.get("hinge_anim", True):
            # Brazos rectos, barra delante de los muslos.
            point = put(shoulder, (sign * 0.04, -0.22, -0.98), dist * 0.98)
        elif mode == "hang":
            point = put(shoulder, (sign * 0.1, -0.03, -1), dist * 0.94)
        elif mode == "chest":
            chest = ex.bone_world(arm, "spine_03", "head")
            # Cada mano llega por su lado del mango vertical.
            point = Vector((sign * 0.03, chest.y - 0.22, chest.z - 0.02))
        elif mode == "hips" and body == "legext":
            hip = ex.bone_world(arm, "pelvis", "head")
            point = hip + Vector((sign * 0.22, 0.02, -0.08))
        elif mode == "hips":
            hip = ex.bone_world(arm, "pelvis", "head")
            point = hip + Vector((sign * 0.18, -0.06, 0.08))
        elif mode == "curl":
            start = Vector((0, -0.15, -1)).normalized()
            end = Vector((0, -0.38, 0.92)).normalized()
            point = ctx["elbow"][side] + start.lerp(end, u).normalized() * ctx["fore"][side]
        elif mode == "pushdown":
            start = Vector((sign * 0.04, -0.72, 0.42)).normalized()
            end = Vector((sign * 0.02, -0.1, -1)).normalized()
            point = ctx["elbow"][side] + start.lerp(end, u).normalized() * ctx["fore"][side]
        elif mode == "ohp":
            if spec["prop"] == "bar":
                low = Vector((sign * width, shoulder.y - 0.28, shoulder.z + 0.02))
                high = Vector((sign * width, shoulder.y - 0.05, shoulder.z + dist * 0.9))
                point = low.lerp(high, u)
            else:
                low = put(shoulder, (sign * 0.18, -0.3, 0.04), dist * 0.7)
                high = put(shoulder, (sign * 0.1, -0.06, 1), dist * 0.93)
                point = low.lerp(high, u)
        elif mode == "lateral":
            low = put(shoulder, (sign * 0.28, -0.04, -0.95), dist * 0.92)
            high = put(shoulder, (sign * 1, -0.05, 0.16), dist * 0.9)
            point = low.lerp(high, u)
        elif mode == "front":
            # Arco de radio fijo: si la mano va en línea recta, el codo se dobla y la mancuerna vuelve a la cadera.
            reach = dist + arm.pose.bones[f"hand_{side}"].length
            low_dir = Vector((sign * 0.12, -0.46, -0.88)).normalized()
            high_dir = Vector((sign * 0.05, -0.99, 0.05)).normalized()
            point = shoulder + low_dir.slerp(high_dir, u) * (reach * 0.975)
        elif mode == "press":
            if body in ("lie", "incline"):
                low = shoulder + Vector((sign * 0.16, -0.08, 0.08))
                high = shoulder + Vector((sign * 0.12, 0.02, 0.46))
            else:
                low = put(shoulder, (sign * 0.2, -0.22, -0.02), dist * 0.62)
                high = put(shoulder, (sign * 0.16, -0.55, 0.08), dist * 0.9)
            point = low.lerp(high, u)
        elif mode == "fly":
            closed = shoulder + Vector((sign * 0.12, -0.04, 0.4))
            opened = put(shoulder, (sign * 0.9, -0.12, 0.02), dist * 0.9)
            point = closed.lerp(opened, u)
        elif mode == "row":
            hang = put(shoulder, (sign * 0.12, 0.04, -1), dist * 0.92)
            hip = ex.bone_world(arm, "pelvis", "head")
            close = Vector((hip.x + sign * 0.16, hip.y - 0.04, hip.z + 0.12))
            point = hang.lerp(close, u)
        elif mode == "fly_rear":
            hang = put(shoulder, (sign * 0.14, 0.02, -1), dist * 0.9)
            wide = put(shoulder, (sign * 1, 0.18, 0.02), dist * 0.88)
            point = hang.lerp(wide, u)
        elif mode == "pulldown":
            # Arriba, brazos casi rectos y la barra delante de la frente.
            # Abajo, la barra llega a la clavícula y el codo baja. Nunca detrás del cráneo.
            head = ex.bone_world(arm, "head", "head")
            chest = ex.bone_world(arm, "spine_03", "head")
            # Arriba: brazos largos, barra sobre la cabeza y un poco delante.
            # Abajo: la barra llega a la clavícula y los codos bajan junto al tronco.
            high = Vector((sign * width, head.y - 0.22, head.z + 0.32))
            low = Vector((sign * width * 0.90, chest.y - 0.22, chest.z + 0.08))
            point = high.lerp(low, u)
            point.y -= 0.04 * sin(radians(180) * u)
            # Más atrás que esto, la barra entra en la cara.
            front = head.y - 0.12
            if point.y > front:
                point.y = front
            limit = dist * (0.98 - 0.24 * u)
            delta = point - shoulder
            if delta.length > limit:
                point = shoulder + delta.normalized() * limit
                if point.y > front:
                    point.y = front
        elif mode == "face":
            far = put(shoulder, (sign * 0.14, -0.75, 0.12), dist * 0.86)
            near = put(shoulder, (sign * 0.32, -0.16, 0.12), dist * 0.62)
            point = far.lerp(near, u)
        elif mode == "overhead":
            low = put(shoulder, (sign * 0.05, 0.32, 0.5), dist * 0.62)
            high = put(shoulder, (sign * 0.04, -0.02, 1), dist * 0.9)
            point = low.lerp(high, u)
        elif mode == "pallof":
            chest = ex.bone_world(arm, "spine_03", "head")
            start = chest + Vector((sign * 0.07, -0.18, 0.08))
            end = chest + Vector((sign * 0.05, -0.5, 0.1))
            point = start.lerp(end, u)
        elif mode == "crunch":
            head = ex.bone_world(arm, "head", "head")
            chest = ex.bone_world(arm, "spine_03", "head")
            start = head + Vector((sign * 0.08, -0.12, 0.12))
            end = chest + Vector((sign * 0.08, -0.2, 0.02))
            point = start.lerp(end, u)
        elif mode == "deadbug":
            up = ctx["axes"][1]
            toward = ctx["axes"][0]
            if side == "l":
                start = shoulder + up * 0.42
                end = shoulder + toward * 0.4 + up * 0.1
                point = start.lerp(end, u)
            else:
                point = shoulder + up * 0.4
        else:
            point = put(shoulder, (sign * 0.12, -0.2, -0.4), dist * 0.8)
        if mode == "front":
            reach = dist + arm.pose.bones[f"hand_{side}"].length
            point = clamp_reach(shoulder, point, reach * 0.985)
        elif mode not in ("curl", "pushdown", "fixed", "floor", "pulldown"):
            point = clamp_reach(shoulder, point, dist * 0.96)
        grip.location = point
        points[side] = point
        mid = (shoulder + point) * 0.5
        if mode == "chest":
            poles[side].location = point + Vector((sign * 0.22, 0.02, -0.28))
        elif mode == "pulldown":
            # El codo baja y se va un poco atrás, como en el jalón al pecho.
            poles[side].location = Vector((shoulder.x + sign * 0.02, mid.y + 0.16, shoulder.z - 0.42))
        elif mode in ("row", "face", "fly_rear"):
            poles[side].location = mid + Vector((sign * 0.04, 0.26, 0.02))
        elif mode in ("curl", "pushdown"):
            poles[side].location = mid + Vector((0, 0.32, 0))
        elif mode in ("fly",):
            poles[side].location = mid + Vector((sign * 0.04, 0.1, -0.22))
        elif body == "dip":
            poles[side].location = mid + Vector((0.0, 0.36, 0.04))
        elif body == "legcurl":
            hip_now = ex.bone_world(arm, "pelvis", "head")
            head_now = ex.bone_world(arm, "head", "head")
            back = Vector((hip_now.x - head_now.x, hip_now.y - head_now.y, 0.0))
            if back.length < 0.05:
                back = Vector((0.0, 1.0, 0.0))
            back.normalize()
            poles[side].location = mid + back * 0.24 + Vector((sign * 0.05, 0.0, -0.02))
        elif body == "legext":
            poles[side].location = mid + Vector((sign * 0.05, 0.28, -0.04))
        elif spec.get("grip") == "chin":
            # El codo baja al frente, pegado al costado. No se abre como en un jalón ancho.
            poles[side].location = mid + Vector((sign * 0.045, -0.42, -0.12))
        elif body == "pullup":
            poles[side].location = mid + Vector((sign * 0.12, 0.28, -0.16))
        elif mode == "front":
            # Codo suave, hacia abajo. No se abre ni se dobla como un curl.
            poles[side].location = mid + Vector((sign * 0.04, 0.05, -0.16))
        elif body == "hinge" and spec.get("hinge_anim", True):
            poles[side].location = mid + Vector((sign * 0.04, 0.02, -0.30))
        else:
            poles[side].location = mid + Vector((sign * 0.18, 0.14, -0.04))
    if spec["prop"] == "bar" and spec.get("grip") != "chin":
        y = (points["l"].y + points["r"].y) * 0.5
        z = (points["l"].z + points["r"].z) * 0.5
        for side in ("l", "r"):
            grips[side].location.y = y
            grips[side].location.z = z


def legext_machine(ex, arm):
    """Asiento y respaldo. El rodillo va aparte porque sigue a la espinilla."""
    pelvis = ex.bone_world(arm, "pelvis", "head")
    chest = ex.bone_world(arm, "spine_03", "head")
    seat_z = pelvis.z - 0.13
    seat = add_box(ex, "ext_asiento", (pelvis.x, pelvis.y - 0.05, seat_z), (0.52, 0.48, 0.08), (0.72, 0.74, 0.76))
    back_h = max(0.34, chest.z - pelvis.z + 0.06)
    back = add_box(
        ex,
        "ext_respaldo",
        (pelvis.x, pelvis.y + 0.16, pelvis.z + back_h * 0.35),
        (0.46, 0.07, back_h),
        (0.72, 0.74, 0.76),
    )
    parts = [seat, back]
    for x in (-0.2, 0.2):
        parts.append(add_box(
            ex,
            f"ext_pata_{x}",
            (x, pelvis.y, seat_z * 0.5),
            (0.05, 0.06, max(0.18, seat_z)),
            (0.16, 0.17, 0.19),
        ))
    return join_named("maquina_extension", parts)


def legext_roller(ex):
    """Almohadilla delante de los tobillos. El largo cruza las dos piernas."""
    roller = ex.cylinder("rodillo_extension", 0.038, 0.46, "X", (0.0, 0.0, 0.4))
    ex.metal(roller, (0.82, 0.84, 0.86))
    return roller


def follow_ext_roller(ex, arm, frame):
    roller = bpy.data.objects.get("rodillo_extension")
    if roller is None:
        return
    left = ex.bone_world(arm, "calf_l", "tail")
    right = ex.bone_world(arm, "calf_r", "tail")
    mid = (left + right) * 0.5
    knee = (ex.bone_world(arm, "calf_l", "head") + ex.bone_world(arm, "calf_r", "head")) * 0.5
    along = mid - knee
    if along.length < 1e-4:
        along = Vector((0.0, -1.0, 0.0))
    along.normalize()
    front = Vector((0.0, -1.0, 0.0))
    front = front - along * front.dot(along)
    if front.length < 1e-4:
        front = Vector((0.0, -1.0, 0.0))
    front.normalize()
    roller.location = mid - along * 0.055 + front * 0.04
    roller.rotation_mode = "XYZ"
    roller.rotation_euler = (0.0, 0.0, 0.0)
    ex.key_object(roller, frame, "location")
    ex.key_object(roller, frame, "rotation_euler")


def follow_roller(ex, arm, frame):
    """El rodillo se queda en el tendón. Si se ancla al techo, al subir se pasa al empeine."""
    roller = bpy.data.objects.get("rodillo_femoral")
    if roller is None:
        return
    left = ex.bone_world(arm, "calf_l", "tail")
    right = ex.bone_world(arm, "calf_r", "tail")
    mid = (left + right) * 0.5
    knee = (ex.bone_world(arm, "calf_l", "head") + ex.bone_world(arm, "calf_r", "head")) * 0.5
    shin = mid - knee
    if shin.length < 1e-4:
        shin = Vector((0.0, -1.0, 0.0))
    shin.normalize()
    sole = Vector((0.0, 0.0, 0.0))
    for side in ("l", "r"):
        world = arm.matrix_world @ arm.pose.bones[f"foot_{side}"].matrix
        sole += world.col[2].xyz
    if sole.length < 1e-4:
        sole = Vector((0.0, 0.0, 1.0))
    sole.normalize()
    roller.location = mid - shin * 0.045 + sole * 0.05
    roller.rotation_mode = "XYZ"
    roller.rotation_euler = (0.0, 0.0, 0.0)
    ex.key_object(roller, frame, "location")
    ex.key_object(roller, frame, "rotation_euler")


def follow_plate(ex, arm, toward, frame):
    """La plataforma se apoya en las plantas, no en el tobillo."""
    plate = bpy.data.objects.get("plataforma_prensa")
    if plate is None:
        return
    left = ex.bone_world(arm, "calf_l", "tail")
    right = ex.bone_world(arm, "calf_r", "tail")
    mid = (left + right) * 0.5 + toward * 0.08 + Vector((0.0, 0.0, 0.08))
    plate.location = Vector((mid.x, mid.y, mid.z))
    plate.rotation_mode = "XYZ"
    plate.rotation_euler = (0.0, 0.0, 0.0)
    ex.key_object(plate, frame, "location")
    ex.key_object(plate, frame, "rotation_euler")


def aim_foot(arm, side, toe_dir, sole_dir, frame):
    """Apunta el eje local del pie: +Y hacia los dedos, +Z hacia la planta."""
    foot = arm.pose.bones[f"foot_{side}"]
    y_axis = Vector(toe_dir)
    z_axis = Vector(sole_dir)
    if y_axis.length < 1e-5 or z_axis.length < 1e-5:
        return
    y_axis.normalize()
    z_axis.normalize()
    x_axis = y_axis.cross(z_axis)
    if x_axis.length < 1e-5:
        return
    x_axis.normalize()
    z_axis = x_axis.cross(y_axis).normalized()
    rot = Matrix((x_axis, y_axis, z_axis)).transposed()
    world = arm.matrix_world @ foot.matrix
    held = Matrix.Translation(world.to_translation()) @ rot.to_4x4()
    foot.rotation_mode = "QUATERNION"
    foot.matrix = arm.matrix_world.inverted() @ held
    foot.keyframe_insert("rotation_quaternion", frame=frame)
    ball = arm.pose.bones[f"ball_{side}"]
    ball.rotation_mode = "XYZ"
    ball.rotation_euler = (0.0, 0.0, 0.0)
    ball.keyframe_insert("rotation_euler", frame=frame)


def plant_bulgarian(ex, arm, u, feet, ctx):
    """Baja la cadera para que la planta delantera apoye también al subir.

    Desde la altura de pie la zancada no alcanza el suelo: la rodilla se bloquea
    y el pie se despega como un salto. Arriba queda una flexión suave; abajo, cerca de 90°.
    """
    target = feet["l"].location
    bpy.context.view_layer.update()
    hip = ex.bone_world(arm, "thigh_l", "head")
    horizontal = Vector((target.x - hip.x, target.y - hip.y, 0.0)).length
    reach = ctx.get("leg_len", 0.83) * (0.94 - 0.28 * u)
    vertical = sqrt(max(reach * reach - horizontal * horizontal, 0.05))
    arm.location.z -= hip.z - (target.z + vertical)


def knee_deg(ex, arm, side):
    hip = ex.bone_world(arm, f"thigh_{side}", "head")
    knee = ex.bone_world(arm, f"calf_{side}", "head")
    ankle = ex.bone_world(arm, f"calf_{side}", "tail")
    u = (hip - knee).normalized()
    v = (ankle - knee).normalized()
    return degrees(acos(max(-1.0, min(1.0, u.dot(v)))))


def roll_with_rest(arm, bone, y_axis):
    """Gira el hueso sobre su largo para que siga siendo izquierdo o derecho."""
    rest_x = (arm.matrix_world @ bone.bone.matrix_local).col[0].xyz
    x_axis = rest_x - y_axis * y_axis.dot(rest_x)
    if x_axis.length < 1e-5:
        return None
    x_axis.normalize()
    z_axis = x_axis.cross(y_axis).normalized()
    return x_axis, z_axis


def aim_thigh(arm, side, target, up):
    """El fémur apunta al frente y se queda en el asiento. Solo la rodilla se mueve."""
    bone = arm.pose.bones[f"thigh_{side}"]
    head = Vector(arm.matrix_world @ bone.head)
    y_axis = target - head
    if y_axis.length < 1e-5:
        return head
    y_axis.normalize()
    rolled = roll_with_rest(arm, bone, y_axis)
    if rolled is None:
        z_axis = Vector(up) - y_axis * y_axis.dot(Vector(up))
        if z_axis.length < 1e-5:
            z_axis = Vector((0.0, 0.0, 1.0))
        z_axis.normalize()
        x_axis = y_axis.cross(z_axis)
        if x_axis.length < 1e-5:
            return head
        x_axis.normalize()
        z_axis = x_axis.cross(y_axis).normalized()
    else:
        x_axis, z_axis = rolled
    rot = Matrix((x_axis, y_axis, z_axis)).transposed()
    held = Matrix.Translation(head) @ rot.to_4x4()
    bone.rotation_mode = "QUATERNION"
    bone.matrix = arm.matrix_world.inverted() @ held
    bone.location = Vector((0.0, 0.0, 0.0))
    return head


def move_feet(ex, arm, spec, u, feet, ctx, frame):
    body = spec["body"]
    if spec.get("grip") == "chin":
        rise = spec.get("rise", 0.36) * u + ctx.get("chin_foot_lift", 0.0)
        prefix = spec["key"].replace("-", "_")
        for side, foot in feet.items():
            home = ctx["foot_home"][side]
            foot.location = Vector((home.x, home.y, home.z + rise))
            ex.key_object(foot, frame)
            pole = bpy.data.objects.get(f"{prefix}_polo_rodilla_{side}")
            if pole is not None and side in ctx.get("pole_home", {}):
                ph = ctx["pole_home"][side]
                pole.location = Vector((ph.x, ph.y, ph.z + rise))
                ex.key_object(pole, frame)
        return
    if body == "calf":
        for side, foot in feet.items():
            home = ctx["foot_home"][side]
            foot.location = Vector((home.x, home.y, home.z + CALF_RISE * (1.0 + u)))
            ex.key_object(foot, frame)
        return
    if body == "legpress":
        up = ctx["axes"][1]
        toward = ctx["axes"][0]
        prefix = spec["key"].replace("-", "_")
        for side, foot in feet.items():
            sign = 1 if side == "l" else -1
            hip = ex.bone_world(arm, f"thigh_{side}", "head")
            leg = ctx.get("leg_len", 0.83)
            # La rodilla abre hacia el costado. Si el polo apunta al pecho, el fémur entra en el abdomen.
            straight = hip + up * (leg * 0.99) + Vector((sign * 0.05, 0, 0))
            bent = hip + up * (leg * 0.72) + Vector((sign * 0.10, 0, 0))
            foot.location = straight.lerp(bent, u)
            pole = bpy.data.objects.get(f"{prefix}_polo_rodilla_{side}")
            if pole is not None:
                straight_knee = hip + up * (leg * 0.50) + toward * 0.02 + Vector((sign * 0.06, 0, 0))
                bent_knee = hip + up * (leg * 0.36) + toward * 0.04 + Vector((sign * 0.32, 0, 0))
                pole.location = straight_knee.lerp(bent_knee, u)
                ex.key_object(pole, frame)
            ex.key_object(foot, frame)
        return
    if body == "legcurl":
        # El talón gira alrededor de la rodilla, no de la cadera. 15° a 105°:
        # más cerrado levanta la pelvis en la máquina real.
        up = Vector((0, 0, 1))
        prefix = spec["key"].replace("-", "_")
        for side, foot in feet.items():
            sign = 1 if side == "l" else -1
            hip = ex.bone_world(arm, f"thigh_{side}", "head")
            knee = ex.bone_world(arm, f"calf_{side}", "head")
            away = Vector((knee.x - hip.x, knee.y - hip.y, 0))
            if away.length < 0.05:
                away = Vector((0, -1, 0))
            away.normalize()
            calf = arm.pose.bones[f"calf_{side}"].length
            phi = radians(15) + radians(90) * u
            foot.location = knee + away * (calf * cos(phi)) + up * (calf * sin(phi)) + Vector((sign * 0.012, 0, 0))
            pole = bpy.data.objects.get(f"{prefix}_polo_rodilla_{side}")
            if pole is not None:
                pole.location = knee + Vector((sign * 0.05, 0, -0.42))
                ex.key_object(pole, frame)
            ex.key_object(foot, frame)
        return
    if body == "legext":
        # El muslo queda horizontal. La espinilla gira de casi vertical a casi recta.
        prefix = spec["key"].replace("-", "_")
        memory = ctx.setdefault("ext_quat", {})
        for side in ("l", "r"):
            sign = 1 if side == "l" else -1
            thigh_len = arm.pose.bones[f"thigh_{side}"].length
            hip = Vector(arm.matrix_world @ arm.pose.bones[f"thigh_{side}"].head)
            knee_at = hip + Vector((sign * 0.035, -thigh_len, -0.02))
            aim_thigh(arm, side, knee_at, Vector((0.0, 0.0, 1.0)))
            bone = arm.pose.bones[f"thigh_{side}"]
            bone.keyframe_insert("location", frame=frame)
            steady_quat(bone, memory, f"thigh_{side}")
        bpy.context.view_layer.update()
        phi = radians(8) + radians(74) * u
        shin = Vector((0.0, -sin(phi), -cos(phi)))
        for side, foot in feet.items():
            sign = 1 if side == "l" else -1
            knee = ex.bone_world(arm, f"calf_{side}", "head")
            calf = arm.pose.bones[f"calf_{side}"].length
            foot.location = knee + shin * (calf * 0.98) + Vector((sign * 0.01, 0.0, 0.0))
            pole = bpy.data.objects.get(f"{prefix}_polo_rodilla_{side}")
            if pole is not None:
                pole.location = knee + Vector((sign * 0.02, -0.22, 0.26))
                ex.key_object(pole, frame)
            ex.key_object(foot, frame)
        return
    if body == "hinge" and spec.get("hinge_anim", True):
        prefix = spec["key"].replace("-", "_")
        for side, foot in feet.items():
            sign = 1 if side == "l" else -1
            foot.location = ctx["foot_home"][side]
            ex.key_object(foot, frame)
            hip = ex.bone_world(arm, f"thigh_{side}", "head")
            pole = bpy.data.objects.get(f"{prefix}_polo_rodilla_{side}")
            if pole is not None:
                pole.location = Vector((hip.x + sign * 0.10, hip.y - 0.36, max(hip.z * 0.42, 0.26)))
                ex.key_object(pole, frame)
        return
    if body == "deadbug":
        up = ctx["axes"][1]
        toward = ctx["axes"][0]
        foot = feet["r"]
        hip = ex.bone_world(arm, "thigh_r", "head")
        bent = hip - toward * 0.12 + up * 0.32
        straight = hip - toward * 0.48 + up * 0.08
        foot.location = bent.lerp(straight, u)
        ex.key_object(foot, frame)


def place_prop(ex, spec, grips, props, frame):
    if spec["prop"] not in ("one", "handle") or not props:
        return
    obj = props[0]
    mid = (grips["l"].location + grips["r"].location) * 0.5
    if spec["arms"] == "overhead":
        mid = mid + Vector((0, 0.02, 0.06))
    elif spec["arms"] == "chest":
        mid = mid + Vector((0, -0.03, 0.06))
    obj.location = mid
    obj.rotation_mode = "XYZ"
    obj.rotation_euler = (0, radians(90), 0) if spec.get("axis") == "z" else (0, 0, 0)
    ex.key_object(obj, frame, "location")
    ex.key_object(obj, frame, "rotation_euler")


def fist_center(ex, arm, side, axis):
    """Centro del puño, a la altura de la muñeca. Ahí tiene que pasar el mango."""
    wrist = ex.bone_world(arm, f"hand_{side}", "head")
    total = Vector()
    count = 0
    for point in ex.finger_points(arm, side):
        delta = point - wrist
        total += delta - axis * delta.dot(axis)
        count += 1
    if count == 0 or total.length < 1e-5:
        return wrist
    return wrist + total / count


def clasp_hand(ex, arm, side, frame):
    """Los dedos apuntan al mango y se cierran a su alrededor."""
    hand = arm.pose.bones[f"hand_{side}"]
    wrist = (arm.matrix_world @ hand.matrix).translation.copy()
    along = Vector((-wrist.x, -0.07, 0.0))
    if along.length < 1e-4:
        along = Vector((0.0, -1.0, 0.0))
    along.normalize()
    axis = Vector((0.0, 0.0, 1.0))
    palm = along.cross(axis).normalized()
    src_along, src_axis, src_palm = ex.finger_frame(side)
    src = Matrix((src_along, src_axis, src_palm)).transposed()
    dst = Matrix((along, axis, palm)).transposed()
    world = (dst @ src.inverted()).to_4x4()
    world.translation = wrist
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ world
    hand.keyframe_insert("rotation_quaternion", frame=frame)
    ex.apply_curl(arm, side, 0.75, frame)


def grip_goblet(ex, arm, bell):
    """Las dos manos rodean el mango, no la placa."""
    if bell.animation_data:
        bell.animation_data_clear()
    for frame in range(1, ex.FRAMES + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        for side in ("l", "r"):
            clasp_hand(ex, arm, side, frame)
        bpy.context.view_layer.update()
        left = ex.tuck_target(arm, ("l",), Vector((0.0, 0.0, 1.0)))
        right = ex.tuck_target(arm, ("r",), Vector((0.0, 0.0, 1.0)))
        held = (left + right) * 0.5
        bell.location = Vector((held.x, held.y, held.z - 0.04))
        bell.rotation_mode = "XYZ"
        bell.rotation_euler = (0.0, radians(-90), 0.0)
        ex.key_object(bell, frame, "location")
        ex.key_object(bell, frame, "rotation_euler")
    ex.keep_action(bell, "Prop Sentadilla goblet")
    for frame in (1, ex.BOTTOM_FRAME):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        hole = (ex.bone_world(arm, "hand_l", "tail") + ex.bone_world(arm, "hand_r", "tail")) * 0.5
        gap = (bell.matrix_world.translation - hole).length
        tips = []
        axis_now = (bell.matrix_world.to_3x3() @ Vector((1.0, 0.0, 0.0))).normalized()
        for side in ("l", "r"):
            tip = ex.bone_world(arm, f"middle_03_{side}", "tail")
            delta = tip - bell.matrix_world.translation
            tips.append((delta - axis_now * delta.dot(axis_now)).length)
        print(
            "GOBLET", frame,
            f"centro {gap:.3f}",
            "puntas", " ".join(f"{t:.3f}" for t in tips),
            "eje", tuple(round(c, 2) for c in axis_now),
            flush=True,
        )


def chin_rise(ex, arm):
    """Cuánto tiene que subir el cuerpo para que el mentón llegue a la barra."""
    shoulder = ex.bone_world(arm, "upperarm_l", "head")
    reach = arm.pose.bones["upperarm_l"].length + arm.pose.bones["lowerarm_l"].length
    head = ex.bone_world(arm, "head", "head")
    bar_z = shoulder.z + reach * 0.985 + 0.028
    chin_z = head.z - 0.055
    return max(0.28, bar_z - chin_z) + CHIN_BAR_LIFT + CHIN_HEAD_CLEAR


def palm_world(ex, arm, side):
    _along, _axis, palm = ex.finger_frame(side)
    hand = arm.pose.bones[f"hand_{side}"]
    return ((arm.matrix_world @ hand.matrix).to_3x3() @ palm).normalized()


CHIN_TOES = Vector((0.0, -0.2, -1.0))
CHIN_SOLE = Vector((0.0, 0.1, -0.5))
# El centro del puño queda en la palma. La barra sube hasta el gancho de los dedos.
CHIN_BAR_LIFT = 0.030
# El hueso de la cabeza queda sobre la barra, pero la cara sigue y la atraviesa.
# Este extra sube el mentón por delante de la barra.
CHIN_HEAD_CLEAR = 0.09


def pose_chin_hand(ex, arm, side, fingers_up, palm_y):
    """Palma hacia la cara y el puño se cierra alrededor de la barra, no hacia el techo."""
    hand = arm.pose.bones[f"hand_{side}"]
    wrist = (arm.matrix_world @ hand.matrix).translation.copy()
    along = Vector((0.0, -0.12, 1.0))
    along.normalize()
    axis = Vector((1.0, 0.0, 0.0))
    axis = (axis - along * axis.dot(along)).normalized()
    palm = along.cross(axis)
    if palm.y < 0.0:
        axis = -axis
        palm = -palm
    palm.normalize()
    src_along, src_axis, src_palm = ex.finger_frame(side)
    src = Matrix((src_along, src_axis, src_palm)).transposed()
    dst = Matrix((along, axis, palm)).transposed()
    world = (dst @ src.inverted()).to_4x4()
    world.translation = wrist
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ world
    hand.location = Vector((0.0, 0.0, 0.0))


def pick_chin_grip(ex, arm, axis):
    """Agarre supino simétrico. El mismo cierre en las dos manos."""
    choice = {"fingers_up": True, "palm_y": 1.0, "scale": 1.55}
    print("CHIN_TRY", choice, flush=True)
    return choice


def steady_quat(bone, memory, key):
    """Evita el salto de hemisferio: si no, al reproducir la mano se abre a mitad de ciclo."""
    bone.rotation_mode = "QUATERNION"
    quat = bone.rotation_quaternion.copy()
    prev = memory.get(key)
    if prev is not None and prev.dot(quat) < 0.0:
        quat.negate()
        bone.rotation_quaternion = quat
    memory[key] = quat.copy()
    bone.keyframe_insert("rotation_quaternion", frame=bpy.context.scene.frame_current)


def seal_chin_hands(ex, arm, choice, memory, frame):
    for side in ("l", "r"):
        pose_chin_hand(ex, arm, side, choice["fingers_up"], choice["palm_y"])
        hand = arm.pose.bones[f"hand_{side}"]
        hand.keyframe_insert("location", frame=frame)
        steady_quat(hand, memory, f"hand_{side}")
        ex.apply_curl(arm, side, choice["scale"], frame)
        for finger in ("index", "middle", "ring", "pinky", "thumb"):
            for index in (1, 2, 3):
                name = f"{finger}_0{index}_{side}"
                steady_quat(arm.pose.bones[name], memory, name)


def lock_chin_wrists(ex, arm, spec, grips, ctx):
    """Mueve la diana de la muñeca para que el centro del puño caiga en la misma barra."""
    axis = Vector((1.0, 0.0, 0.0))
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    choice = pick_chin_grip(ex, arm, axis)
    spec["chin_choice"] = choice
    for side in ("l", "r"):
        pose_chin_hand(ex, arm, side, choice["fingers_up"], choice["palm_y"])
        ex.apply_curl(arm, side, choice["scale"], 1)
    bpy.context.view_layer.update()
    offsets = {}
    holes = []
    for side in ("l", "r"):
        wrist = ex.bone_world(arm, f"hand_{side}", "head")
        hole = ex.grip_hole(arm, side, axis, 0.02)
        offsets[side] = hole - wrist
        holes.append(hole)
    y = sum(hole.y for hole in holes) / len(holes)
    z = sum(hole.z for hole in holes) / len(holes)
    for side in ("l", "r"):
        desired = Vector((ctx["fixed"][side].x, y, z))
        ctx["fixed"][side] = desired - offsets[side]
        grips[side].location = ctx["fixed"][side].copy()
    spec["chin_bar"] = (y, z)
    print("CHIN_LOCK", choice, "barra", round(y, 3), round(z, 3), flush=True)


def elbow_deg(ex, arm, side):
    shoulder = ex.bone_world(arm, f"upperarm_{side}", "head")
    elbow = ex.bone_world(arm, f"lowerarm_{side}", "head")
    wrist = ex.bone_world(arm, f"hand_{side}", "head")
    u = (shoulder - elbow).normalized()
    v = (wrist - elbow).normalized()
    return degrees(acos(max(-1.0, min(1.0, u.dot(v)))))


def grip_chin(ex, arm, bar, spec):
    """Agarre supino fijo: la barra no se mueve y los dedos se quedan cerrados encima."""
    ex.pose_mode(arm)
    axis = Vector((1.0, 0.0, 0.0))
    choice = spec.get("chin_choice")
    if not choice:
        bpy.context.scene.frame_set(1)
        bpy.context.view_layer.update()
        choice = pick_chin_grip(ex, arm, axis)
    print("CHIN_GRIP", choice, flush=True)
    memory = {}
    samples = []
    prev = None
    spin = 0.0
    for frame in range(1, ex.FRAMES + 1):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        toes_down = CHIN_TOES
        sole_down = CHIN_SOLE
        for side in ("l", "r"):
            aim_foot(arm, side, toes_down, sole_down, frame)
            steady_quat(arm.pose.bones[f"foot_{side}"], memory, f"foot_{side}")
        seal_chin_hands(ex, arm, choice, memory, frame)
        bpy.context.view_layer.update()
        quat = arm.pose.bones["hand_l"].rotation_quaternion
        if prev is not None:
            spin = max(spin, degrees(prev.rotation_difference(quat).angle))
        prev = quat.copy()
        holes = [ex.grip_hole(arm, side, axis, 0.02) for side in ("l", "r")]
        samples.append((holes[0] + holes[1]) * 0.5)
    ys = sorted(sample.y for sample in samples)
    zs = sorted(sample.z for sample in samples)
    y = ys[len(ys) // 2]
    z = zs[len(zs) // 2]
    drift = max(max(abs(sample.y - y), abs(sample.z - z)) for sample in samples)
    z += CHIN_BAR_LIFT
    if bar.animation_data:
        bar.animation_data_clear()
    for frame in range(1, ex.FRAMES + 1):
        bar.location = Vector((0.0, y, z))
        bar.rotation_mode = "XYZ"
        bar.rotation_euler = (0.0, 0.0, 0.0)
        ex.key_object(bar, frame, "location")
        ex.key_object(bar, frame, "rotation_euler")
    print("CHIN_BAR", round(y, 3), round(z, 3), "deriva", round(drift, 4), "giro", round(spin, 1), flush=True)
    origin = Vector((0.0, y, z))
    for frame in (1, 40, ex.BOTTOM_FRAME, ex.FRAMES):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        tips = [ex.tip_gap(arm, side, origin, axis) for side in ("l", "r")]
        tip = ex.middle_tip(arm, "l")
        finger = arm.pose.bones["middle_01_l"]
        finger_world = arm.matrix_world @ finger.matrix
        curl_x = finger_world.col[0].xyz.normalized()
        palms = [palm_world(ex, arm, side) for side in ("l", "r")]
        head = ex.bone_world(arm, "head", "head")
        toes = [ex.bone_world(arm, f"ball_{side}", "tail").z for side in ("l", "r")]
        shoulder = ex.bone_world(arm, "upperarm_l", "head")
        elbow = ex.bone_world(arm, "lowerarm_l", "head")
        wrist = ex.bone_world(arm, "hand_l", "head")
        print(
            "CHIN_FRAME", frame,
            "codo", round(elbow_deg(ex, arm, "l"), 1),
            "punta", round(max(tips), 4),
            "dedo", round(tip.y - y, 3), round(tip.z - z, 3),
            "eje", tuple(round(c, 2) for c in curl_x),
            "palma", tuple(round(v, 2) for v in palms[0]),
            "cabeza", round(head.z - z, 3),
            "pies", round(toes[0], 3), round(toes[1], 3),
            "muneca_x", round(wrist.x, 3),
            "hombro_x", round(shoulder.x, 3),
            "codo_frente", round(elbow.y - (shoulder.y + wrist.y) * 0.5, 3),
            flush=True,
        )


def seat_station(bar, ctx):
    """Los postes llegan hasta la barra ya cerrada por las manos."""
    station = bpy.data.objects.get("estructura_dominadas")
    if station is None or "station_top" not in ctx:
        return
    station.location.z += bar.location.z - ctx["station_top"]
    station.location.y += bar.location.y - ctx["station_y"]


def pose_pulldown_hand(ex, arm, side, choice):
    """Prono: los dedos se cierran alrededor de la barra, con la palma hacia adelante."""
    hand = arm.pose.bones[f"hand_{side}"]
    wrist = (arm.matrix_world @ hand.matrix).translation.copy()
    along = Vector(choice["along"]).normalized()
    axis = Vector((choice["axis_sign"], 0.0, 0.0))
    axis = (axis - along * axis.dot(along)).normalized()
    palm = along.cross(axis)
    if palm.dot(Vector(choice["palm"])) < 0.0:
        axis = -axis
        palm = -palm
    palm.normalize()
    src_along, src_axis, src_palm = ex.finger_frame(side)
    src = Matrix((src_along, src_axis, src_palm)).transposed()
    dst = Matrix((along, axis, palm)).transposed()
    world = (dst @ src.inverted()).to_4x4()
    world.translation = wrist
    hand.rotation_mode = "QUATERNION"
    hand.matrix = arm.matrix_world.inverted() @ world
    hand.location = Vector((0.0, 0.0, 0.0))


def pick_pulldown_grip(ex, arm, bar_y, bar_z, frame):
    """Elige el giro en el que la punta del dedo queda debajo de la barra."""
    best = None
    alongs = ((0.0, -0.35, 0.55), (0.0, -0.7, 0.25), (0.0, -0.2, -0.15))
    palms = ((0.0, -0.25, -1.0), (0.0, -1.0, -0.2))
    for axis_sign in (1.0, -1.0):
        for along in alongs:
            for palm in palms:
                choice = {"along": along, "axis_sign": axis_sign, "palm": palm, "scale": 1.75}
                for side in ("l", "r"):
                    pose_pulldown_hand(ex, arm, side, choice)
                    ex.apply_curl(arm, side, choice["scale"], frame)
                bpy.context.view_layer.update()
                score = 0.0
                for side in ("l", "r"):
                    tip = ex.middle_tip(arm, side)
                    radial = Vector((0.0, tip.y - bar_y, tip.z - bar_z)).length
                    score += radial
                    if tip.z > bar_z - 0.01:
                        score += 0.25 + (tip.z - bar_z)
                if best is None or score < best[0]:
                    best = (score, choice)
    print("PULL_GRIP", round(best[0], 3), best[1]["along"], best[1]["axis_sign"], best[1]["palm"], flush=True)
    return best[1]


def pick_hinge_grip(ex, arm, bar_y, bar_z, frame):
    """Prono colgando: los dedos cierran por debajo de la barra."""
    best = None
    alongs = ((0.0, -0.15, -1.0), (0.0, -0.45, -0.85), (0.0, 0.05, -1.0))
    palms = ((0.0, 1.0, -0.15), (0.0, 0.35, -1.0), (0.0, -0.2, -1.0))
    for axis_sign in (1.0, -1.0):
        for along in alongs:
            for palm in palms:
                choice = {"along": along, "axis_sign": axis_sign, "palm": palm, "scale": 1.75}
                for side in ("l", "r"):
                    pose_pulldown_hand(ex, arm, side, choice)
                    ex.apply_curl(arm, side, choice["scale"], frame)
                bpy.context.view_layer.update()
                score = 0.0
                for side in ("l", "r"):
                    tip = ex.middle_tip(arm, side)
                    radial = Vector((0.0, tip.y - bar_y, tip.z - bar_z)).length
                    score += radial
                    if tip.z > bar_z + 0.02:
                        score += 0.35
                if best is None or score < best[0]:
                    best = (score, choice)
    print("HINGE_GRIP", round(best[0], 3), best[1]["along"], best[1]["axis_sign"], best[1]["palm"], flush=True)
    return best[1]


def seat_pulldown(ex, arm, grips, frame, memory, picker=None):
    """Los puños cierran la barra. Las dos manos comparten la misma altura."""
    axis = Vector((1.0, 0.0, 0.0))
    desired = {side: grip.location.copy() for side, grip in grips.items()}
    y = (desired["l"].y + desired["r"].y) * 0.5
    z = (desired["l"].z + desired["r"].z) * 0.5
    for side in ("l", "r"):
        desired[side] = Vector((desired[side].x, y, z))
    if "choice" not in memory:
        choose = picker or pick_pulldown_grip
        memory["choice"] = choose(ex, arm, y, z, frame)
    choice = memory["choice"]
    for _ in range(3):
        bpy.context.view_layer.update()
        for side in ("l", "r"):
            pose_pulldown_hand(ex, arm, side, choice)
            ex.apply_curl(arm, side, choice["scale"], frame)
        bpy.context.view_layer.update()
        for side in ("l", "r"):
            wrist = ex.bone_world(arm, f"hand_{side}", "head")
            hole = ex.grip_hole(arm, side, axis, 0.016)
            grips[side].location = desired[side] - (hole - wrist)
    bpy.context.view_layer.update()
    for side in ("l", "r"):
        pose_pulldown_hand(ex, arm, side, choice)
        hand = arm.pose.bones[f"hand_{side}"]
        hand.keyframe_insert("location", frame=frame)
        steady_quat(hand, memory, f"hand_{side}")
        ex.apply_curl(arm, side, choice["scale"], frame)
        for finger in ("index", "middle", "ring", "pinky", "thumb"):
            for index in (1, 2, 3):
                name = f"{finger}_0{index}_{side}"
                steady_quat(arm.pose.bones[name], memory, name)


def finish_grip(ex, arm, spec, grips, props):
    kind = spec["grip"]
    if kind == "chin":
        grip_chin(ex, arm, props[0], spec)
        ex.keep_action(props[0], f"Prop {spec['label']}")
        return
    if kind == "barra" and (spec.get("arms") == "pulldown" or (spec.get("body") == "hinge" and spec.get("hinge_anim", True))):
        bar = props[0]
        if bar.animation_data:
            bar.animation_data_clear()
        axis = Vector((1.0, 0.0, 0.0))
        for frame in range(1, ex.FRAMES + 1):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            holes = [ex.grip_hole(arm, side, axis, 0.018) for side in ("l", "r")]
            mid = (holes[0] + holes[1]) * 0.5
            bar.location = Vector((0.0, mid.y, mid.z))
            bar.rotation_mode = "XYZ"
            bar.rotation_euler = (0.0, 0.0, 0.0)
            ex.key_object(bar, frame, "location")
            ex.key_object(bar, frame, "rotation_euler")
        ex.keep_action(bar, f"Prop {spec['label']}")
        return
    if kind == "barra":
        bar = props[0]
        if bar.animation_data:
            bar.animation_data_clear()
        for frame in range(1, ex.FRAMES + 1):
            ex.wrap_hands(arm, bar, frame)
            bpy.context.view_layer.update()
            left = ex.bone_world(arm, "hand_l", "head")
            right = ex.bone_world(arm, "hand_r", "head")
            mid = (left + right) * 0.5
            bar.location = Vector((0.0, mid.y, mid.z))
            bar.rotation_mode = "XYZ"
            bar.rotation_euler = (0, 0, 0)
            ex.key_object(bar, frame, "location")
            ex.key_object(bar, frame, "rotation_euler")
        ex.keep_action(bar, f"Prop {spec['label']}")
        for frame in (1, ex.BOTTOM_FRAME):
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            left = ex.bone_world(arm, "hand_l", "head")
            right = ex.bone_world(arm, "hand_r", "head")
            mid = (left + right) * 0.5
            gap = (bar.matrix_world.translation - mid).length
            print("BAR", spec["key"], frame, f"{gap:.3f}", flush=True)
        return
    goals = {
        "supino": lambda sign: Vector((0.0, -0.2, 1.0)),
        "prono": lambda sign: Vector((0.0, 0.2, -1.0)),
        "neutro": lambda sign: Vector((-float(sign), -0.05, 0.2)),
        "abierta": lambda sign: Vector((0.0, 0.1, -1.0)),
    }
    if spec["prop"] == "goblet" and props:
        grip_goblet(ex, arm, props[0])
        return
    scales = {"supino": 0.85, "prono": 0.55, "neutro": 0.75, "abierta": 0.18}
    for frame in range(1, ex.FRAMES + 1):
        for side in ("l", "r"):
            sign = 1 if side == "l" else -1
            ex.supinate_curl(arm, side, frame, goals[kind](sign), scales[kind])
    if spec["prop"] != "bells":
        return
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    if spec.get("unilateral"):
        ex.seat_dumbbell(arm, props[0], "l")
    else:
        ex.seat_dumbbell(arm, props[0], "l")
        ex.seat_dumbbell(arm, props[1], "r")


def point_feet(arm, ex):
    """El horneado deja el pie en la rotación de reposo. La punta se graba después."""
    for frame in range(1, ex.FRAMES + 1):
        u = ex.fade(frame)
        bpy.context.scene.frame_set(frame)
        angle = Quaternion((1.0, 0.0, 0.0), radians(34) * u)
        for side in ("l", "r"):
            foot = arm.pose.bones[f"foot_{side}"]
            foot.rotation_mode = "QUATERNION"
            foot.rotation_quaternion = angle
            foot.keyframe_insert("rotation_quaternion", frame=frame)


def measure_gap(ex, arm, grips):
    bpy.context.scene.frame_set(ex.BOTTOM_FRAME)
    bpy.context.view_layer.update()
    worst = 0.0
    for side, grip in grips.items():
        hand = ex.bone_world(arm, f"hand_{side}", "head")
        worst = max(worst, (hand - grip.location).length)
    return worst


def discard_new_actions(known):
    for action in list(bpy.data.actions):
        if action.name in known:
            continue
        action.use_fake_user = False
        bpy.data.actions.remove(action)


def build_one(ex, spec):
    known = {action.name for action in bpy.data.actions}
    arm, _body = ex.acquire_body()
    bpy.context.scene.frame_set(1)
    refs = ex.sole_reference(arm)
    prefix = spec["key"].replace("-", "_")
    ctx = {"created": []}
    try:
        setup_base(ex, arm, spec, ctx)
        if spec.get("grip") == "chin":
            spec["rise"] = chin_rise(ex, arm)
            print("CHIN_RISE", round(spec["rise"], 3), flush=True)
        ensure_gear(ex, ctx, spec, arm)
        feet = setup_feet(ex, arm, spec, prefix, ctx)
        grips, poles = setup_arms(ex, arm, spec, prefix, ctx)
        if spec.get("grip") == "chin":
            lock_chin_wrists(ex, arm, spec, grips, ctx)
            for bone_name in ("lowerarm_l", "lowerarm_r", "calf_l", "calf_r"):
                for constraint in arm.pose.bones[bone_name].constraints:
                    if constraint.type == "IK":
                        constraint.use_stretch = False
        if spec["body"] == "legext":
            for bone_name in ("calf_l", "calf_r"):
                for constraint in arm.pose.bones[bone_name].constraints:
                    if constraint.type == "IK":
                        constraint.use_stretch = False
        props = setup_props(ex, spec, ctx)
        for frame in range(1, ex.FRAMES + 1):
            u = ex.fade(frame)
            bpy.context.scene.frame_set(frame)
            loc, rot, bend = body_channels(spec, u, ctx)
            arm.location = loc
            arm.rotation_mode = "XYZ"
            arm.rotation_euler = rot
            if spec["body"] == "bulgarian":
                plant_bulgarian(ex, arm, u, feet, ctx)
            if spec["body"] == "bridge":
                bpy.context.view_layer.update()
                shoulder = ex.bone_world(arm, "upperarm_l", "head")
                arm.location = arm.location + (ctx["shoulder_lock"] - shoulder)
            ex.key_object(arm, frame, "location")
            ex.key_object(arm, frame, "rotation_euler")
            if spec["body"] == "hinge" and spec.get("hinge_anim", True):
                pose_hinge(arm, frame, u)
            elif spec.get("arms") == "pulldown":
                set_spine(arm, frame, radians(-16) * u)
            else:
                set_spine(arm, frame, bend)
            if spec["body"] == "shrug":
                set_shrug(arm, frame, u)
            bpy.context.view_layer.update()
            move_feet(ex, arm, spec, u, feet, ctx, frame)
            bpy.context.view_layer.update()
            if spec["body"] == "bulgarian":
                ex.flatten_feet(arm, {"l": refs["l"]}, frame)
                aim_foot(arm, "r", Vector((0.0, 1.0, 0.0)), Vector((0.0, 0.0, 1.0)), frame)
            elif spec["body"] == "legcurl":
                # La planta sigue a la espinilla. Si se ancla al techo, al subir el pie se voltea.
                memory = ctx.setdefault("curl_foot", {})
                soles = ctx.setdefault("curl_sole", {})
                up = Vector((0.0, 0.0, 1.0))
                for side in ("l", "r"):
                    knee = ex.bone_world(arm, f"calf_{side}", "head")
                    ankle = ex.bone_world(arm, f"calf_{side}", "tail")
                    hip = ex.bone_world(arm, f"thigh_{side}", "head")
                    shin = ankle - knee
                    if shin.length < 1e-4:
                        shin = Vector((0.0, 1.0, 0.0))
                    shin.normalize()
                    away = Vector((knee.x - hip.x, knee.y - hip.y, 0.0))
                    if away.length < 0.05:
                        away = Vector((0.0, 1.0, 0.0))
                    away.normalize()
                    axis = away.cross(up)
                    if axis.length < 1e-5:
                        axis = Vector((1.0, 0.0, 0.0))
                    axis.normalize()
                    sole = axis.cross(shin)
                    if sole.length < 1e-5:
                        sole = up.copy()
                    sole.normalize()
                    prev = soles.get(side)
                    if prev is None:
                        if sole.z < 0.0:
                            sole.negate()
                    elif prev.dot(sole) < 0.0:
                        sole.negate()
                    soles[side] = sole.copy()
                    toes = (shin - sole * 0.18).normalized()
                    aim_foot(arm, side, toes, sole, frame)
                    steady_quat(arm.pose.bones[f"foot_{side}"], memory, f"foot_{side}")
                bpy.context.view_layer.update()
                follow_roller(ex, arm, frame)
                if frame in (1, 40, ex.BOTTOM_FRAME):
                    hip = ex.bone_world(arm, "pelvis", "head")
                    chest = ex.bone_world(arm, "spine_03", "head")
                    knee = ex.bone_world(arm, "calf_l", "head")
                    ankle = ex.bone_world(arm, "calf_l", "tail")
                    foot = arm.pose.bones["foot_l"]
                    world = arm.matrix_world @ foot.matrix
                    toe_axis = world.col[1].xyz.normalized()
                    sole_axis = world.col[2].xyz.normalized()
                    print(
                        "CURL", frame,
                        "rodilla", round(knee_deg(ex, arm, "l"), 1), round(knee_deg(ex, arm, "r"), 1),
                        "punta", tuple(round(c, 2) for c in toe_axis),
                        "planta", tuple(round(c, 2) for c in sole_axis),
                        "talon", round(ankle.z - knee.z, 3),
                        flush=True,
                    )
            elif spec["body"] == "legpress":
                toward = ctx["axes"][0]
                for side in ("l", "r"):
                    aim_foot(arm, side, toward, Vector((0.0, 0.0, 1.0)), frame)
                bpy.context.view_layer.update()
                follow_plate(ex, arm, toward, frame)
                if frame in (1, ex.BOTTOM_FRAME):
                    plate = bpy.data.objects.get("plataforma_prensa")
                    ankle = ex.bone_world(arm, "calf_l", "tail")
                    knee = ex.bone_world(arm, "calf_l", "head")
                    hip_l = ex.bone_world(arm, "thigh_l", "head")
                    chest = ex.bone_world(arm, "spine_03", "head")
                    gap = (plate.location.z - ankle.z) if plate else -1
                    print(
                        "PRESS", frame,
                        "rodilla", round(knee_deg(ex, arm, "l"), 1),
                        "fuera", round(abs(knee.x - hip_l.x), 3),
                        "sobre", round(knee.z - chest.z, 3),
                        "planta", round(gap, 3),
                        flush=True,
                    )
            elif spec["body"] == "legext":
                memory = ctx.setdefault("ext_quat", {})
                solved = {}
                for side in ("l", "r"):
                    calf = arm.pose.bones[f"calf_{side}"]
                    shin = (arm.matrix_world @ calf.matrix).col[1].xyz
                    if shin.length < 1e-4:
                        shin = Vector((0.0, -1.0, 0.0))
                    solved[side] = shin.normalized()
                    for constraint in calf.constraints:
                        if constraint.type == "IK":
                            constraint.mute = True
                bpy.context.view_layer.update()
                for side in ("l", "r"):
                    calf = arm.pose.bones[f"calf_{side}"]
                    y_axis = solved[side]
                    rolled = roll_with_rest(arm, calf, y_axis)
                    if rolled is None:
                        continue
                    x_axis, z_axis = rolled
                    rot = Matrix((x_axis, y_axis, z_axis)).transposed()
                    held = Matrix.Translation(Vector(arm.matrix_world @ calf.head)) @ rot.to_4x4()
                    calf.rotation_mode = "QUATERNION"
                    calf.matrix = arm.matrix_world.inverted() @ held
                    calf.keyframe_insert("rotation_quaternion", frame=frame)
                bpy.context.view_layer.update()
                for side in ("l", "r"):
                    knee = ex.bone_world(arm, f"calf_{side}", "head")
                    ankle = ex.bone_world(arm, f"calf_{side}", "tail")
                    shin = ankle - knee
                    if shin.length < 1e-4:
                        shin = Vector((0.0, -1.0, 0.0))
                    shin.normalize()
                    toes = (shin * 0.9 + Vector((0.0, -0.15, 0.2))).normalized()
                    foot = arm.pose.bones[f"foot_{side}"]
                    down = Vector((0.0, 0.0, -1.0))
                    z_axis = down - toes * toes.dot(down)
                    if z_axis.length < 1e-4:
                        z_axis = Vector((0.0, 1.0, 0.0))
                    z_axis.normalize()
                    x_axis = toes.cross(z_axis).normalized()
                    rest_x = (arm.matrix_world @ foot.bone.matrix_local).col[0].xyz
                    if x_axis.dot(rest_x) < 0.0:
                        x_axis.negate()
                    z_axis = x_axis.cross(toes).normalized()
                    if z_axis.z > 0.0:
                        x_axis.negate()
                        z_axis.negate()
                    rot = Matrix((x_axis, toes, z_axis)).transposed()
                    held = Matrix.Translation(Vector(arm.matrix_world @ foot.head)) @ rot.to_4x4()
                    foot.rotation_mode = "QUATERNION"
                    foot.matrix = arm.matrix_world.inverted() @ held
                    foot.keyframe_insert("rotation_quaternion", frame=frame)
                    ball = arm.pose.bones[f"ball_{side}"]
                    ball.rotation_mode = "XYZ"
                    ball.rotation_euler = (0.0, 0.0, 0.0)
                    ball.keyframe_insert("rotation_euler", frame=frame)
                    steady_quat(foot, memory, f"foot_{side}")
                for side in ("l", "r"):
                    for constraint in arm.pose.bones[f"calf_{side}"].constraints:
                        if constraint.type == "IK":
                            constraint.mute = False
                bpy.context.view_layer.update()
                follow_ext_roller(ex, arm, frame)
                if frame in (1, 40, ex.BOTTOM_FRAME):
                    hip = ex.bone_world(arm, "thigh_l", "head")
                    knee_l = ex.bone_world(arm, "calf_l", "head")
                    knee_r = ex.bone_world(arm, "calf_r", "head")
                    ankle_l = ex.bone_world(arm, "calf_l", "tail")
                    ankle_r = ex.bone_world(arm, "calf_r", "tail")
                    axes = []
                    for side in ("l", "r"):
                        world = arm.matrix_world @ arm.pose.bones[f"thigh_{side}"].matrix
                        axes.append(tuple(round(c, 2) for c in world.col[0].xyz))
                    print(
                        "EXT", frame,
                        "rodilla", round(knee_deg(ex, arm, "l"), 1), round(knee_deg(ex, arm, "r"), 1),
                        "abre", round(abs(knee_l.x - hip.x), 3), round(abs(knee_r.x) - abs(ex.bone_world(arm, "thigh_r", "head").x), 3),
                        "tobillo", round(ankle_l.y, 3), round(ankle_r.y, 3), round(ankle_l.z, 3), round(ankle_r.z, 3),
                        "eje", axes,
                        flush=True,
                    )
            elif spec.get("grip") == "chin":
                memory = ctx.setdefault("chin_quat", {})
                toes_down = CHIN_TOES
                sole_down = CHIN_SOLE
                for side in ("l", "r"):
                    aim_foot(arm, side, toes_down, sole_down, frame)
                    steady_quat(arm.pose.bones[f"foot_{side}"], memory, f"foot_{side}")
                if frame == 1 and "chin_foot_lift" not in ctx:
                    bpy.context.view_layer.update()
                    toes = [ex.bone_world(arm, f"ball_{side}", "tail").z for side in ("l", "r")]
                    low = min(toes)
                    ctx["chin_foot_lift"] = 0.0 if low >= 0.045 else 0.045 - low
                    print("CHIN_FOOT_LIFT", round(ctx["chin_foot_lift"], 3), "puntas", [round(t, 3) for t in toes], flush=True)
                    if ctx["chin_foot_lift"] > 0.0:
                        move_feet(ex, arm, spec, u, feet, ctx, frame)
                        bpy.context.view_layer.update()
                        for side in ("l", "r"):
                            aim_foot(arm, side, toes_down, sole_down, frame)
                            steady_quat(arm.pose.bones[f"foot_{side}"], memory, f"foot_{side}")
            elif spec.get("arms") == "pulldown":
                memory = ctx.setdefault("pulldown_foot", {})
                for side in ("l", "r"):
                    # La malla del empeine queda alta si los dedos apuntan al frente. Se bajan hasta la planta.
                    aim_foot(arm, side, Vector((0.0, -0.88, -0.42)), Vector((0.0, 0.25, -1.0)), frame)
                    steady_quat(arm.pose.bones[f"foot_{side}"], memory, f"foot_{side}")
                if "pulldown_drop" not in ctx:
                    bpy.context.view_layer.update()
                    body = ex.SHARED["body"]
                    deps = bpy.context.evaluated_depsgraph_get()
                    ev = body.evaluated_get(deps)
                    mw = ev.matrix_world
                    sole = min((mw @ vert.co).z for vert in ev.data.vertices)
                    drop = sole - 0.015
                    ctx["pulldown_drop"] = drop
                    if abs(drop) > 0.001:
                        # La planta de la malla queda en el suelo, no el hueso del dedo.
                        arm.location.z -= drop
                        ctx["base_loc"] = arm.location.copy()
                        seat = bpy.data.objects.get(f"asiento_{spec['key']}") or bpy.data.objects.get("asiento")
                        if seat is not None:
                            seat.location.z -= drop
                        prefix = spec["key"].replace("-", "_")
                        for side in ("l", "r"):
                            feet[side].location.z -= drop
                            ctx["foot_home"][side].z -= drop
                            pole = bpy.data.objects.get(f"{prefix}_polo_rodilla_{side}")
                            if pole is not None:
                                pole.location.z -= drop
                                ctx["pole_home"][side].z -= drop
                                ex.key_object(pole, frame)
                            ex.key_object(feet[side], frame)
                        ex.key_object(arm, frame, "location")
                        bpy.context.view_layer.update()
                        for side in ("l", "r"):
                            # La malla del empeine queda alta si los dedos apuntan al frente. Se bajan hasta la planta.
                            aim_foot(arm, side, Vector((0.0, -0.88, -0.42)), Vector((0.0, 0.25, -1.0)), frame)
                            steady_quat(arm.pose.bones[f"foot_{side}"], memory, f"foot_{side}")
                        print("PULLDOWN_DROP", round(drop, 3), flush=True)
            elif spec["body"] not in NO_FLAT:
                ex.flatten_feet(arm, refs, frame)
            if spec["body"] == "bulgarian" and frame in (1, 100, 112, ex.BOTTOM_FRAME):
                ankle = ex.bone_world(arm, "calf_l", "tail")
                rear = ex.bone_world(arm, "calf_r", "tail")
                print(
                    "BULGARA", frame,
                    "delante", round(knee_deg(ex, arm, "l"), 1),
                    "atras", round(knee_deg(ex, arm, "r"), 1),
                    "planta", round(ankle.z - feet["l"].location.z, 3),
                    "banco", round(rear.z - feet["r"].location.z, 3),
                    flush=True,
                )
            place_hands(ex, arm, spec, u, grips, poles, ctx)
            if spec.get("arms") == "pulldown":
                seat_pulldown(ex, arm, grips, frame, ctx.setdefault("pulldown_hand", {}))
            elif spec.get("body") == "hinge" and spec.get("hinge_anim", True) and spec.get("grip") == "barra":
                seat_pulldown(ex, arm, grips, frame, ctx.setdefault("hinge_hand", {}), pick_hinge_grip)
            for side in ("l", "r"):
                ex.key_object(grips[side], frame)
                ex.key_object(poles[side], frame)
            if spec.get("grip") == "chin" and spec.get("chin_choice"):
                bpy.context.view_layer.update()
                seal_chin_hands(ex, arm, spec["chin_choice"], ctx.setdefault("chin_quat", {}), frame)
            place_prop(ex, spec, grips, props, frame)
        if spec["body"] == "legext":
            for bone_name in ("calf_l", "calf_r"):
                bone = arm.pose.bones[bone_name]
                for constraint in list(bone.constraints):
                    if constraint.type == "IK":
                        bone.constraints.remove(constraint)
        ex.bake_pose(arm)
        if spec["body"] == "legext":
            for frame in (1, 73):
                bpy.context.scene.frame_set(frame)
                bpy.context.view_layer.update()
                for side in ("l", "r"):
                    world = arm.matrix_world @ arm.pose.bones[f"foot_{side}"].matrix
                    print(
                        "PIE", frame, side,
                        "dedos", tuple(round(c, 2) for c in world.col[1].xyz.normalized()),
                        "planta", tuple(round(c, 2) for c in world.col[2].xyz.normalized()),
                        flush=True,
                    )
        if spec["body"] == "calf":
            point_feet(arm, ex)
        ex.keep_action(arm, spec["label"])
        roller = bpy.data.objects.get("rodillo_femoral")
        if spec["body"] == "legcurl" and roller is not None:
            ex.keep_action(roller, "Rodillo femoral")
        ext_roller = bpy.data.objects.get("rodillo_extension")
        if spec["body"] == "legext" and ext_roller is not None:
            ex.keep_action(ext_roller, "Rodillo extensión")
        plate = bpy.data.objects.get("plataforma_prensa")
        if spec["body"] == "legpress" and plate is not None:
            ex.keep_action(plate, "Plataforma prensa")
        finish_grip(ex, arm, spec, grips, props)
        if spec.get("grip") == "chin" and props:
            seat_station(props[0], ctx)
        if spec["prop"] in ("one", "handle") and props:
            ex.keep_action(props[0], f"Prop {spec['label']}")
        gap = measure_gap(ex, arm, grips)
        print("GAP", spec["key"], f"{gap:.3f}", flush=True)
        if gap > 0.16:
            print("WARN_GAP", spec["key"], flush=True)
    except Exception:
        for obj in ctx["created"]:
            if obj in ex.SHARED["props"]:
                ex.SHARED["props"].remove(obj)
            try:
                bpy.data.objects.remove(obj, do_unlink=True)
            except Exception:
                pass
        discard_new_actions(known)
        raise


def preview(ex, done):
    shoot = ex.SHARED.get("shoot_at")
    if not shoot:
        return
    arm = ex.SHARED["arm"]
    by_key = {row["key"]: row for row in done}
    out = Path(ex.OUT) / "catalog"
    out.mkdir(parents=True, exist_ok=True)
    for key in PREVIEWS:
        spec = by_key.get(key)
        if not spec:
            continue
        action = bpy.data.actions.get(spec["label"])
        if not action or not arm.animation_data:
            continue
        arm.animation_data.action = action
        arm.animation_data.use_nla = False
        shown = set(spec["show"])
        for obj in ex.SHARED["props"]:
            visible = obj.name in shown
            obj.hide_render = not visible
            if obj.animation_data and obj.animation_data.action:
                obj.animation_data.use_nla = False
        shots = (1, ex.BOTTOM_FRAME) if key in ("prensa-piernas", "sentadilla-bulgara") else (ex.BOTTOM_FRAME,)
        for frame in shots:
            bpy.context.scene.frame_set(frame)
            bpy.context.view_layer.update()
            tag = "" if len(shots) == 1 else ("-inicio" if frame == 1 else "-fondo")
            if key == "prensa-piernas":
                shoot(str(out / f"{key}{tag}.png"), (2.8, 0.85, 1.25), (0.05, 0.9, 0.9))
                shoot(str(out / f"{key}{tag}-lado.png"), (0.1, -1.7, 1.45), (0.05, 0.95, 0.85))
            elif spec["pose"] in ("suelo", "banco"):
                shoot(str(out / f"{key}{tag}.png"), (3.6, 0.15, 1.35), (0, 0.05, 0.45))
                shoot(str(out / f"{key}{tag}-lado.png"), (0.2, -3.4, 1.15), (0, 0.1, 0.55))
            else:
                shoot(str(out / f"{key}{tag}.png"), (0.15, -3.15, 1.15), (0, 0.05, 0.85))
                shoot(str(out / f"{key}{tag}-lado.png"), (2.8, -0.35, 1.05), (0, 0.05, 0.8))
        print("PREVIEW", key, flush=True)
    for obj in ex.SHARED["props"]:
        obj.hide_render = False


def build_all(ex):
    specs.assert_catalog()
    done = []
    started = time.time()
    chosen = os.environ.get("CATALOG_ONLY", "")
    selected = [row for row in specs.SPECS if not chosen or row["key"] in chosen.split(",")]
    for spec in selected:
        stamp = time.time()
        try:
            build_one(ex, spec)
            done.append(spec)
            print("CATALOG_OK", spec["key"], f"{time.time() - stamp:.1f}s", flush=True)
        except Exception:
            traceback.print_exc()
            print("CATALOG_FAIL", spec["key"], flush=True)
    if not chosen:
        clips = [specs.clip_row(row) for row in specs.ORIGINALS]
        clips.extend(specs.clip_row(row) for row in done)
        specs.emit(clips)
    try:
        preview(ex, done)
    except Exception:
        traceback.print_exc()
        print("PREVIEW_FAIL", flush=True)
    for obj in ex.SHARED["props"]:
        obj.hide_render = False
    print("CATALOG_DONE", len(done), "/", len(specs.SPECS), f"{time.time() - started:.0f}s", flush=True)
