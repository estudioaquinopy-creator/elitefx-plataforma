// Sistema de referidos (solo VIP). Se activa para los miembros desde esta fecha (hora de Paraguay).
// Ojo: la fecha que de verdad manda en la base de datos es el ajuste "referidos_desde" (por defecto 2026-11-09); esta constante solo decide qué se muestra en pantalla.
export const REFERIDOS_DESDE = "2026-11-09";
export const DOMINIO = "https://academia.elitefx.com.py";

// ¿Se muestra el sistema de referidos? Después de la fecha, para todos; antes, solo para el administrador (y su modo alumno) para que lo pruebe.
export function referidosActivos(hoy: string, ajustes: Record<string, string>, esAdminReal: boolean): boolean {
  if (esAdminReal) return true;
  const desde = /^\d{4}-\d{2}-\d{2}$/.test((ajustes.referidos_desde ?? "").trim()) ? ajustes.referidos_desde.trim() : REFERIDOS_DESDE;
  return hoy >= desde;
}

// Fecha de inicio vigente (la del ajuste si es válida) y sus textos para mostrar.
export function fechaReferidos(ajustes: Record<string, string>) {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test((ajustes.referidos_desde ?? "").trim()) ? ajustes.referidos_desde.trim() : REFERIDOS_DESDE;
  const d = new Date(iso + "T12:00:00-03:00");
  return {
    iso,
    corto: d.toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short" }).replace(".", ""),
    largo: d.toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "long" }),
  };
}

const num = (t: string | undefined, def: number) => (/^\s*\d{1,3}\s*$/.test(t ?? "") ? Number((t as string).trim()) : def);
// Puntos configurables (mismos valores por defecto que la base de datos).
export function puntosReferidos(ajustes: Record<string, string>) {
  return { registro: num(ajustes.ranking_pts_ref, 5), vip: num(ajustes.ranking_pts_ref_vip, 10), tope: num(ajustes.ranking_ref_tope, 10) };
}

export const enlaceReferido = (codigo: string) => DOMINIO + "/registro?ref=" + encodeURIComponent(codigo);
