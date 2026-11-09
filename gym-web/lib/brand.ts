/**
 * Marca visible al cliente. Configurable por entorno para white-label.
 * No cambia ids internos (gymId, DB, repos).
 */
export type BrandConfig = {
  name: string;
  tagline: string;
  logoHorizontal: string;
  logoMark: string;
  favicon: string;
  demo: boolean;
};

function env(name: string, fallback: string): string {
  const v = String(process.env[name] || "").trim();
  return v || fallback;
}

export function getBrand(): BrandConfig {
  const demo =
    String(process.env.GYM_DEMO_MODE || "").trim() === "1" ||
    String(process.env.NEXT_PUBLIC_GYM_DEMO_MODE || "").trim() === "1";
  return {
    name: env("NEXT_PUBLIC_BRAND_NAME", env("GYM_BRAND_NAME", "VISIONYX")),
    tagline: env(
      "NEXT_PUBLIC_BRAND_TAGLINE",
      env("GYM_BRAND_TAGLINE", "Inteligencia que conecta el mundo real"),
    ),
    logoHorizontal: env("NEXT_PUBLIC_BRAND_LOGO", "/brand/vx-horizontal-color.svg"),
    logoMark: env("NEXT_PUBLIC_BRAND_MARK", "/brand/vx-icon-color.svg"),
    favicon: env("NEXT_PUBLIC_BRAND_FAVICON", "/brand/favicon.svg"),
    demo,
  };
}

/** Cliente: valores públicos embebidos en el build. */
export function publicBrand(): Omit<BrandConfig, "demo"> & { demo: boolean } {
  return getBrand();
}