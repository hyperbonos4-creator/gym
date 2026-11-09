import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb")
names = sorted(obj.name for obj in bpy.data.objects if "asiento" in obj.name or "jalon" in obj.name or obj.type == "ARMATURE")
print("ACCIONES", len(bpy.data.actions), flush=True)
print("NOMBRES", names, flush=True)
