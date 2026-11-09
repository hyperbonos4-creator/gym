/**
 * Sesión de UI. El login real vive en POST /api/auth/login
 * (cookie gym_session = username). localStorage solo pinta el shell.
 */

const SESSION_KEY = "gym_session";
const GYM_KEY = "gym_active";

export type Role = "superadmin" | "admin" | "operador" | "recepcion" | "caja" | "entrenador";

export type SessionUser = {
  username: string;
  nombre: string;
  role: Role;
  /** IDs de gimnasios a los que tiene acceso; superadmin = todos. */
  gymIds: string[] | "all";
};

export function applySession(user: SessionUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  if (user.gymIds !== "all" && Array.isArray(user.gymIds) && user.gymIds[0]) {
    localStorage.setItem(GYM_KEY, user.gymIds[0]);
  }
}

export function logout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
  document.cookie = `${SESSION_KEY}=; path=/; max-age=0`;
  window.location.assign("/login");
}

export function getUser(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as SessionUser) : null;
}

export function getActiveGymId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(GYM_KEY);
}

export function setActiveGymId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GYM_KEY, id);
}
