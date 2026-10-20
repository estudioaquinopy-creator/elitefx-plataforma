"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import { fallo, subirImagen } from "@/lib/subida";

export async function publicar(f: FormData) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const canal = String(f.get("canal") ?? "");
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  const titulo = String(f.get("titulo") ?? "").trim().slice(0, 140);
  if (!["anuncios", "preguntas", "resultados"].includes(canal)) fallo("/comunidad", "Elige una etiqueta.");
  if (canal === "anuncios" && !perm.admin) fallo("/comunidad", "Solo el equipo de ELITE FX publica anuncios.");
  if (!perm.comunidad) fallo("/comunidad", "Tu plan solo permite leer la comunidad.");
  const imagen = await subirImagen(f.get("imagen"), "/comunidad", "comunidad");
  if (!cuerpo && !imagen && !titulo) fallo("/comunidad", "Escribe un mensaje o sube una imagen.");
  const { error } = await createClient().from("publicaciones").insert({
    user_id: perfil.id,
    autor: perfil.nombre || perfil.email.split("@")[0],
    canal, titulo, cuerpo, imagen_url: imagen,
  });
  if (error) fallo("/comunidad", "No se pudo publicar: " + error.message);
  revalidatePath("/comunidad");
  revalidatePath("/", "layout");
  redirect("/comunidad");
}

export async function borrarPublicacion(f: FormData) {
  await perfilActual();
  await createClient().from("publicaciones").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/comunidad");
  redirect("/comunidad");
}

export async function darLike(f: FormData) {
  const perfil = await perfilActual();
  const post_id = String(f.get("id") ?? "");
  const sb = createClient();
  const { data } = await sb.from("likes").select("post_id").eq("post_id", post_id).eq("user_id", perfil.id).maybeSingle();
  if (data) await sb.from("likes").delete().eq("post_id", post_id).eq("user_id", perfil.id);
  else {
    const { error } = await sb.from("likes").insert({ post_id, user_id: perfil.id });
    if (error) fallo("/comunidad", "No se pudo dar me gusta (solo miembros).");
  }
  revalidatePath("/comunidad");
  redirect(String(f.get("volver") || "/comunidad") + "#p" + post_id);
}

export async function comentar(f: FormData) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.comunidad) fallo("/comunidad", "Tu plan solo permite leer la comunidad.");
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  if (!cuerpo) fallo("/comunidad", "Escribe tu respuesta.");
  const { error } = await createClient().from("comentarios").insert({
    post_id: String(f.get("id") ?? ""), user_id: perfil.id,
    autor: perfil.nombre || perfil.email.split("@")[0], cuerpo,
  });
  if (error) fallo("/comunidad", "No se pudo responder: " + error.message);
  revalidatePath("/comunidad");
  redirect(String(f.get("volver") || "/comunidad") + "#p" + String(f.get("id") ?? ""));
}

export async function borrarComentario(f: FormData) {
  await perfilActual();
  await createClient().from("comentarios").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/comunidad");
  redirect(String(f.get("volver") || "/comunidad") + "#p" + String(f.get("post") ?? ""));
}
