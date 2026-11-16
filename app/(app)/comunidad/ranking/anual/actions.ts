"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo } from "@/lib/subida";
import { registrar } from "@/lib/auditoria";

// Solo administrador: realiza el sorteo anual (uno por año; el resultado queda guardado y no se puede repetir).
export async function realizarSorteo(f: FormData) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const anio = Math.trunc(Number(f.get("anio")));
  const ruta = "/comunidad/ranking/anual?a=" + (Number.isFinite(anio) ? anio : "");
  if (!Number.isFinite(anio) || anio < 2026 || anio > 2100) fallo("/comunidad/ranking/anual", "Año no válido.");
  if (f.get("confirmo") !== "1") fallo(ruta, "Marca la casilla para confirmar el sorteo.");
  const premio = String(f.get("premio") ?? "").trim().slice(0, 120);
  const { data, error } = await createClient().rpc("sorteo_realizar", { p_anio: anio, p_premio: premio });
  if (error) fallo(ruta, error.message.includes("function") ? "Falta correr la migración 0067 en Supabase." : "No se pudo realizar el sorteo: " + error.message);
  const g = data as { user_id: string; nombre: string; boletos: number; total: number; participantes: number } | null;
  await registrar("sorteo", g?.user_id ?? null, "Sorteo " + anio + ": ganó " + (g?.nombre ?? "?") + " (" + (g?.boletos ?? 0) + " de " + (g?.total ?? 0) + " boletos, " + (g?.participantes ?? 0) + " participantes)");
  revalidatePath("/comunidad/ranking/anual");
  redirect(ruta);
}
