// Reglas de la contraseña (las exige Supabase Auth) y sus mensajes en español.
export const REQUISITOS_CLAVE = "mínimo 8 caracteres, con una mayúscula, una minúscula, un número y un símbolo";

// Devuelve el mensaje de error en español si la contraseña no cumple, o "" si está bien.
export function validarClave(p: string): string {
  const falta: string[] = [];
  if (!/[a-z]/.test(p)) falta.push("una letra minúscula");
  if (!/[A-Z]/.test(p)) falta.push("una letra mayúscula");
  if (!/[0-9]/.test(p)) falta.push("un número");
  if (!/[^A-Za-z0-9]/.test(p)) falta.push("un símbolo (por ejemplo ! @ # $ %)");
  if (p.length < 8) return "La contraseña debe tener al menos 8 caracteres" + (falta.length ? ", y además " + unir(falta) : "") + ".";
  return falta.length ? "La contraseña necesita " + unir(falta) + "." : "";
}

function unir(l: string[]): string {
  return l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " y " + l[l.length - 1];
}

// Traduce el error que devuelve Supabase cuando rechaza la contraseña.
export function traducirErrorClave(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("should contain at least one") || m.includes("password is too weak") || m.includes("weak")) return "La contraseña necesita una letra mayúscula, una letra minúscula, un número y un símbolo (por ejemplo ! @ # $ %).";
  if (m.includes("at least") && m.includes("characters")) return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("different from the old password") || m.includes("same as the old")) return "La nueva contraseña debe ser distinta a la anterior.";
  return "";
}
