"""Ficha de cada ciclo del catálogo. No importa Blender: también escribe el manifiesto de la web."""

import json
from pathlib import Path

TS_PATH = Path(r"C:\Users\Hide\Desktop\Gym\gym-web\lib\motion-studio\clips.generated.ts")
NOTE = " No certifica la técnica."

ORIGINALS = [
    {
        "key": "sentadilla",
        "label": "Sentadilla con barra",
        "pose": "depie",
        "note": "Maniquí CC0, ciclo propio de 5 s: 3 s de bajada y 1,5 s de subida. La barra va en la espalda alta. No certifica la técnica.",
        "play": ["Sentadilla con barra", "Barra sentadilla"],
        "show": ["barra_sentadilla"],
    },
    {
        "key": "curl",
        "label": "Curl con mancuernas",
        "pose": "depie",
        "note": "Maniquí CC0, ciclo propio de 5 s. Curl supino: las palmas miran hacia arriba y los codos se quedan junto al torso. No certifica la técnica.",
        "play": ["Curl con mancuernas"],
        "show": ["mancuerna_l", "mancuerna_r"],
    },
    {
        "key": "press",
        "label": "Press de banca",
        "pose": "banco",
        "note": "Maniquí CC0, ciclo propio de 5 s. La barra baja al pecho y sube sobre los hombros. No certifica la técnica.",
        "play": ["Press de banca", "Barra press"],
        "show": ["barra_press", "banco"],
    },
]


def move(key, label, pose, note, body, arms, grip, prop, **extra):
    """Arma la ficha y los nombres de mallas que el visor tiene que mostrar."""
    gear = list(extra.get("gear", []))
    show = []
    play = [label]
    if prop == "bells":
        if extra.get("unilateral"):
            show.append(f"db_{key}")
        else:
            show.extend((f"db_{key}_l", f"db_{key}_r"))
    elif prop == "one":
        show.append(f"db_{key}")
        play.append(f"Prop {label}")
    elif prop == "goblet":
        show.append(f"db_{key}")
        play.append(f"Prop {label}")
    elif prop in ("bar", "handle"):
        show.append(f"bar_{key}")
        play.append(f"Prop {label}")
    show.extend(gear)
    if "plataforma_prensa" in gear:
        play.append("Plataforma prensa")
    if "rodillo_femoral" in gear:
        play.append("Rodillo femoral")
    if "rodillo_extension" in gear:
        play.append("Rodillo extensión")
    row = {
        "key": key,
        "label": label,
        "pose": pose,
        "note": note.rstrip(".") + "." + NOTE,
        "play": play,
        "show": show,
        "body": body,
        "arms": arms,
        "grip": grip,
        "prop": prop,
    }
    row.update(extra)
    return row


SPECS = [
    move("sentadilla-goblet", "Sentadilla goblet", "depie",
         "La mancuerna se sostiene al pecho mientras las rodillas bajan",
         "squat", "chest", "supino", "goblet"),
    move("prensa-piernas", "Prensa de piernas", "suelo",
         "Acostado, los pies empujan la plataforma y las rodillas se extienden",
         "legpress", "hips", "prono", "handle", gear=["banco_prensa", "plataforma_prensa"]),
    move("sentadilla-bulgara", "Sentadilla búlgara", "depie",
         "El pie de atrás queda apoyado y la rodilla de adelante baja",
         "bulgarian", "hips", "neutro", "none", gear=["banco_bulgaro"]),
    move("zancadas", "Zancada hacia atrás", "depie",
         "Un pie va atrás y el cuerpo baja entre las dos piernas",
         "lunge", "hang", "neutro", "bells"),
    move("peso-muerto-rumano-mancuernas", "Peso muerto rumano con mancuernas", "depie",
         "La cadera va atrás y las mancuernas bajan pegadas a las piernas",
         "hinge", "hang", "neutro", "bells"),
    move("peso-muerto-rumano", "Peso muerto rumano con barra", "depie",
         "La cadera va atrás y la barra baja por delante de los muslos",
         "hinge", "hang", "barra", "bar"),
    move("hip-thrust", "Hip thrust", "banco",
         "Los hombros se apoyan y la cadera sube con la barra encima",
         "bridge", "hips", "barra", "bar", gear=["banco_thrust"]),
    move("femoral-maquina", "Flexión femoral en máquina", "suelo",
         "Boca abajo: la cadera queda en el banco y los talones suben hacia los glúteos",
         "legcurl", "floor", "prono", "none", gear=["banco_femoral", "rodillo_femoral"]),
    move("extension-pierna", "Extensión de pierna en máquina", "sentado",
         "Sentado, las dos rodillas se estiran juntas hacia el frente",
         "legext", "hips", "prono", "handle", length=0.48,
         gear=["maquina_extension", "rodillo_extension"]),
    move("elevacion-pantorrilla", "Elevación de pantorrilla", "depie",
         "Los talones suben sobre el escalón y bajan otra vez",
         "calf", "hang", "neutro", "none", gear=["escalon"]),
    move("press-banca-mancuernas", "Press de banca con mancuernas", "banco",
         "Acostado en el banco, las mancuernas suben desde el pecho",
         "lie", "press", "neutro", "bells", gear=["banco"]),
    move("press-inclinado", "Press inclinado con mancuernas", "banco",
         "En el banco inclinado, las mancuernas suben desde el pecho alto",
         "incline", "press", "neutro", "bells", gear=["banco_inclinado"]),
    move("flexiones", "Flexiones de brazos", "suelo",
         "El cuerpo baja recto y los codos se doblan hasta el suelo",
         "pushup", "fixed", "abierta", "none"),
    move("press-pecho-maquina", "Press de pecho en máquina", "sentado",
         "Sentado, los brazos empujan hacia el frente",
         "sit", "press", "prono", "handle", gear=["asiento", "poste_polea"]),
    move("remo-mancuerna", "Remo con mancuerna a una mano", "depie",
         "El torso se inclina y un brazo lleva la mancuerna hacia la cadera",
         "hinge", "row", "neutro", "bells", unilateral=True, hinge_anim=False, gear=["banco_remo"]),
    move("remo-polea", "Remo sentado en polea", "sentado",
         "Sentado, los brazos traen el agarre hacia el abdomen",
         "sit", "row", "prono", "handle", gear=["asiento", "poste_polea"]),
    move("remo-pecho-apoyado", "Remo con pecho apoyado", "depie",
         "El pecho queda apoyado y los dos brazos reman hacia la cadera",
         "hinge", "row", "neutro", "bells", hinge_anim=False, gear=["banco_remo"]),
    move("jalon-abierto", "Jalón polea agarre abierto", "sentado",
         "Sentado, la barra baja desde arriba hasta el pecho",
         "sit", "pulldown", "barra", "bar", width=0.42, gear=["asiento_jalon-abierto", "poste_polea"]),
    move("dominada-asistida", "Dominada asistida", "depie",
         "Las manos quedan en la barra y el cuerpo sube con ayuda de los pies",
         "pullup", "fixed", "barra", "bar", width=0.34, rise=0.12, gear=["cajon_asistencia"]),
    move("face-pull", "Face pull en polea", "depie",
         "Los codos suben y las manos llegan a la altura de la cara",
         "stand", "face", "neutro", "handle", gear=["poste_polea"]),
    move("press-hombros-mancuernas", "Press de hombros con mancuernas", "depie",
         "Las mancuernas salen de los hombros y terminan arriba",
         "stand", "ohp", "supino", "bells"),
    move("elevacion-lateral", "Elevación lateral", "depie",
         "Los brazos suben por los lados hasta la altura de los hombros",
         "stand", "lateral", "prono", "bells"),
    move("pajaros", "Pájaros con mancuernas", "depie",
         "Con el torso inclinado, los brazos se abren hacia los lados",
         "hinge", "fly_rear", "prono", "bells", hinge_anim=False),
    move("curl-martillo", "Curl martillo", "depie",
         "Los codos quedan quietos y los pulgares miran hacia adelante",
         "stand", "curl", "neutro", "bells"),
    move("extension-triceps", "Extensión de tríceps en polea", "depie",
         "Los codos pegados al torso empujan el agarre hacia abajo",
         "stand", "pushdown", "prono", "handle", gear=["poste_polea"]),
    move("extension-triceps-cabeza", "Extensión de tríceps sobre la cabeza", "depie",
         "La mancuerna pasa por detrás de la cabeza y sube con los codos altos",
         "stand", "overhead", "supino", "one"),
    move("plancha", "Plancha", "suelo",
         "Manos y pies en el suelo, el cuerpo se mantiene recto",
         "plank", "fixed", "abierta", "none"),
    move("plancha-lateral", "Plancha lateral", "suelo",
         "El cuerpo queda de lado, apoyado en un antebrazo",
         "side", "fixed", "abierta", "none"),
    move("dead-bug", "Dead bug", "suelo",
         "Acostado, un brazo y la pierna contraria se alejan y vuelven",
         "deadbug", "deadbug", "supino", "none"),
    move("pallof", "Pallof press", "depie",
         "Las dos manos empujan el agarre al frente y el torso no gira",
         "stand", "pallof", "neutro", "handle", gear=["poste_polea"]),
    move("crunch-polea", "Crunch en polea", "sentado",
         "De rodillas, el torso se enrolla y las manos bajan por delante",
         "crunch", "crunch", "prono", "handle", gear=["poste_polea"]),
    move("paseo-granjero", "Paseo del granjero", "depie",
         "Las mancuernas cuelgan a los lados y el cuerpo da un paso",
         "farmer", "hang", "neutro", "bells"),
    move("jalon-cerrado", "Jalón polea agarre cerrado", "sentado",
         "Sentado, el agarre estrecho baja desde arriba hasta el pecho",
         "sit", "pulldown", "barra", "bar", width=0.14, gear=["asiento_jalon-cerrado", "poste_polea"]),
    move("remo-barra", "Remo con barra", "depie",
         "El torso se inclina y la barra sube hacia el abdomen",
         "hinge", "row", "barra", "bar", hinge_anim=False),
    move("press-militar", "Press militar", "depie",
         "La barra sale de los hombros y termina arriba, con el cuerpo quieto",
         "stand", "ohp", "barra", "bar", width=0.2),
    move("fondos", "Fondos en paralelas", "depie",
         "El cuerpo baja entre las barras y los codos van hacia atrás",
         "dip", "fixed", "prono", "none", gear=["paralelas"]),
    move("aperturas", "Aperturas con mancuernas", "banco",
         "Acostado, los brazos se abren a los lados y vuelven sobre el pecho",
         "lie", "fly", "supino", "bells", gear=["banco"]),
    move("elevacion-frontal", "Elevación frontal con mancuernas", "depie",
         "Los brazos suben por delante hasta la altura de los hombros",
         "stand", "front", "prono", "bells"),
    move("dominadas-supino", "Dominadas agarre supino", "depie",
         "Agarre supino al ancho de hombros: el cuerpo cuelga, los codos bajan hacia las costillas y el mentón supera la barra",
         "pullup", "fixed", "chin", "bar", width=0.20, rise=0.36,
         pullup_bar=True, gear=["estructura_dominadas"]),
    move("encogimiento-hombros", "Encogimiento de hombros", "depie",
         "Los brazos quedan largos y los hombros suben hacia las orejas",
         "shrug", "hang", "neutro", "bells"),
]

EXPECTED = {
    "sentadilla-goblet", "prensa-piernas", "sentadilla-bulgara", "zancadas",
    "peso-muerto-rumano-mancuernas", "peso-muerto-rumano", "hip-thrust",
    "femoral-maquina", "extension-pierna", "elevacion-pantorrilla",
    "press-banca-mancuernas", "press-inclinado", "flexiones", "press-pecho-maquina",
    "remo-mancuerna", "remo-polea", "remo-pecho-apoyado", "jalon-abierto",
    "dominada-asistida", "face-pull", "press-hombros-mancuernas", "elevacion-lateral",
    "pajaros", "curl-martillo", "extension-triceps", "extension-triceps-cabeza",
    "plancha", "plancha-lateral", "dead-bug", "pallof", "crunch-polea", "paseo-granjero",
    "jalon-cerrado", "remo-barra", "press-militar", "fondos", "aperturas",
    "elevacion-frontal", "dominadas-supino", "encogimiento-hombros",
}


def clip_row(row):
    return {
        "key": row["key"],
        "label": row["label"],
        "pose": row["pose"],
        "note": row["note"],
        "play": list(row["play"]),
        "show": list(row["show"]),
    }


def emit(clips, path=TS_PATH):
    """Escribe la lista que el estudio usa para reproducir cada ciclo."""
    body = ["/* Generado por motion-lab/catalog_specs.py. No editar a mano. */"]
    body.append('export type StudioPose = "depie" | "suelo" | "banco" | "sentado";')
    body.append("")
    body.append("export type GeneratedClip = {")
    body.append("  key: string;")
    body.append("  label: string;")
    body.append("  pose: StudioPose;")
    body.append("  note: string;")
    body.append("  play: string[];")
    body.append("  show: string[];")
    body.append("};")
    body.append("")
    body.append("export const GENERATED_CLIPS: GeneratedClip[] = [")
    for row in clips:
        body.append("  {")
        for field in ("key", "label", "pose", "note"):
            body.append(f"    {field}: {json.dumps(row[field], ensure_ascii=False)},")
        body.append(f"    play: {json.dumps(row['play'], ensure_ascii=False)},")
        body.append(f"    show: {json.dumps(row['show'], ensure_ascii=False)},")
        body.append("  },")
    body.append("];")
    body.append("")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(body), encoding="utf-8")
    print("TS", path, len(clips))


def assert_catalog():
    keys = [row["key"] for row in SPECS]
    if len(keys) != len(set(keys)):
        raise SystemExit("hay claves repetidas")
    if set(keys) != EXPECTED:
        raise SystemExit(f"faltan {EXPECTED - set(keys)} sobran {set(keys) - EXPECTED}")
    poses = {"depie", "suelo", "banco", "sentado"}
    for row in SPECS:
        if row["pose"] not in poses:
            raise SystemExit(row["key"])


if __name__ == "__main__":
    assert_catalog()
    emit([clip_row(row) for row in ORIGINALS] + [clip_row(row) for row in SPECS])
