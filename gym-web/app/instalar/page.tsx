export const dynamic = "force-dynamic";

export default function InstalarPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#0A0F1C] px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="text-xs font-extrabold tracking-[0.28em] text-[#38BDF8]">FUERZA ÉLITE</div>
        <h1 className="mt-4 text-3xl font-extrabold">Instala o actualiza la app</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Este enlace no cambia. Ábrelo cada vez que haya una versión nueva. Android pide permiso para instalar desde esta fuente solo la primera vez.
        </p>
        <a href="/api/mobile/app" className="mt-8 inline-block rounded-2xl bg-[#38BDF8] px-6 py-4 text-sm font-extrabold text-[#0A0F1C]">
          Descargar Fuerza Élite
        </a>
      </div>
    </main>
  );
}
