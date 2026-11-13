// Tipo y color de cada sesión según su título: Londres, Nueva York, Asia y "otras" (MetaTrader 5, repaso, etc.).
export type TipoSesion = "londres" | "ny" | "asia" | "otra";

export const COLORES: Record<TipoSesion, { color: string; nombre: string }> = {
  londres: { color: "#3b82f6", nombre: "Londres" },
  ny: { color: "#ef4444", nombre: "Nueva York" },
  asia: { color: "#a855f7", nombre: "Asia" },
  otra: { color: "#00d47a", nombre: "Otras sesiones" },
};

// Gratuito nuevo: solo ve la sesión de Nueva York de los miércoles (hora de Paraguay).
export function esMiercolesNY(inicioIso: string, titulo: string): boolean {
  if (tipoSesion(titulo) !== "ny") return false;
  return new Date(inicioIso).toLocaleDateString("en-US", { timeZone: "America/Asuncion", weekday: "short" }) === "Wed";
}

export function tipoSesion(titulo: string): TipoSesion {
  const t = (titulo || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/londres|london/.test(t)) return "londres";
  if (/nueva york|new york|\bny\b/.test(t)) return "ny";
  if (/asia|tokio|tokyo|sidney|sydney/.test(t)) return "asia";
  return "otra";
}
