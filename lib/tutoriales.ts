import { createClient } from "@/lib/supabase/server";

// El curso "Tutoriales" (grupo extra) es ahora la única entrada a la biblioteca de videos.
export const esCursoTutoriales = (nombre: string) => /tutorial/i.test(nombre);

// Ruta de la biblioteca: /cursos/<id del curso Tutoriales> (o /cursos si no existiera).
export async function rutaTutoriales(): Promise<string> {
  const { data } = await createClient().from("cursos").select("id, nombre").ilike("nombre", "%tutorial%").order("orden").limit(1);
  const c = (data ?? [])[0] as { id: string } | undefined;
  return c ? "/cursos/" + c.id : "/cursos";
}
