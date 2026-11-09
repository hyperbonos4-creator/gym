/** Texto de un evento de acceso: título y motivo, sin repetir el mismo campo. */
export function accessStory(reason: string, ok: boolean): { title: string; why: string; kind: "ok" | "rechazo" | "problema" } {
  if (reason === "MANUAL") {
    return ok
      ? { title: "Apertura de prueba", why: "Orden del operador. No identifica a una persona.", kind: "ok" }
      : { title: "Orden sin confirmación", why: "El brazo pudo moverse. La respuesta no alcanzó a guardarse.", kind: "problema" };
  }
  if (reason === "DEMO") {
    return {
      title: "Demostración",
      why: "Prueba de cómo se verá el ingreso en portería, después del registro. No abre el torniquete ni cuenta como entrada.",
      kind: "ok",
    };
  }
  if (reason === "MATCHED") {
    return { title: "Entrada autorizada", why: "Membresía vigente · rostro reconocido", kind: "ok" };
  }
  if (ok) {
    return { title: "Entrada autorizada", why: "El acceso fue concedido.", kind: "ok" };
  }
  if (reason === "UNKNOWN_SUBJECT") {
    return { title: "Acceso rechazado", why: "Identidad no encontrada", kind: "problema" };
  }
  if (reason === "LIVENESS_FAILED") {
    return { title: "Acceso rechazado", why: "No pasó la prueba de vida", kind: "problema" };
  }
  if (reason === "MEMBERSHIP_EXPIRED") {
    return { title: "Acceso rechazado", why: "Membresía vencida", kind: "rechazo" };
  }
  if (reason === "NOT_AUTHORIZED") {
    return { title: "Acceso rechazado", why: "Sin autorización en esta puerta", kind: "rechazo" };
  }
  if (reason === "OUT_OF_SCHEDULE") {
    return { title: "Acceso rechazado", why: "Fuera de horario", kind: "rechazo" };
  }
  if (reason === "NO_CONSENT") {
    return { title: "Acceso rechazado", why: "Sin consentimiento", kind: "rechazo" };
  }
  if (reason === "CHALLENGE_REQUIRED") {
    return { title: "Acceso rechazado", why: "Falta un gesto de confirmación", kind: "problema" };
  }
  return { title: "Acceso rechazado", why: "Sin detalle", kind: "rechazo" };
}
