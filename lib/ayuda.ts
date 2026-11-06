// Etiqueta de ayuda: #ayuda o @ayuda en el título o el mensaje de una pregunta.
const RE = /(^|[\s(])[#@]ayuda(?![\p{L}\p{N}_])/iu;
export const tieneAyuda = (...textos: (string | null | undefined)[]) => textos.some((t) => !!t && RE.test(t));

// Ajuste `ayuda_admins`: ids de los administradores que reciben la alerta, separados por coma. Vacío = todos los administradores.
export const recibeAyuda = (ajuste: string | undefined, id: string) => {
  const ids = (ajuste ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return ids.length === 0 || ids.includes(id);
};
