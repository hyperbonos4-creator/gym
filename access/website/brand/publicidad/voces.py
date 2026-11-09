"""Genera la narración del video, una pista por apartado."""
import asyncio, os
import edge_tts

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "voces")
VOICE = "es-CO-SalomeNeural"

LINES = [
    ("intro", "VisionYX. Este es el software del gimnasio. Vamos apartado por apartado, y qué pasa cuando se usa."),
    ("dashboard", "El tablero junta el día de la sede: lo cobrado, los intentos en la puerta y quién puede entrar. Para entrar no basta la ficha. Hace falta plan vigente y rostro."),
    ("torniquetes", "Control de acceso. Cada puerta queda identificada. El controlador avisa, el reconocimiento dice quién llega, y el brazo abre solo si todo está en regla. Si el reconocimiento no responde, la puerta no sabe quién es."),
    ("accesos", "El historial guarda cada intento: quién llegó, si el plan cubría ese día, y si el sistema ordenó abrir."),
    ("acceso", "Enrolamiento. Recepción crea la ficha con documento, nombre y WhatsApp. El acceso sigue bloqueado hasta el rostro, el plan y la sede autorizada. Enviar el enlace no es enrolar."),
    ("clientes", "Clientes. Una ficha por persona. Se busca por nombre, documento o celular. El rostro no se guarda aquí: se registra en el enrolamiento."),
    ("membresias", "Con membresía están solo los que tienen plan. Quien no tiene, sigue en Clientes. Entrar también depende del rostro."),
    ("planes", "Planes. Definen qué puede comprar el socio, cuánto cuesta y cuándo entra. El invitado entra por rostro, o con un PIN de un solo uso."),
    ("rutinas", "Rutinas. El profesor diseña la semana, publica una versión y la asigna. Si la edita después, no cambia la que el socio ya tiene."),
    ("ejercicios", "Ejercicios. El atlas muestra el recorrido en tres dimensiones. Verlo no certifica la técnica. Se le puede enviar al cliente."),
    ("estudio", "Motion Studio. El maniquí reproduce el ejercicio del catálogo. El profesor publica ese movimiento. Tampoco certifica la técnica."),
    ("valoraciones", "Valoraciones. El expediente guarda medidas y pruebas. Lo que no se midió no se anota como cero. Cerrar la valoración no cambia la rutina."),
    ("nutricion", "Nutrición. Se publica una versión del plan de comidas. No es una dieta clínica. Si falta un dato, no se inventa. Editar después no cambia la versión que el cliente ya tiene."),
    ("caja", "Punto de venta. Sin turno abierto no se cobra. El turno empieza con el efectivo del cajón."),
    ("ventas", "Historial de ventas. Cada ticket queda con su medio de pago. Una venta de hoy se puede anular, con motivo, y el stock vuelve. Un turno ya cerrado, no."),
    ("productos", "Catálogo. Al crear el producto, el sistema le asigna el código. La etiqueta sale con el logo de la sede. Si el conteo se deja en blanco, se guarda cero."),
    ("inventario", "Inventario. Cuenta lo que está en el gimnasio y lo que está en bodega. Guardar un renglón reemplaza esa cantidad."),
    ("pedidos", "Pedidos. La compra se le hace al proveedor. Cuando se recibe, las unidades entran a bodega. De ahí se bajan al gimnasio."),
    ("proveedores", "Proveedores. La razón social va con el NIT. Sin proveedor no se puede dar de alta un producto. Cada sede tiene los suyos."),
    ("facturacion", "Facturación DIAN. Cada sede usa su NIT, su certificado y su resolución. Si el envío está apagado, la venta queda en caja y no se llama a la DIAN."),
    ("egresos", "Gastos. Lo que sale de caja de esta sede queda anotado, y resta en el cierre del turno."),
    ("reportes", "Reportes. Ventas cobradas, medios, gastos y stock bajo. El margen solo se calcula si el producto tiene costo."),
    ("gimnasios", "Sedes. Cada una opera con sus socios, su caja y sus puertas. Una sede no muestra lo de otra. Si no tiene cuenta de software, sigue abierta."),
    ("cuenta", "Cuenta. El nombre y el logo son de esta sede. Quien entra al equipo solo entra aquí. Inicio admite una sede, Operación tres, y Red diez."),
    ("whatsapp", "WhatsApp. Se vincula el número de la sede con un código QR. Desde ahí salen el enrolamiento, los recordatorios y los avisos. Cada sede tiene el suyo."),
    ("outro", "Eso es el software. De la ficha a la puerta, en un solo lugar. visionyx punto lat."),
]

async def main():
    os.makedirs(OUT, exist_ok=True)
    for key, text in LINES:
        dest = os.path.join(OUT, key + ".mp3")
        await edge_tts.Communicate(text, VOICE, rate="-4%").save(dest)
        print(key, flush=True)

if __name__ == "__main__":
    asyncio.run(main())
