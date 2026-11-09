"use client";

import GymShell from "../../components/GymShell";

/**
 * Misma pantalla que Zora: el lector Jaltech no se configura en un buscador.
 * El día de trabajo el disparo cae en la casilla activa del punto de venta.
 * Esta página es el empareje. Los códigos de barras del manual no se
 * redibujan aquí: un código inventado reprograma el lector.
 */

function Caso({ titulo, children }: { titulo: string; children: string }) {
  return (
    <article className="rounded-xl border border-gym-border bg-gym-navy/40 px-4 py-3">
      <h3 className="text-sm font-semibold text-white">{titulo}</h3>
      <p className="mt-1 text-sm leading-relaxed text-gym-muted">{children}</p>
    </article>
  );
}

export default function EscanerPage() {
  return (
    <GymShell active="escaner">
      <div className="mx-auto max-w-3xl px-6 py-6">
        <h2 className="text-xl font-extrabold text-white">Escáner</h2>
        <p className="mt-1 text-sm text-gym-muted">
          Lector Jaltech Escáner Plus, inalámbrico 1D y QR. El computador lo oye por el receptor USB. El cable solo carga.
        </p>

        <section className="mt-6 space-y-3 text-sm leading-relaxed text-gym-silver">
          <p>
            El lector no se conecta por Bluetooth al computador. Trae un receptor pequeño que se queda en un puerto USB. Ese receptor es el empareje. El cable, cuando está puesto, cambia el lector a modo cable: manda los códigos por el cable y suelta el inalámbrico. Al quitar el cable vuelve al receptor, si el receptor sigue en el mismo puerto y el lector no se durmió.
          </p>
          <p>
            En el día no se configura nada. Se apunta al código, se aprieta el gatillo y el código cae en la casilla que está activa. Un pitido corto quiere decir que el computador lo recibió. El punto de venta, el catálogo y los pedidos lo usan igual.
          </p>
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-white">Cómo cargarlo sin perderlo</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gym-silver">
            <li>El receptor USB no se saca. Ni de noche ni para cargar.</li>
            <li>El cable se conecta a un cargador de 5 voltios, o al computador si hace falta. Mientras carga, el lector no está en inalámbrico.</li>
            <li>Al terminar se quita el cable, se acerca el lector al computador y se aprieta el gatillo una vez.</li>
            <li>Un pitido corto: sigue emparejado. Tres pitidos cortos: leyó el código y no llegó al computador. Ahí sí se empareja, con los códigos del manual de esta pantalla. No con el libro entero.</li>
          </ol>
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-white">Cuando se suelta</h3>
          <p className="mt-2 text-sm leading-relaxed text-gym-muted">
            Quite el cable de carga. Deje el receptor en el USB. Pase el lector a unos 15 centímetros, en este orden, y espere el pitido de cada código antes del siguiente. Los cuatro códigos son los del manual Jaltech de esta caja: entrar en configuración, modo inalámbrico 2.4 GHz, emparejar con el receptor, salir y guardar.
          </p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gym-silver">
            <li>Entrar en configuración. Abre el lector para recibir órdenes. Sin este, los siguientes no hacen nada.</li>
            <li>Modo inalámbrico. Lo devuelve al receptor de 2.4 GHz. Es el modo de la caja.</li>
            <li>Emparejar con el receptor. Las luces azules de la izquierda parpadean. En ese momento saque el receptor y vuelva a meterlo en el mismo puerto. Tiene un minuto. Un pitido y la luz azul de la derecha queda fija: quedó emparejado.</li>
            <li>Salir y guardar. Cierra la configuración. Si no se pasa este, el lector se queda en modo de ajuste.</li>
          </ol>
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-white">Para que no se duerma a los veinte minutos</h3>
          <p className="mt-2 text-sm leading-relaxed text-gym-muted">
            De fábrica el lector se duerme si pasa un rato sin disparar. Dormido, con el cable puesto o sin él, parece desconectado. Después de emparejar se pasan tres códigos más, una sola vez: entrar, nunca dormir, salir y guardar. La batería dura menos si se deja así; se carga al cerrar el día.
          </p>
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-white">Si el código se escribe y no busca</h3>
          <p className="mt-2 text-sm leading-relaxed text-gym-muted">
            El punto de venta busca cuando el lector manda Enter al final del código. Si el número queda en la casilla y hay que oprimir Enter a mano, faltó ese cierre: entrar, agregar Enter al final, salir y guardar. Si ya busca solo, no se pasan.
          </p>
        </section>

        <section className="mt-8">
          <h3 className="text-lg font-semibold text-white">Qué significa cada señal</h3>
          <div className="mt-3 space-y-2">
            <Caso titulo="Un pitido corto">El código llegó al computador. Si estaba emparejando, el receptor quedó unido.</Caso>
            <Caso titulo="Tres pitidos cortos">El lector leyó y no pudo entregar el dato. El receptor no está, el cable sigue puesto, o el lector está dormido. Quite el cable, acerque el lector y dispare otra vez. Si se repite, empareje del 1 al 4.</Caso>
            <Caso titulo="Dos pitidos largos">El minuto de empareje se acabó y el receptor no se detectó. Vuelva al código 3 y, con las luces parpadeando, saque el receptor y métalo de nuevo.</Caso>
            <Caso titulo="Luces azules parpadeando">Está esperando el receptor. No escanee productos en ese momento. Conecte el receptor o salga con dos gatillazos seguidos.</Caso>
            <Caso titulo="Se fue a los veinte minutos con el cable puesto">El cable lo pasó a modo cable y, al quedar quieto, se durmió o el puerto USB dejó de alimentarlo. Quite el cable y dispare una vez. Si no responde, empareje del 1 al 4 y después pase el nunca dormir. El receptor no se mueve de su puerto. El computador de la caja no debe suspender los USB ni dormirse con la caja abierta.</Caso>
            <Caso titulo="Funciona con el cable y no sin él">Está en modo cable, que es lo normal mientras carga. Quite el cable. Si no pita al disparar, el inalámbrico se soltó: códigos 1 a 4.</Caso>
            <Caso titulo="Escribe el código y la búsqueda no arranca">Falta Enter al final. Códigos de agregar Enter.</Caso>
            <Caso titulo="Después de escanear el libro entero quedó peor">El libro empieza por restaurar de fábrica, idioma y prefijos. Eso borra el Enter y el modo de la caja. No lo recorra. Vuelva a esta pantalla: 1 a 4 para emparejar, 5 a 7 para que no duerma, y 8 a 10 solo si no busca solo.</Caso>
          </div>
        </section>

        <section className="mb-10 mt-8">
          <h3 className="text-lg font-semibold text-white">Lo que no se hace</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-gym-silver">
            <li>No se escanea «restaurar de fábrica», ni el idioma, ni los prefijos del manual.</li>
            <li>No se saca el receptor para guardar el lector. El empareje vive ahí.</li>
            <li>No se dejan pasar los códigos de corrido. Cada uno espera su pitido.</li>
            <li>No se empareja con el cable de carga puesto. Primero se quita el cable.</li>
            <li>Dos gatillazos seguidos salen del empareje si las luces se quedan parpadeando.</li>
          </ul>
        </section>
      </div>
    </GymShell>
  );
}
