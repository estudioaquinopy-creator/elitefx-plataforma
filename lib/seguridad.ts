// Utilidades de seguridad compartidas.

// Solo se aceptan rutas internas del propio sitio (evita redirecciones a páginas externas).
export function rutaSegura(v: FormDataEntryValue | null | undefined, defecto = "/comunidad"): string {
  const s = String(v ?? "");
  if (!s.startsWith("/") || s.startsWith("//") || s.includes("\\") || /[\r\n]/.test(s)) return defecto;
  return s;
}

// Tipos de imagen permitidos al subir archivos (se excluye SVG, que puede llevar código).
export const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];
