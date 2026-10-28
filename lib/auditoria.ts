import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";

// Deja constancia de una acción del administrador (quién, qué, sobre quién y cuándo).
// Nunca interrumpe la acción: si la migración 0021 aún no se corrió, simplemente no registra.
export async function registrar(accion: string, objetivo: string | null, detalle = "") {
  try {
    const yo = await perfilActual();
    await createClient().from("auditoria").insert({ admin_id: yo.id, admin_email: yo.email, accion, objetivo, detalle: detalle.slice(0, 500) });
  } catch {
    /* sin registro */
  }
}
