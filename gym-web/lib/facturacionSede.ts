import fs from "fs";
import path from "path";

export type FacturacionSede = {
  enabled: boolean;
  nit: string;
};

const FILE = path.join(process.cwd(), "data", "facturacion-sedes.json");

function readAll(): Record<string, FacturacionSede> {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf-8"));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function getFacturacionSede(gymId: string): FacturacionSede {
  const row = readAll()[gymId];
  return {
    enabled: Boolean(row?.enabled),
    nit: String(row?.nit || "").replace(/\D/g, "").slice(0, 15),
  };
}

export function saveFacturacionSede(gymId: string, input: FacturacionSede): FacturacionSede {
  const all = readAll();
  const next = {
    enabled: Boolean(input.enabled),
    nit: String(input.nit || "").replace(/\D/g, "").slice(0, 15),
  };
  all[gymId] = next;
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2), "utf-8");
  return next;
}

const SEND = new Set([
  "invoice/generate-and-send",
  "invoice/generate-xml",
  "pruebas/enviar",
  "dian/nota-ajuste",
]);

export function dianSendBlocked(path: string, sede: FacturacionSede) {
  if (!SEND.has(path)) return "";
  if (!sede.enabled) return "Esta sede no envía documentos a la DIAN.";
  if (!sede.nit) return "Escribe el NIT de la sede antes de enviar un documento.";
  return "";
}
