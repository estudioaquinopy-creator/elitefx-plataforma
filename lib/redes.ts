export const REDES = ["instagram"] as const;
export const NOMBRES: Record<string, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook", telegram: "Telegram", whatsapp: "WhatsApp" };
export const GRUPOS: Record<string, string> = { academia: "ELITE FX", personal: "Marcos Aquino" };
export type GrupoRedes = { grupo: string; items: { nombre: string; url: string }[] };

// Arma los grupos de redes con los enlaces cargados (los vacíos no se muestran).
export function armarRedes(aj: Record<string, string>): GrupoRedes[] {
  return Object.keys(GRUPOS)
    .map((g) => ({ grupo: GRUPOS[g], items: REDES.filter((n) => (aj["red_" + g + "_" + n] || "").trim()).map((n) => ({ nombre: NOMBRES[n], url: aj["red_" + g + "_" + n].trim() })) }))
    .filter((g) => g.items.length > 0);
}
