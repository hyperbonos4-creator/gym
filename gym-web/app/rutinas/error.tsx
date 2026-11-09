"use client";

export default function RutinasError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gym-muted">Rutinas</p>
      <h2 className="text-xl font-extrabold text-white">No se pudo cargar esta seccion</h2>
      <p className="max-w-md text-sm text-gym-muted">
        Hubo un problema al leer las plantillas. Puedes reintentar sin salir del panel.
      </p>
      <button type="button" onClick={reset} className="btn-gym mt-2">
        Reintentar
      </button>
      {process.env.NODE_ENV !== "production" && error?.message ? (
        <p className="mt-3 max-w-lg break-all text-[11px] text-gym-muted">{error.message}</p>
      ) : null}
    </div>
  );
}
