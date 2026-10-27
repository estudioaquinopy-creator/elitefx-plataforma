import type { SupabaseClient } from "@supabase/supabase-js";

// Lección de bienvenida: la que se llama "Bienvenido…" dentro del curso "Primeros pasos".
// Todo el que entra a la plataforma la ve primero, hasta que la marca como vista.
export async function leccionBienvenida(sb: SupabaseClient): Promise<{ id: string; curso_id: string } | null> {
  const { data: cursos } = await sb.from("cursos").select("id").ilike("nombre", "primeros pasos%").limit(1);
  const curso = (cursos ?? [])[0] as { id: string } | undefined;
  if (!curso) return null;
  const { data: lecs } = await sb.from("lecciones").select("id, curso_id").eq("curso_id", curso.id).ilike("titulo", "%bienvenid%").order("orden").limit(1);
  return ((lecs ?? [])[0] as { id: string; curso_id: string } | undefined) ?? null;
}

export async function bienvenidaPendiente(sb: SupabaseClient, userId: string): Promise<{ id: string; curso_id: string } | null> {
  try {
    const b = await leccionBienvenida(sb);
    if (!b) return null;
    const { data } = await sb.from("progreso").select("leccion_id").eq("user_id", userId).eq("leccion_id", b.id).maybeSingle();
    return data ? null : b;
  } catch {
    return null; // ante cualquier error no se bloquea la entrada a la plataforma
  }
}
