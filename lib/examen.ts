import type { SupabaseClient } from "@supabase/supabase-js";

type C = { id: string; nombre: string; grupo: string; orden: number };

// Qué cursos de la ruta están bloqueados porque falta aprobar el examen del curso anterior.
// Devuelve { cursoId: nombre del curso cuyo examen falta }.
export async function bloqueosExamen(sb: SupabaseClient, userId: string, cursos: C[]): Promise<Record<string, { id: string; nombre: string }>> {
  const [{ data: cfg }, { data: ints }] = await Promise.all([
    sb.from("examen_config").select("curso_id, activo"),
    sb.from("examen_intentos").select("curso_id").eq("user_id", userId).eq("aprobado", true),
  ]);
  const activos = new Set(((cfg ?? []) as { curso_id: string; activo: boolean }[]).filter((c) => c.activo).map((c) => c.curso_id));
  const aprob = new Set(((ints ?? []) as { curso_id: string }[]).map((i) => i.curso_id));
  const out: Record<string, { id: string; nombre: string }> = {};
  let falta: { id: string; nombre: string } | null = null;
  for (const c of cursos.filter((x) => x.grupo === "ruta").sort((a, b) => a.orden - b.orden)) {
    if (falta) out[c.id] = falta;
    else if (activos.has(c.id) && !aprob.has(c.id)) falta = { id: c.id, nombre: c.nombre };
  }
  return out;
}
