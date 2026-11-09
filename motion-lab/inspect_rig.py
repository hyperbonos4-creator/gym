import bpy
from mathutils import Vector

SRC = r"C:\Users\Hide\Desktop\Gym\motion-lab\samples\human-base-rigged.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

print("OBJECTS")
for obj in bpy.data.objects:
    print(f"  {obj.type:10} {obj.name} parent={obj.parent.name if obj.parent else '-'}")

arm = next(obj for obj in bpy.data.objects if obj.type == "ARMATURE")
print("ARMATURE", arm.name, "location", tuple(round(v, 4) for v in arm.location))
print("BONES", len(arm.data.bones))
want = {
    "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head",
    "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l",
    "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r",
    "thigh_l", "calf_l", "foot_l", "ball_l",
    "thigh_r", "calf_r", "foot_r", "ball_r",
}
for bone in arm.data.bones:
    if bone.name not in want:
        continue
    head = bone.head_local
    tail = bone.tail_local
    y = (tail - head).normalized()
    print(
        f"{bone.name:12} parent={(bone.parent.name if bone.parent else '-'):12} "
        f"head=({head.x:7.3f},{head.y:7.3f},{head.z:7.3f}) "
        f"tail=({tail.x:7.3f},{tail.y:7.3f},{tail.z:7.3f}) "
        f"dir=({y.x:6.3f},{y.y:6.3f},{y.z:6.3f}) len={bone.length:.3f}"
    )

print("MESHES")
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    verts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    if not verts:
        continue
    xs = [v.x for v in verts]
    ys = [v.y for v in verts]
    zs = [v.z for v in verts]
    print(
        f"  {obj.name} verts={len(verts)} "
        f"x={min(xs):.3f}..{max(xs):.3f} y={min(ys):.3f}..{max(ys):.3f} z={min(zs):.3f}..{max(zs):.3f}"
    )
