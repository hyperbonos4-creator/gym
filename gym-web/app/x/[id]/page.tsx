import BrandLogo from "../../../components/BrandLogo";
import ClientLesson from "../../../components/exercises/ClientLesson";
import { EXERCISES } from "../../../lib/exercisesCatalog";
import { publishedClip } from "../../../lib/motionStore";

export const dynamic = "force-dynamic";

export default function ClientExercisePage({ params }: { params: { id: string } }) {
  const exercise = EXERCISES.find((e) => e.id === params.id);
  if (!exercise) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#05070d] px-6 text-center text-[#e8eefc]">
        <div>
          <BrandLogo variant="nav" className="mx-auto h-16" />
          <h1 className="mt-6 text-xl font-extrabold">Este ejercicio ya no está disponible</h1>
          <p className="mt-2 text-sm text-[#9aa6c4]">Pide uno nuevo a tu entrenador.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#05070d] text-[#e8eefc]">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-3">
          <BrandLogo variant="nav" className="h-12" />
          <div>
            <div className="text-sm font-extrabold text-white">Fuerza Élite</div>
            <div className="text-[11px] text-[#9aa6c4]">Tu ejercicio de hoy</div>
          </div>
        </div>
      </header>
      <ClientLesson exercise={exercise} motion={publishedClip(exercise.id)} />
    </main>
  );
}
