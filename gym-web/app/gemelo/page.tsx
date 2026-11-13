import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDemoMode } from "../../lib/demo";
import GemeloLanding from "../../components/gemelo/GemeloLanding";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VISIONYX · Gemelo digital del gimnasio",
  description:
    "Cada socio cuenta. Accesos, membresías y caja de tu gimnasio en un solo panel. Inteligencia que conecta el mundo real.",
};

/** Landing pública del gemelo digital. Solo existe en el entorno demo (o con GEMELO_PUBLIC=1). */
export default function GemeloPage() {
  if (!isDemoMode() && String(process.env.GEMELO_PUBLIC || "") !== "1") notFound();
  const contactUrl = String(process.env.GEMELO_CONTACT_URL || "").trim();
  return <GemeloLanding contactUrl={contactUrl} />;
}
