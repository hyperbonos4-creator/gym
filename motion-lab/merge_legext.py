"""Mete la extensión de pierna nueva en el GLB del atlas, sin tocar el asiento compartido."""

import bpy

ESTUDIO = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
LEG = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\legext.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"

KEEP_PROPS = {"bar_extension-pierna", "maquina_extension", "rodillo_extension"}
OLD_ACTIONS = (
    "Extensión de pierna en máquina",
    "Prop Extensión de pierna en máquina",
    "Rodillo extensión",
)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=ESTUDIO)
    studio = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    print("ANTES", len(bpy.data.actions), flush=True)
    for name in OLD_ACTIONS:
        action = bpy.data.actions.get(name)
        if action:
            action.use_fake_user = False
            bpy.data.actions.remove(action)
    for obj in list(bpy.data.objects):
        if obj.name in KEEP_PROPS:
            bpy.data.objects.remove(obj, do_unlink=True)
    known = {obj.name for obj in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=LEG)
    fresh = [obj for obj in bpy.data.objects if obj.name not in known]
    incoming = next(obj for obj in fresh if obj.type == "ARMATURE")
    if incoming.animation_data and incoming.animation_data.action:
        action = incoming.animation_data.action
        action.name = "Extensión de pierna en máquina"
        action.use_fake_user = True
        studio.animation_data_create()
        studio.animation_data.action = action
        print("CLIP", action.name, flush=True)
    for obj in fresh:
        if obj.type != "MESH" or obj.name in KEEP_PROPS:
            continue
        skinned = any(mod.type == "ARMATURE" for mod in obj.modifiers)
        if skinned or obj == incoming:
            bpy.data.objects.remove(obj, do_unlink=True)
    if incoming.name in bpy.data.objects:
        bpy.data.objects.remove(incoming, do_unlink=True)
    for obj in bpy.data.objects:
        if obj.name == "bar_extension-pierna" and obj.animation_data and obj.animation_data.action:
            obj.animation_data.action.name = "Prop Extensión de pierna en máquina"
            obj.animation_data.action.use_fake_user = True
            print("PROP", obj.name, flush=True)
        if obj.name == "rodillo_extension" and obj.animation_data and obj.animation_data.action:
            obj.animation_data.action.name = "Rodillo extensión"
            obj.animation_data.action.use_fake_user = True
            print("RODILLO", obj.name, flush=True)
    missing = [name for name in KEEP_PROPS if bpy.data.objects.get(name) is None]
    print("FALTAN", missing or "-", flush=True)
    print("ASIENTO", "si" if bpy.data.objects.get("asiento") else "no", flush=True)
    print("DESPUES", len(bpy.data.actions), flush=True)
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
