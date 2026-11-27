// Límite anti-spam: cada persona (menos los administradores) puede crear como máximo MAX_PUBLICACIONES_DIA
// publicaciones por día (hora de Paraguay), sumando todas las etiquetas. Responder y dar me gusta no tienen límite.
// Si cambias el número, cámbialo también en la migración 0085 (función publicaciones_limite_dia).
export const MAX_PUBLICACIONES_DIA = 2;

// Inicio del día de hoy en Paraguay (UTC-3 todo el año desde octubre de 2024), como fecha ISO para comparar con created_at.
export function inicioDiaParaguay(): string {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" }); // AAAA-MM-DD
  return new Date(`${hoy}T00:00:00-03:00`).toISOString();
}
