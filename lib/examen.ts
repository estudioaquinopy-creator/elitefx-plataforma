import type { SupabaseClient } from "@supabase/supabase-js";

type C = { id: string; nombre: string; grupo: string; orden: number };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// Cursos que no tienen examen propio: "Primeros pasos" (es el inicio de la ruta) y "Data de nivel 2" (es el último).
export function cursoSinExamen(nombre: string): boolean {
  const n = sinTildes(nombre);
  return n.startsWith("primeros pasos") || /data.*nivel\s*2/.test(n);
}

// Qué cursos de la ruta están bloqueados porque falta aprobar el examen del curso anterior.
// Devuelve { cursoId: nombre del curso cuyo examen falta }.
export async function bloqueosExamen(sb: SupabaseClient, userId: string, cursos: C[], esGratis = false): Promise<Record<string, { id: string; nombre: string }>> {
  // Quien tiene plan gratuito no ve avisos de examen: los cursos de pago le muestran "Miembros".
  if (esGratis) return {};
  let cfg: unknown, ints: unknown;
  try {
    const r = await Promise.all([
      sb.from("examen_config").select("curso_id, activo"),
      sb.from("examen_intentos").select("curso_id").eq("user_id", userId).eq("aprobado", true),
    ]);
    cfg = r[0].data; ints = r[1].data;
  } catch { return {}; } // si las tablas del examen aún no existen, no se bloquea nada
  const sinExamen = new Set(cursos.filter((c) => cursoSinExamen(c.nombre)).map((c) => c.id));
  const activos = new Set(((cfg ?? []) as { curso_id: string; activo: boolean }[]).filter((c) => c.activo && !sinExamen.has(c.curso_id)).map((c) => c.curso_id));
  const aprob = new Set(((ints ?? []) as { curso_id: string }[]).map((i) => i.curso_id));
  const out: Record<string, { id: string; nombre: string }> = {};
  // Cada curso bloqueado muestra el examen del curso inmediato anterior (el más cercano con examen activo).
  // Si ese ya está aprobado pero falta uno anterior, muestra el primero que falta.
  let primera: { id: string; nombre: string } | null = null; // primer examen sin aprobar
  let previa: { id: string; nombre: string } | null = null;  // último curso anterior con examen activo
  // La ruta (primeros pasos → básico → intermedio → avanzado) y, al final, "Data de nivel 2": se desbloquea al aprobar el avanzado.
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const ruta = cursos.filter((x) => x.grupo === "ruta").sort((a, b) => a.orden - b.orden);
  const data = cursos.filter((x) => x.grupo !== "ruta" && /data.*nivel\s*2/.test(norm(x.nombre)));
  for (const c of [...ruta, ...data]) {
    if (primera) out[c.id] = previa && !aprob.has(previa.id) ? previa : primera;
    if (activos.has(c.id)) {
      if (!aprob.has(c.id) && !primera) primera = { id: c.id, nombre: c.nombre };
      previa = { id: c.id, nombre: c.nombre };
    }
  }
  return out;
}
