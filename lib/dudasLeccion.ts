// Dudas debajo de las lecciones: hasta el día anterior a esta fecha (hora de Paraguay) siguen como siempre.
// Desde esta fecha desaparecen y las dudas se hacen en la Comunidad ("Preguntar en la comunidad", publicaciones.leccion_id).
// Si cambias la fecha, cámbiala solo aquí. Después hay que correr la migración 0079 (borra las preguntas antiguas).
export const DUDAS_LECCION_FIN = "2026-11-25";

export function dudasEnLeccionActivas(): boolean {
  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Asuncion" }); // AAAA-MM-DD
  return hoy < DUDAS_LECCION_FIN;
}
