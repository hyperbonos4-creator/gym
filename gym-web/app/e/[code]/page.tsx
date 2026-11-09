import type { Metadata } from "next";
import { headers } from "next/headers";
import { getEnrollCode } from "../../../lib/enrollCodes";
import EnrollRedirect from "./EnrollRedirect";
import { getBrand } from "../../../lib/brand";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFromHeaders() {
  const h = headers();
  const proto = (h.get("x-forwarded-proto") || "https").split(",")[0];
  const host = (h.get("x-forwarded-host") || h.get("host") || "localhost:3100").split(",")[0];
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const rec = getEnrollCode(params.code);
  const origin = originFromHeaders();
  const brand = getBrand();
  const title = brand.name + " · Acceso facial";
  const description = rec
    ? `${rec.name.split(/\s+/)[0]}, activa tu acceso facial en menos de un minuto.`
    : "Activa tu acceso facial en menos de un minuto.";
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      siteName: brand.name,
      type: "website",
      images: [{ url: `${origin}${brand.logoMark}`, alt: brand.name }],
    },
  };
}

export default function EnrollShortPage({ params }: { params: { code: string } }) {
  const rec = getEnrollCode(params.code);
  const ok = Boolean(rec);
  const first = rec?.name.split(/\s+/)[0] ?? "";

  return (
    <main className="grid min-h-dvh place-items-center bg-[#05070d] px-6 text-[#e8eefc]">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <img src={getBrand().logoHorizontal} alt={getBrand().name} className="h-24 w-auto object-contain" />
        {ok ? (
          <>
            <h1 className="mt-6 text-xl font-extrabold tracking-tight text-white">Abriendo tu registro facial</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#9aa6c4]">
              Hola, {first}. Te llevamos a capturar tu rostro.
            </p>
            <EnrollRedirect code={params.code} />
          </>
        ) : (
          <>
            <h1 className="mt-6 text-xl font-extrabold tracking-tight text-white">Este enlace ya no es válido</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#9aa6c4]">
              Pide uno nuevo en recepción. El registro facial se activa con un link personal.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
