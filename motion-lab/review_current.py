"""Renderiza los GLB exportados: es lo que el navegador va a mostrar."""
import bpy
from math import radians

OUT = r"C:\Users\Hide\Desktop\Gym\motion-lab\out"
FILES = {
    "sentadilla": OUT + r"\sentadilla-barra.glb",
    "curl": OUT + r"\curl-mancuernas.glb",
    "press": OUT + r"\press-banca.glb",
}
VIEWS = {
    "sentadilla": [
        ("frente", (0, -3.4, 1.4), (0, 0, 0.9)),
        ("perfil", (3.4, -0.1, 1.4), (0, 0, 0.9)),
        ("pies", (0.5, -1.6, 0.5), (0, 0, 0.15)),
    ],
    "curl": [
        ("frente", (0, -3.2, 1.4), (0, 0, 0.95)),
        ("perfil", (3.1, 0.0, 1.4), (0, 0, 0.95)),
        ("pies", (0.5, -1.6, 0.5), (0, 0, 0.15)),
    ],
    "press": [
        ("lado", (3.2, 0.75, 0.9), (0, 0.75, 0.5)),
        ("frente", (0.3, -2.4, 1.5), (0, 0.75, 0.5)),
        ("pies", (1.1, -0.6, 0.55), (0, 0.44, 0.1)),
    ],
}

for key, path in FILES.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    # El importador deja las pistas NLA silenciadas: sin esto todo sale en reposo.
    for obj in bpy.data.objects:
        if obj.animation_data:
            for track in obj.animation_data.nla_tracks:
                track.mute = False
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 720
    scene.render.resolution_y = 720
    scene.render.fps = 24
    world = bpy.data.worlds.new("fondo")
    scene.world = world
    world.color = (0.07, 0.09, 0.12)
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 42
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    aim = bpy.data.objects.new("Aim", None)
    bpy.context.collection.objects.link(aim)
    track = cam.constraints.new("TRACK_TO")
    track.target = aim
    track.track_axis = "TRACK_NEGATIVE_Z"
    track.up_axis = "UP_Y"
    light_data = bpy.data.lights.new("Key", "AREA")
    light_data.energy = 400
    light_data.size = 3
    light = bpy.data.objects.new("Key", light_data)
    bpy.context.collection.objects.link(light)
    light.location = (1.4, -2.2, 2.6)
    print("FILE", key, "acciones", [a.name for a in bpy.data.actions])
    for frame in (1, 12, 24, 36):
        for tag, loc, target in VIEWS[key]:
            cam.location = loc
            aim.location = target
            scene.frame_set(frame)
            scene.render.filepath = OUT + rf"\rev-{key}-f{frame:02d}-{tag}.png"
            bpy.ops.render.render(write_still=True)
