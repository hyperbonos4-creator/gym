"""Mira si las curvas del jalón cambian entre el inicio y el pecho."""

import bpy

FILES = [
    r"C:\Users\Hide\Desktop\Gym\motion-lab\out\jalon-abierto.glb",
    r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb",
]
LABEL = "Jalón polea agarre abierto"
PROP = f"Prop {LABEL}"


def curves(action):
    found = list(getattr(action, "fcurves", []) or [])
    layers = getattr(action, "layers", None)
    if layers:
        for layer in layers:
            for strip in getattr(layer, "strips", []) or []:
                bags = getattr(strip, "channelbags", None) or []
                for bag in bags:
                    found.extend(list(getattr(bag, "fcurves", []) or []))
    return found


def dump(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    print("FILE", path.split("\\")[-1], flush=True)
    for name in (LABEL, PROP):
        action = bpy.data.actions.get(name)
        if action is None:
            print("  FALTA", name, flush=True)
            continue
        fcs = curves(action)
        moving = 0
        sample = None
        for fc in fcs:
            a = fc.evaluate(1)
            b = fc.evaluate(73)
            if abs(a - b) > 0.002:
                moving += 1
                if sample is None and "hand_l" in fc.data_path and fc.array_index == 1:
                    sample = (fc.data_path, round(a, 3), round(b, 3))
        print("  ", name, "curvas", len(fcs), "mueven", moving, "mano", sample, flush=True)


for path in FILES:
    dump(path)
