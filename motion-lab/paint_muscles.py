"""Marca en la malla qué zona es pecho, hombro frontal y tríceps.

El visor enciende en rojo solo las zonas del ejercicio. No copia el video.
"""

import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio.glb"
OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out\estudio-musculo.glb"
PECHO = 1
HOMBRO = 2
TRICEPS = 4

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
body = next(obj for obj in bpy.data.objects if obj.type == "MESH" and any(mod.type == "ARMATURE" for mod in obj.modifiers))
print("ANTES", len(bpy.data.actions), flush=True)

bones = {}
for name in ("spine_03", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r"):
    bone = arm.data.bones[name]
    bones[name] = (body.vertex_groups[name].index, (arm.matrix_world @ bone.matrix_local).inverted())

flags = [0] * len(body.data.vertices)
for vert in body.data.vertices:
    weights = {el.group: el.weight for el in vert.groups}
    world = body.matrix_world @ vert.co
    for name, (index, inv) in bones.items():
        if weights.get(index, 0.0) < 0.22:
            continue
        local = inv @ world
        if name == "spine_03" and local.z > 0.015 and local.y > 0.06 and abs(local.x) < 0.16:
            flags[vert.index] |= PECHO
        elif name.startswith("clavicle") and local.z > 0.01:
            flags[vert.index] |= HOMBRO
        elif name.startswith("upperarm") and local.z > 0.012 and local.y < 0.12:
            flags[vert.index] |= HOMBRO
        elif name.startswith("upperarm") and local.z < -0.012 and 0.02 < local.y < 0.24:
            flags[vert.index] |= TRICEPS

old = body.data.color_attributes.get("Musculo")
if old is not None:
    body.data.color_attributes.remove(old)
attr = body.data.color_attributes.new("Musculo", "BYTE_COLOR", "CORNER")
# El color no se ve tal cual: el rojo es pecho, el verde es hombro y el azul es tríceps.
loops = body.data.loops
for loop_index, loop in enumerate(loops):
    value = flags[loop.vertex_index]
    attr.data[loop_index].color = (
        1.0 if value & PECHO else 0.0,
        1.0 if value & HOMBRO else 0.0,
        1.0 if value & TRICEPS else 0.0,
        1.0,
    )
body.data.color_attributes.active_color = attr
material = body.data.materials[0]
material.use_nodes = True
tree = material.node_tree
color_node = tree.nodes.new("ShaderNodeVertexColor")
color_node.layer_name = "Musculo"
bsdf = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
tree.links.new(color_node.outputs["Color"], bsdf.inputs["Base Color"])
counts = {PECHO: 0, HOMBRO: 0, TRICEPS: 0}
for value in flags:
    for bit in counts:
        if value & bit:
            counts[bit] += 1
print("ZONAS", counts, "marcados", sum(1 for value in flags if value), flush=True)

if bpy.context.object and bpy.context.object.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_skins=True,
    export_yup=True,
    export_attributes=True,
)
print("GLB", OUT, flush=True)
