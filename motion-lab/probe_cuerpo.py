import bpy
SRC = r"C:\Users\Hide\Desktop\Gym\gym-web\public\models\motion-studio\estudio.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
cuerpo = next(o for o in bpy.data.objects if o.type == "MESH" and o.name.lower().startswith("cuerpo"))
print("CUERPO", cuerpo.name, flush=True)
print("parent", cuerpo.parent.name if cuerpo.parent else None, "ptype", cuerpo.parent_type, flush=True)
print("matrix_world", [round(v, 4) for row in cuerpo.matrix_world for v in row], flush=True)
print("matrix_local", [round(v, 4) for row in cuerpo.matrix_local for v in row], flush=True)
print("mpi", [round(v, 4) for row in cuerpo.matrix_parent_inverse for v in row], flush=True)
for m in cuerpo.modifiers:
    print("MOD", m.type, m.name, getattr(m, "object", None).name if getattr(m, "object", None) else "-", flush=True)
print("vgroups", len(cuerpo.vertex_groups), [g.name for g in cuerpo.vertex_groups][:6], flush=True)
# superficie meshes: how are they parented? (they animate fine already)
sup = next((o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith("superficie_")), None)
if sup:
    print("SUP", sup.name, "parent", sup.parent.name if sup.parent else None, "ptype", sup.parent_type, flush=True)
    print("SUP mw", [round(v, 4) for row in sup.matrix_world for v in row], flush=True)
    print("SUP mpi", [round(v, 4) for row in sup.matrix_parent_inverse for v in row], flush=True)
    for m in sup.modifiers:
        print("SUP MOD", m.type, getattr(m, "object", None).name if getattr(m, "object", None) else "-", flush=True)
