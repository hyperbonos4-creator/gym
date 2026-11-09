import type { ReactNode } from "react";

export type NavItem = {
  key: string;
  label: string;
  sub: string;
  enabled: boolean;
  group: "Operación" | "Gimnasio" | "Finanzas" | "Sistema";
  icon: ReactNode;
};

const I = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    {d}
  </svg>
);

/**
 * Todos los módulos de la plataforma. `enabled:false` = visible pero
 * desactivado ("Próximamente"): se irán habilitando uno a uno.
 */
export const NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", sub: "Resumen del gimnasio", enabled: true, group: "Operación",
    icon: I(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>) },

  { key: "torniquetes", label: "Control de acceso", sub: "Cada puerta. Cualquier red. Siempre identificada.", enabled: true, group: "Operación",
    icon: I(<><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M8 9h.01M8 15h.01M16 12h2" /></>) },
  { key: "accesos", label: "Historial de accesos", sub: "Auditoría de cada intento en la puerta", enabled: true, group: "Operación",
    icon: I(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>) },
  { key: "acceso", label: "Enrolamiento", sub: "Registro facial", enabled: true, group: "Operación",
    icon: I(<><circle cx="12" cy="8" r="3.4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /><path d="M2 12h2M20 12h2" /></>) },

  { key: "clientes", label: "Clientes", sub: "Identidad, enrolamiento y acceso en un solo lugar", enabled: true, group: "Gimnasio",
    icon: I(<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 3.6a3 3 0 0 1 0 5.8M21 20c0-2.6-1.6-4.6-4-5.2" /></>) },
  { key: "prospectos", label: "Prospectos", sub: "CRM · seguimiento de leads", enabled: false, group: "Gimnasio",
    icon: I(<><circle cx="10" cy="8" r="3" /><path d="M4 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M19 8v4M17 10h4" /></>) },
  { key: "empresas", label: "Empresas", sub: "Convenios corporativos", enabled: false, group: "Gimnasio",
    icon: I(<><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" /></>) },
  { key: "membresias", label: "Con membresía", sub: "Clientes con plan activo", enabled: true, group: "Gimnasio",
    icon: I(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>) },
  { key: "planes", label: "Planes", sub: "Tarifas, beneficios y condiciones de acceso", enabled: true, group: "Gimnasio",
    icon: I(<><path d="M4 7l8-4 8 4-8 4-8-4Z" /><path d="M4 12l8 4 8-4M4 17l8 4 8-4" /></>) },
  { key: "rutinas", label: "Rutinas", sub: "Versiones y asignación", enabled: true, group: "Gimnasio",
    icon: I(<><path d="M6.5 6.5l11 11M4 9l-1.5-1.5M20 15l1.5 1.5" /><rect x="2" y="9" width="4" height="6" rx="1" transform="rotate(45 4 12)" /></>) },
  { key: "ejercicios", label: "Ejercicios", sub: "Atlas 3D · ejecución guiada", enabled: true, group: "Gimnasio",
    icon: I(<><path d="M3 12h4l2 6 4-14 2 8h6" /></>) },
  { key: "estudio", label: "Motion Studio 3D", sub: "El profesor crea y publica el movimiento", enabled: true, group: "Gimnasio",
    icon: I(<><circle cx="12" cy="5" r="2" /><path d="M12 7v4l3 2M8 21l2-6 2 2 2-2 2 6" /></>) },
  { key: "valoraciones", label: "Valoraciones", sub: "Expediente · medidas · evolución", enabled: true, group: "Gimnasio",
    icon: I(<><path d="M3 3v18h18" /><path d="M7 15l3-4 3 3 4-6" /></>) },
  { key: "nutricion", label: "Nutrición", sub: "Planificación alimentaria · Hábitos · Seguimiento", enabled: true, group: "Gimnasio",
    icon: I(<><path d="M12 2c3 3 4 6 4 9a4 4 0 0 1-8 0c0-3 1-6 4-9Z" /><path d="M12 13v8" /></>) },
  { key: "clases", label: "Clases", sub: "Grupales y horarios", enabled: true, group: "Gimnasio",
    icon: I(<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>) },
  { key: "lockers", label: "Lockers", sub: "Casilleros y asignación", enabled: false, group: "Gimnasio",
    icon: I(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M13 8h2" /></>) },

  { key: "caja", label: "Punto de venta", sub: "Cobro, lector y ticket", enabled: true, group: "Finanzas",
    icon: I(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>) },
  { key: "escaner", label: "Escáner", sub: "Empareje del lector Jaltech", enabled: false, group: "Finanzas",
    icon: I(<><path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3" /><path d="M7 12h10" /></>) },
  { key: "ventas", label: "Historial de ventas", sub: "Tickets, medios y anulaciones", enabled: true, group: "Finanzas",
    icon: I(<><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3M8 11h8M8 15h8M8 19h5" /></>) },
  { key: "productos", label: "Catálogo", sub: "Gimnasio, bodega y códigos", enabled: true, group: "Finanzas",
    icon: I(<><path d="M6 2 3 6v14a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6l-3-4Z" /><path d="M3 6h18M16 10a4 4 0 0 1-8 0" /></>) },
  { key: "inventario", label: "Inventario", sub: "Conteo de gimnasio y bodega", enabled: true, group: "Finanzas",
    icon: I(<><path d="M3 7h18M3 12h18M3 17h18" /><path d="M7 7v10" /></>) },
  { key: "pedidos", label: "Pedidos", sub: "Compra al proveedor y entrada a bodega", enabled: true, group: "Finanzas",
    icon: I(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>) },
  { key: "proveedores", label: "Proveedores", sub: "A quién se le compra", enabled: true, group: "Finanzas",
    icon: I(<><path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="18" cy="18" r="1.6" /></>) },
  { key: "facturacion", label: "Facturación DIAN", sub: "Documentos electrónicos por sede", enabled: true, group: "Finanzas",
    icon: I(<><path d="M6 3h9l3 3v15H6z" /><path d="M9 11h6M9 15h6" /></>) },
  { key: "egresos", label: "Gastos", sub: "Salidas de caja", enabled: true, group: "Finanzas",
    icon: I(<><path d="M12 3v12M8 11l4 4 4-4" /><path d="M4 21h16" /></>) },
  { key: "reportes", label: "Reportes", sub: "Ventas, medios, margen y stock", enabled: true, group: "Finanzas",
    icon: I(<><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>) },

  { key: "gimnasios", label: "Gimnasios", sub: "Sedes y usuarios", enabled: true, group: "Sistema",
    icon: I(<><path d="M3 21h18M6 21V8l6-4 6 4v13M10 21v-6h4v6" /></>) },
  { key: "empleados", label: "Empleados", sub: "Equipo del gimnasio", enabled: false, group: "Sistema",
    icon: I(<><circle cx="12" cy="7" r="3.2" /><path d="M5 21c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>) },
  { key: "roles", label: "Roles y permisos", sub: "Accesos por usuario", enabled: false, group: "Sistema",
    icon: I(<><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3Z" /><path d="M9.5 12l1.8 1.8L15 10" /></>) },
  { key: "cuenta", label: "Cuenta", sub: "Plan, marca y equipo de la sede", enabled: true, group: "Sistema",
    icon: I(<><path d="M4 7h16v12H4z" /><path d="M8 7V5a4 4 0 0 1 8 0v2" /></>) },
  { key: "whatsapp", label: "WhatsApp", sub: "Vincular número (QR)", enabled: true, group: "Sistema",
    icon: I(<><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8A8.38 8.38 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5Z" /></>) },
  { key: "config", label: "Configuración", sub: "Ajustes del gimnasio", enabled: false, group: "Sistema",
    icon: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.22.65.22 1s-.08.69-.22 1Z" /></>) },
];

export const NAV_GROUPS: NavItem["group"][] = ["Operación", "Gimnasio", "Finanzas", "Sistema"];

/** Lo que aún no existe se anuncia aparte, no como filas “Pronto” en el menú. */
export const SOON_KEYS = ["lockers", "prospectos", "empresas"];

const ROLE_KEYS: Record<string, string[] | "all"> = {
  superadmin: "all",
  operador: "all",
  recepcion: ["dashboard", "acceso", "accesos", "torniquetes", "clientes", "membresias", "planes", "whatsapp"],
  caja: ["dashboard", "caja", "ventas", "facturacion", "productos", "inventario", "pedidos", "proveedores", "egresos", "reportes", "membresias", "clientes"],
  admin: ["dashboard", "acceso", "accesos", "torniquetes", "clientes", "membresias", "planes", "whatsapp", "caja", "ventas", "facturacion", "productos", "inventario", "pedidos", "proveedores", "egresos", "reportes", "ejercicios", "estudio", "rutinas", "valoraciones", "nutricion", "clases", "cuenta"],
  entrenador: ["dashboard", "clientes", "ejercicios", "estudio", "rutinas", "valoraciones", "nutricion", "clases"],
};

export function roleCanSee(role: string, key: string) {
  const allow = ROLE_KEYS[role] || "all";
  return allow === "all" || allow.includes(key);
}
