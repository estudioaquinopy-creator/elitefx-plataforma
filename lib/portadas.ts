// Portadas por defecto: ilustraciones originales en 3D minimalista (formas claras sobre fondo verde, sin otros colores). `?v=` evita que el navegador muestre la versión anterior.
export function portadaDe(nombre: string): string | null {
  const n = (nombre || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (n.includes("primeros")) return "/cursos/primeros-pasos.svg?v=2";
  if (n.includes("basico")) return "/cursos/curso-basico.svg?v=2";
  if (n.includes("intermedio")) return "/cursos/curso-intermedio.svg?v=2";
  if (n.includes("avanzado")) return "/cursos/curso-avanzado.svg?v=2";
  if (n.includes("scanner")) return "/cursos/scanner-elite.svg?v=2";
  if (n.includes("tutorial")) return "/cursos/tutoriales.svg?v=2";
  if (n.includes("nivel 2") || n.includes("data")) return "/cursos/data-nivel-2.svg?v=2";
  return null;
}
