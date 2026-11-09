"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const MannequinClip = dynamic(
  () => import("../../components/motion-studio/MannequinClip").then((mod) => mod.MannequinClip),
  { ssr: false },
);

function Stage() {
  const params = useSearchParams();
  const clip = (params.get("clip") || "").trim();
  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-black">
      {clip ? (
        <MannequinClip clipKey={clip} frameClassName="min-h-0 flex-1" />
      ) : (
        <div className="grid h-dvh place-items-center px-6 text-center text-sm text-white/50">Este ejercicio no tiene ciclo 3D.</div>
      )}
    </main>
  );
}

export default function MannequinPage() {
  return (
    <Suspense fallback={<main className="h-dvh bg-black" />}>
      <Stage />
    </Suspense>
  );
}
