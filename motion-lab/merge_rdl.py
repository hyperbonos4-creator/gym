"""Mete el peso muerto rumano y los dos jalones en el atlas."""

import bpy

ESTUDIO = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
OUT = ESTUDIO
CLIPS = (
    ("jalon-abierto", "Jalón polea agarre abierto", r"C:\Users\Hide\Desktop\Gym\motion-lab\out\jalon-abierto.glb", "asiento_jalon-abierto"),
    ("jalon-cerrado", "Jalón polea agarre cerrado", r"C:\Users\Hide\Desktop\Gym\motion-lab\out\jalon-cerrado.glb", "asiento_jalon-cerrado"),
    ("peso-muerto-rumano", "Peso muerto rumano con barra", r"C:\Users\Hide\Desktop\Gym\motion-lab\out\rdl.glb", None),
)


def take(label, src, bar_name, seat_name):
    prop = f"Prop {label}"
    for name in (label, prop):
        action = bpy.data.actions.get(name)
        if action:
            action.use_fake_user = False
            bpy.data.actions.remove(action)
    old = bpy.data.objects.get(bar_name)
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    if seat_name:
        old_seat = bpy.data.objects.get(seat_name)
        if old_seat:
            bpy.data.objects.remove(old_seat, do_unlink=True)
    known = {obj.name for obj in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=src)
    fresh = [obj for obj in bpy.data.objects if obj.name not in known]
    print("FRESH", label, [obj.name for obj in fresh], flush=True)
    studio = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE" and obj.name not in {item.name for item in fresh})
    incoming = next(obj for obj in fresh if obj.type == "ARMATURE")
    if incoming.animation_data and incoming.animation_data.action:
        action = incoming.animation_data.action
        action.name = label
        action.use_fake_user = True
        print("CLIP", action.name, flush=True)
    kept = []
    for obj in fresh:
        if obj.type != "MESH":
            continue
        skinned = any(mod.type == "ARMATURE" for mod in obj.modifiers)
        if obj.name.startswith(bar_name):
            obj.name = bar_name
            if obj.animation_data and obj.animation_data.action:
                obj.animation_data.action.name = prop
                obj.animation_data.action.use_fake_user = True
            kept.append(obj)
            print("PROP", obj.name, flush=True)
        elif seat_name and not skinned and ("asiento" in obj.name.lower() or obj.name.startswith("Cube")):
            obj.name = seat_name
            kept.append(obj)
            print("ASIENTO", obj.name, flush=True)
    for obj in list(fresh):
        if obj in kept:
            continue
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    return studio


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=ESTUDIO)
    print("ANTES", len(bpy.data.actions), flush=True)
    studio = None
    for key, label, src, seat in CLIPS:
        studio = take(label, src, f"bar_{key}", seat)
    print("DESPUES", len(bpy.data.actions), flush=True)
    need = [
        "bar_jalon-abierto", "asiento_jalon-abierto",
        "bar_jalon-cerrado", "asiento_jalon-cerrado",
        "bar_peso-muerto-rumano", "asiento", "poste_polea",
    ]
    print("FALTAN", [name for name in need if bpy.data.objects.get(name) is None] or "-", flush=True)
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = studio
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


if __name__ == "__main__":
    main()
