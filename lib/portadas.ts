// Portadas por defecto (ilustraciones originales minimalistas en los colores de ELITE FX).
export function portadaDe(nombre: string): string | null {
  const n = (nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (n.includes("primeros")) return "/cursos/primeros-pasos.svg";
  if (n.includes("basico")) return "/cursos/curso-basico.svg";
  if (n.includes("intermedio")) return "/cursos/curso-intermedio.svg";
  if (n.includes("avanzado")) return "/cursos/curso-avanzado.svg";
  if (n.includes("scanner")) return "/cursos/scanner-elite.svg";
  if (n.includes("tutorial")) return "/cursos/tutoriales.svg";
  if (n.includes("nivel 2") || n.includes("data")) return "/cursos/data-nivel-2.svg";
  return null;
}
