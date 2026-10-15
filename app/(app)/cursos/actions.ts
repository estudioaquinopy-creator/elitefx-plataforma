"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";

async function soloAdmin() {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  return perfil;
}

function txt(f: FormData, k: string): string {
  return String(f.get(k) ?? "").trim();
}

export async function crearCurso(f: FormData) {
  await soloAdmin();
  const nombre = txt(f, "nombre");
  if (!nombre) return;
  const supabase = createClient();
  const { data: ult } = await supabase.from("cursos").select("orden").order("orden", { ascending: false }).limit(1);
  const orden = ult && ult.length ? ult[0].orden + 1 : 1;
  await supabase.from("cursos").insert({
    nombre,
    descripcion: txt(f, "descripcion"),
    grupo: txt(f, "grupo") === "extra" ? "extra" : "ruta",
    gratis: f.get("gratis") === "on",
    portada_url: txt(f, "portada_url") || null,
    orden,
  });
  revalidatePath("/cursos");
}

export async function editarCurso(f: FormData) {
  await soloAdmin();
  const id = txt(f, "id");
  await createClient().from("cursos").update({
    nombre: txt(f, "nombre"),
    descripcion: txt(f, "descripcion"),
    gratis: f.get("gratis") === "on",
    portada_url: txt(f, "portada_url") || null,
  }).eq("id", id);
  revalidatePath("/cursos");
  revalidatePath("/cursos/" + id);
}

export async function eliminarCurso(f: FormData) {
  await soloAdmin();
  await createClient().from("cursos").delete().eq("id", txt(f, "id"));
  revalidatePath("/cursos");
  redirect("/cursos");
}

// Materiales: una línea por material con el formato  tipo | título | url   (tipo = pdf o link)
function parseMateriales(s: string) {
  return s.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [tipo, titulo, url] = l.split("|").map((x) => x.trim());
    return { tipo: tipo === "pdf" ? "pdf" : "link", titulo: titulo || url || "", url: url || "" };
  }).filter((m) => m.url);
}

export async function guardarLeccion(f: FormData) {
  await soloAdmin();
  const supabase = createClient();
  const id = txt(f, "id");
  const curso_id = txt(f, "curso_id");
  const datos = {
    titulo: txt(f, "titulo"),
    descripcion: txt(f, "descripcion"),
    youtube_url: txt(f, "youtube_url"),
    materiales: parseMateriales(String(f.get("materiales") ?? "")),
  };
  if (!datos.titulo) return;
  if (id) {
    await supabase.from("lecciones").update(datos).eq("id", id);
  } else {
    const { data: ult } = await supabase.from("lecciones").select("orden").eq("curso_id", curso_id).order("orden", { ascending: false }).limit(1);
    const orden = ult && ult.length ? ult[0].orden + 1 : 1;
    await supabase.from("lecciones").insert({ ...datos, curso_id, orden });
  }
  revalidatePath("/cursos/" + curso_id);
}

export async function eliminarLeccion(f: FormData) {
  await soloAdmin();
  const curso_id = txt(f, "curso_id");
  await createClient().from("lecciones").delete().eq("id", txt(f, "id"));
  revalidatePath("/cursos/" + curso_id);
  redirect("/cursos/" + curso_id);
}

export async function alternarCompletada(f: FormData) {
  const perfil = await perfilActual();
  const supabase = createClient();
  const leccion_id = txt(f, "leccion_id");
  const curso_id = txt(f, "curso_id");
  if (f.get("hecha") === "1") {
    await supabase.from("progreso").delete().eq("user_id", perfil.id).eq("leccion_id", leccion_id);
  } else {
    await supabase.from("progreso").insert({ user_id: perfil.id, leccion_id });
  }
  revalidatePath("/cursos/" + curso_id);
  revalidatePath("/cursos");
}
