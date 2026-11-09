/**
 * Gimnasios (tenants). Por ahora se define localmente; con el backend vendrá de
 * la API filtrado por los permisos del usuario. La plataforma es multi-tenant:
 * el superadmin puede cambiar de gimnasio y ver cada uno por separado.
 */

export type Gym = {
  id: string;
  name: string;
  city: string;
  /** Estado de vinculación de WhatsApp (se conecta al conector Evolution). */
  whatsapp: "conectado" | "desconectado";
  /** Nombre de la instancia de Evolution (WhatsApp) para este gimnasio. */
  waInstance: string;
  /** Marca visual corta (iniciales) para el avatar del gym. */
  short: string;
  /** Cuenta que paga el software. Las sedes anteriores a las cuentas no la tienen. */
  accountId?: string;
  /** Nombre que ve el socio. Si falta, se usa el nombre de la sede. */
  brandName?: string;
  /** Hay un logo propio en el servidor. */
  logo?: boolean;
};

export const GYMS: Gym[] = [
  {
    id: "fuerza-elite",
    name: "Fuerza Élite Madera Silvestre",
    city: "Sede principal",
    whatsapp: "conectado",
    waInstance: "gym",
    short: "FE",
  },
];

/** Solo el catálogo semilla (cliente). El listado vivo está en /api/gyms. */
export function getGym(id: string | null): Gym | null {
  if (!id) return GYMS[0] ?? null;
  return GYMS.find((g) => g.id === id) ?? GYMS[0] ?? null;
}

/** @deprecated En server usa gymsStore.gymInstance */
export function gymInstance(id: string | null): string {
  return getGym(id)?.waInstance ?? "gym";
}
