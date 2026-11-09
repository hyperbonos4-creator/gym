"""Voces de la campaña. Cada frase cae sobre la pantalla que le corresponde."""
import asyncio, os
import edge_tts

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "voces")
VOICE = "es-CO-SalomeNeural"

# (archivo, texto)
LINES = [
    ("m1", "El control de tu gimnasio empieza en la entrada."),
    ("m2", "Con VISIONYX, tus socios pueden completar su enrolamiento a distancia."),
    ("m3", "Gestiona el acceso mediante reconocimiento facial."),
    ("m4", "Y consulta el historial de entradas desde tu plataforma."),
    ("m5", "Organiza tus socios y sus membresías en el mismo sistema."),
    ("m6", "Gestiona tus ventas."),
    ("m7", "Consulta la operación del día."),
    ("m8", "Organiza las rutinas de tus clientes."),
    ("m9", "El maniquí muestra el movimiento del ejercicio."),
    ("m10", "VISIONYX. Tu gimnasio, bajo control. Solicita una demostración."),
    ("a1", "¿Quieres modernizar el acceso de tu gimnasio?"),
    ("a2", "VISIONYX reconoce a la persona autorizada y deja el intento en el historial."),
    ("a3", "Solicita una demostración."),
    ("b1", "El enrolamiento de tus socios puede empezar a distancia."),
    ("b2", "Recepción crea la ficha y envía el enlace. El acceso sigue bloqueado hasta el rostro y el plan."),
    ("b3", "VISIONYX. Solicita una demostración."),
    ("c1", "No alcanza con controlar la entrada."),
    ("c2", "También organizas socios, membresías, la caja y las rutinas."),
    ("c3", "Todo en la misma plataforma. VISIONYX. Solicita una demostración."),
]

async def main():
    os.makedirs(OUT, exist_ok=True)
    for key, text in LINES:
        await edge_tts.Communicate(text, VOICE, rate="+6%").save(os.path.join(OUT, key + ".mp3"))
        print(key, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
