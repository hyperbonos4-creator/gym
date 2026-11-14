import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isDemoMode } from "../../lib/demo";
import UrbanLanding from "../../components/urban/UrbanLanding";
import "./urban.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VISIONYX · URBAN — Portería inteligente para conjuntos residenciales",
  description:
    "Acceso facial con prueba de vida, app del residente, caseta del celador y administración. Recorre URBAN en 3D. Inteligencia que conecta el mundo real.",
};

const DEFAULT_CONTACT = "https://wa.me/573218559425?text=Hola%2C%20quiero%20agendar%20una%20demo%20de%20URBAN";

/** Presentación 3D de URBAN. Solo existe en el entorno demo (o con GEMELO_PUBLIC=1), igual que /gemelo. */
export default function UrbanPage() {
  if (!isDemoMode() && String(process.env.GEMELO_PUBLIC || "") !== "1") notFound();
  const contactUrl = String(process.env.URBAN_CONTACT_URL || "").trim() || DEFAULT_CONTACT;
  return <UrbanLanding contactUrl={contactUrl} />;
}
