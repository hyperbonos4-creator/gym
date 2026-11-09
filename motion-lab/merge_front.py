"""Mete la elevación frontal nueva en el GLB del atlas, sin regenerar el resto."""

import bpy

ESTUDIO = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
FRONT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\front-elevacion.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
LABEL = "Elevación frontal con mancuernas"
BELLS = ("db_elevacion-frontal_l", "db_elevacion-frontal_r")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=ESTUDIO)
    studio = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
    print("ANTES", len(bpy.data.actions), flush=True)
    old = bpy.data.actions.get(LABEL)
    if old:
        old.use_fake_user = False
        bpy.data.actions.remove(old)
    for name in BELLS:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    known = {obj.name for obj in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=FRONT)
    fresh = [obj for obj in bpy.data.objects if obj.name not in known]
    incoming = next(obj for obj in fresh if obj.type == "ARMATURE")
    if incoming.animation_data and incoming.animation_data.action:
        action = incoming.animation_data.action
        action.name = LABEL
        action.use_fake_user = True
        studio.animation_data_create()
        studio.animation_data.action = action
        slots = list(getattr(action, "slots", []) or [])
        if slots and hasattr(studio.animation_data, "action_slot"):
            studio.animation_data.action_slot = slots[0]
        if incoming.animation_data and hasattr(incoming.animation_data, "action_slot") and slots:
            incoming.animation_data.action_slot = slots[0]
        slot = slots[0].identifier if slots and hasattr(slots[0], "identifier") else "-"
        print("CLIP", action.name, "slot", slot, flush=True)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    for obj in fresh:
        if obj.type != "MESH" or obj.name not in BELLS:
            continue
        bone = obj.parent_bone
        world = obj.matrix_world.copy()
        obj.parent = studio
        obj.parent_type = "BONE"
        obj.parent_bone = bone
        obj.matrix_world = world
        print("PROP", obj.name, bone, flush=True)
    for obj in list(fresh):
        if obj.type == "MESH" and obj.name in BELLS:
            continue
        if obj.name in bpy.data.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    missing = [name for name in BELLS if bpy.data.objects.get(name) is None]
    print("FALTAN", missing or "-", flush=True)
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    for name in BELLS:
        bell = bpy.data.objects[name]
        hand = studio.pose.bones[bell.parent_bone]
        gap = (bell.matrix_world.translation - (studio.matrix_world @ hand.matrix).translation).length
        print("GRIP", name, round(gap, 3), flush=True)
    print("DESPUES", len(bpy.data.actions), flush=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.context.view_layer.objects.active = studio
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
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
