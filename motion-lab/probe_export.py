"""Inspecciona un GLB exportado: jerarquía, acciones y pistas NLA."""
import bpy
import sys

path = sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)

for obj in bpy.data.objects:
    parent = obj.parent.name if obj.parent else "-"
    print(f"OBJ {obj.name} tipo={obj.type} padre={parent} hueso={obj.parent_bone or '-'}")
    ad = obj.animation_data
    if not ad:
        continue
    print(f"   accion activa: {ad.action.name if ad.action else '-'}")
    for track in ad.nla_tracks:
        strips = [(s.action.name if s.action else "-", s.frame_start, s.frame_end) for s in track.strips]
        print(f"   pista {track.name} mute={track.mute} strips={strips}")
