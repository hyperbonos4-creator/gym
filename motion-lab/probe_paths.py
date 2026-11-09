"""Lista las curvas del jalón que sí se mueven."""

import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"C:\Users\Hide\Desktop\Gym\motion-lab\out\jalon-abierto.glb")


def curves(action):
    found = list(getattr(action, "fcurves", []) or [])
    for layer in getattr(action, "layers", []) or []:
        for strip in getattr(layer, "strips", []) or []:
            for bag in getattr(strip, "channelbags", []) or []:
                found.extend(list(getattr(bag, "fcurves", []) or []))
    return found


for name in ("Jalón polea agarre abierto", "Prop Jalón polea agarre abierto"):
    action = bpy.data.actions[name]
    print("==", name, flush=True)
    for fc in curves(action):
        a = fc.evaluate(1)
        b = fc.evaluate(73)
        if abs(a - b) > 0.002:
            print(f"  {fc.data_path}[{fc.array_index}] {a:.3f} -> {b:.3f}", flush=True)
