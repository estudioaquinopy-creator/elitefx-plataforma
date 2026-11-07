"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { TIPOS_IMAGEN } from "@/lib/seguridad";

async function soloAdmin() {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  return perfil;
}

function fallo(ruta: string, msg: string): never {
  redirect(ruta + (ruta.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(msg));
}

// Sube la imagen de portada (si se eligió una) y devuelve su enlace público.
async function subirPortada(f: FormData, ruta: string): Promise<string | null> {
  const file = f.get("portada");
  if (!(file instanceof File) || file.size === 0) return null;
  if (!TIPOS_IMAGEN.includes(file.type)) fallo(ruta, "El archivo de portada debe ser una imagen JPG, PNG, WEBP o GIF.");
  if (file.size > 5 * 1024 * 1024) fallo(ruta, "La imagen pesa más de 5 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const nombre = crypto.randomUUID() + "." + (ext || "jpg");
  const supabase = createClient();
  const { error } = await supabase.storage.from("portadas").upload(nombre, file, { contentType: file.type });
  if (error) fallo(ruta, "No se pudo subir la imagen: " + error.message);
  return supabase.storage.from("portadas").getPublicUrl(nombre).data.publicUrl;
}

function txt(f: FormData, k: string): string {
  return String(f.get(k) ?? "").trim();
}

export async function crearCurso(f: FormData) {
  await soloAdmin();
  const nombre = txt(f, "nombre");
  if (!nombre) fallo("/cursos", "Escribe el nombre del curso.");
  const portada = await subirPortada(f, "/cursos");
  const supabase = createClient();
  const { data: ult } = await supabase.from("cursos").select("orden").order("orden", { ascending: false }).limit(1);
  const orden = ult && ult.length ? ult[0].orden + 1 : 1;
  const { error } = await supabase.from("cursos").insert({
    nombre,
    descripcion: txt(f, "descripcion"),
    grupo: txt(f, "grupo") === "extra" ? "extra" : "ruta",
    gratis: f.get("gratis") === "on",
    portada_url: portada,
    orden,
  });
  if (error) fallo("/cursos", "No se pudo crear el curso: " + error.message);
  revalidatePath("/cursos");
  redirect("/cursos");
}

export async function editarCurso(f: FormData) {
  await soloAdmin();
  const id = txt(f, "id");
  const ruta = "/cursos/" + id;
  const portada = await subirPortada(f, ruta);
  const datos: Record<string, unknown> = {
    nombre: txt(f, "nombre"),
    descripcion: txt(f, "descripcion"),
    gratis: f.get("gratis") === "on",
  };
  if (portada) datos.portada_url = portada;
  const { error } = await createClient().from("cursos").update(datos).eq("id", id);
  if (error) fallo(ruta, "No se pudo guardar el curso: " + error.message);
  revalidatePath("/cursos");
  redirect(ruta);
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
  const ruta = "/cursos/" + curso_id;
  const datos = {
    titulo: txt(f, "titulo"),
    descripcion: txt(f, "descripcion"),
    youtube_url: txt(f, "youtube_url"),
    materiales: parseMateriales(String(f.get("materiales") ?? "")),
  };
  if (!datos.titulo) fallo(ruta, "Escribe el título de la lección.");
  let destino = id;
  if (id) {
    const { error } = await supabase.from("lecciones").update(datos).eq("id", id);
    if (error) fallo(ruta, "No se pudo guardar la lección: " + error.message);
  } else {
    const { data: ult } = await supabase.from("lecciones").select("orden").eq("curso_id", curso_id).order("orden", { ascending: false }).limit(1);
    const orden = ult && ult.length ? ult[0].orden + 1 : 1;
    const { data, error } = await supabase.from("lecciones").insert({ ...datos, curso_id, orden }).select("id").single();
    if (error || !data) fallo(ruta, "No se pudo crear la lección: " + (error ? error.message : "sin respuesta"));
    destino = data.id;
  }
  revalidatePath(ruta);
  redirect(ruta + "?l=" + destino);
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

// Marca el video de bienvenida como visto y entra a la plataforma.
export async function completarBienvenida(f: FormData) {
  const perfil = await perfilActual();
  const supabase = createClient();
  const leccion_id = txt(f, "leccion_id");
  await supabase.from("progreso").upsert({ user_id: perfil.id, leccion_id }, { onConflict: "user_id,leccion_id", ignoreDuplicates: true });
  revalidatePath("/cursos");
  redirect("/inicio");
}

// Cambia o quita la portada de un curso directamente desde la lista de cursos.
export async function cambiarPortadaCurso(f: FormData) {
  await soloAdmin();
  const id = txt(f, "id");
  const ruta = "/cursos";
  const supabase = createClient();
  if (f.get("quitar") === "1") {
    await supabase.from("cursos").update({ portada_url: null }).eq("id", id);
  } else {
    const url = await subirPortada(f, ruta);
    if (!url) fallo(ruta, "Elige una imagen primero.");
    const { error } = await supabase.from("cursos").update({ portada_url: url }).eq("id", id);
    if (error) fallo(ruta, "No se pudo guardar la portada: " + error.message);
  }
  revalidatePath("/cursos");
  revalidatePath("/cursos/" + id);
  redirect("/cursos");
}

// El administrador reordena las lecciones (arrastrando o con las flechas).
export async function reordenarLecciones(cursoId: string, ids: string[]): Promise<{ ok: boolean; error?: string }> {
  await soloAdmin();
  const supabase = createClient();
  const resultados = await Promise.all(ids.map((id, i) => supabase.from("lecciones").update({ orden: i + 1 }).eq("id", id).eq("curso_id", cursoId)));
  const fallo = resultados.find((r) => r.error);
  if (fallo?.error) return { ok: false, error: fallo.error.message };
  revalidatePath("/cursos/" + cursoId);
  revalidatePath("/inicio");
  return { ok: true };
}

// ───────── Dudas en las lecciones ─────────
type Res = { ok: boolean; error?: string };

// Cualquiera con acceso al curso pregunta debajo de la lección (la base de datos limita a 10 por día y valida el acceso).
export async function preguntarLeccion(f: FormData): Promise<Res> {
  const perfil = await perfilActual();
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  if (!cuerpo) return { ok: false, error: "Escribe tu pregunta." };
  if (cuerpo.length > 2000) return { ok: false, error: "La pregunta es demasiado larga (máximo 2.000 caracteres)." };
  const sb = createClient();
  const { data: l } = await sb.from("lecciones").select("id, curso_id").eq("id", String(f.get("leccion_id") ?? "")).maybeSingle();
  if (!l) return { ok: false, error: "No se encontró la lección." };
  const { error } = await sb.from("lecciones_comentarios").insert({ leccion_id: l.id, curso_id: l.curso_id, user_id: perfil.id, autor: perfil.nombre || "", cuerpo });
  if (error) return { ok: false, error: error.message.includes("lecciones_comentarios") && /does not exist|schema cache/i.test(error.message) ? "Falta activar las preguntas (migración 0050)." : error.message };
  revalidatePath("/cursos/" + l.curso_id);
  return { ok: true };
}

// Solo los educadores (administradores) responden; la base de datos también lo exige.
export async function responderDuda(f: FormData): Promise<Res> {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") return { ok: false, error: "Solo los educadores pueden responder." };
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  if (!cuerpo) return { ok: false, error: "Escribe tu respuesta." };
  if (cuerpo.length > 2000) return { ok: false, error: "La respuesta es demasiado larga (máximo 2.000 caracteres)." };
  const sb = createClient();
  const { data: q } = await sb.from("lecciones_comentarios").select("id, leccion_id, curso_id").eq("id", String(f.get("parent_id") ?? "")).maybeSingle();
  if (!q) return { ok: false, error: "No se encontró la pregunta." };
  const { error } = await sb.from("lecciones_comentarios").insert({ leccion_id: q.leccion_id, curso_id: q.curso_id, user_id: perfil.id, autor: perfil.nombre || "", cuerpo, parent_id: q.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cursos/" + q.curso_id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function borrarDuda(f: FormData) {
  await perfilActual();
  const sb = createClient();
  const id = String(f.get("id") ?? "");
  const { data: q } = await sb.from("lecciones_comentarios").select("curso_id").eq("id", id).maybeSingle();
  await sb.from("lecciones_comentarios").delete().eq("id", id);
  if (q) revalidatePath("/cursos/" + q.curso_id);
  revalidatePath("/", "layout");
}
