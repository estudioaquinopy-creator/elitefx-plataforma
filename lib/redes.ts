export const REDES = ["instagram"] as const;
export const NOMBRES: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook", telegram: "Telegram", whatsapp: "WhatsApp" };
export const GRUPOS: Record<string, string> = { academia: "ELITE FX", personal: "Marcos Aquino" };
export type GrupoRedes = { grupo: string; items: { nombre: string; url: string }[] };

// Deja el enlace de Instagram con la dirección correcta (https://www.instagram.com/usuario). Corrige el error típico de escribir
// "instagram.com.py" (que es otro sitio y el navegador marca como inseguro). Devuelve null si el enlace no es de Instagram.
export function normalizarInstagram(v: string): string | null {
  let s = (v || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try {
    const u = new URL(s);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (h === "instagram.com" || h === "instagram.com.py" || h === "instagr.am") return "https://www.instagram.com" + u.pathname + u.search;
  } catch { /* enlace inválido */ }
  return null;
}

// Arma los grupos de redes con los enlaces cargados (los vacíos no se muestran).
export function armarRedes(aj: Record<string, string>): GrupoRedes[] {
  return Object.keys(GRUPOS)
    .map((g) => ({ grupo: GRUPOS[g], items: REDES.filter((n) => (aj["red_" + g + "_" + n] || "").trim()).map((n) => ({ nombre: NOMBRES[n], url: (n === "instagram" ? normalizarInstagram(aj["red_" + g + "_" + n]) : null) || aj["red_" + g + "_" + n].trim() })) }))
    .filter((g) => g.items.length > 0);
}
