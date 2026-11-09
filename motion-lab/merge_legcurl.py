"""Mete la flexión femoral nueva en el GLB del atlas."""

import bpy

ESTUDIO = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
CURL = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\legcurl.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"

KEEP_PROPS = {"banco_femoral", "rodillo_femoral"}
OLD_ACTIONS = ("Flexión femoral en máquina", "Rodillo femoral")


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
    bpy.ops.import_scene.gltf(filepath=CURL)
    fresh = [obj for obj in bpy.data.objects if obj.name not in known]
    incoming = next(obj for obj in fresh if obj.type == "ARMATURE")
    for obj in fresh:
        if obj.type != "MESH" or obj.name in KEEP_PROPS:
            continue
        skinned = any(mod.type == "ARMATURE" for mod in obj.modifiers)
        if skinned or obj == incoming:
            bpy.data.objects.remove(obj, do_unlink=True)
    if incoming.name in bpy.data.objects:
        bpy.data.objects.remove(incoming, do_unlink=True)
    for obj in bpy.data.objects:
        if obj.name == "rodillo_femoral" and obj.animation_data and obj.animation_data.action:
            obj.animation_data.action.name = "Rodillo femoral"
            obj.animation_data.action.use_fake_user = True
            print("RODILLO", obj.name, flush=True)
    missing = [name for name in KEEP_PROPS if bpy.data.objects.get(name) is None]
    names = sorted(action.name for action in bpy.data.actions if "femoral" in action.name.lower() or "Femoral" in action.name)
    print("FALTAN", missing or "-", flush=True)
    print("ACCIONES", names, flush=True)
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
