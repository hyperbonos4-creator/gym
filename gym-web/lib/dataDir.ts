import path from "path";

/** Directorio de datos. En pruebas: GYM_DATA_DIR apunta a una carpeta temporal. */
export function dataDir(): string {
  const override = String(process.env.GYM_DATA_DIR || "").trim();
  if (override) return path.resolve(override);
  return path.join(process.cwd(), "data");
}
