import type { Metadata } from "next";
import "./globals.css";
import { getBrand } from "../lib/brand";

const brand = getBrand();

export const metadata: Metadata = {
  title: `${brand.name} · Plataforma`,
  description: `${brand.tagline}. Plataforma de gestión y control de acceso.`,
  icons: {
    icon: brand.favicon,
    apple: brand.logoMark,
  },
  applicationName: brand.name,
  manifest: "/brand/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Orbitron:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ ["--font-sans" as any]: "'Inter', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}