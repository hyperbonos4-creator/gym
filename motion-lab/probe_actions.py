import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb")
names = sorted(action.name for action in bpy.data.actions)
need = (
    "Jalón polea agarre abierto",
    "Prop Jalón polea agarre abierto",
    "Jalón polea agarre cerrado",
    "Prop Jalón polea agarre cerrado",
    "Peso muerto rumano con barra",
    "Prop Peso muerto rumano con barra",
)
for name in need:
    print("TIENE" if name in names else "NO", name, flush=True)
extra = [name for name in names if "001" in name or "mano" in name or "polo" in name or "pie_" in name]
print("EXTRAS", extra, flush=True)
print("TOTAL", len(names), flush=True)
