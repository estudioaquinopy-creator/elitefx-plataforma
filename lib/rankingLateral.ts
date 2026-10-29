import { unstable_cache } from "next/cache";
import { clienteAdmin } from "@/lib/supabase/admin";
import { mesDeRanking, cierreISO, premiosRanking } from "@/lib/ranking";

export type RankingLateral = {
  mes: string;
  cierre: string;
  top: { nombre: string; puntos: number; yo: boolean }[];
  premios: number[];
  yo: { pos: number; puntos: number } | null;
  modo: "vip" | "admin" | "gratis";
};
type Fila = { user_id: string; nombre: string; puntos: number };

// El ranking se calcula una vez cada 2 minutos para todos (el menú lateral está en todas las páginas).
const filasDelMes = unstable_cache(async (mes: string): Promise<Fila[] | null> => {
  const sb = clienteAdmin();
  if (!sb) return null;
  const { data, error } = await sb.rpc("ranking_mes", { p_mes: mes });
  if (error) return null;
  return ((data ?? []) as Fila[]).map((f) => ({ user_id: f.user_id, nombre: f.nombre, puntos: f.puntos }));
}, ["ranking-lateral"], { revalidate: 120 });

// Datos de la tarjeta del ranking del menú lateral. Si algo falla (p. ej. falta una migración), devuelve null y no se muestra.
export async function rankingLateral(
  perfil: { id: string },
  perm: { admin: boolean; comunidad: boolean },
  plan: string,
  ajustes: Record<string, string>,
  respaldo: () => Promise<Fila[] | null>, // consulta con la sesión de la persona, si no hay clave de servicio
  hoy: string,
): Promise<RankingLateral | null> {
  if (!perm.comunidad) return null;
  const mes = mesDeRanking(hoy);
  const modo = perm.admin ? "admin" : plan === "gratis" ? "gratis" : "vip";
  try {
    const filas = (await filasDelMes(mes)) ?? (await respaldo());
    if (!filas) return null;
    const pos = filas.findIndex((f) => f.user_id === perfil.id);
    return {
      mes, cierre: cierreISO(mes), modo,
      top: filas.slice(0, 3).map((f) => ({ nombre: f.nombre, puntos: f.puntos, yo: f.user_id === perfil.id })),
      premios: premiosRanking(ajustes.ranking_premios),
      yo: pos >= 0 ? { pos: pos + 1, puntos: filas[pos].puntos } : null,
    };
  } catch { return null; }
}
