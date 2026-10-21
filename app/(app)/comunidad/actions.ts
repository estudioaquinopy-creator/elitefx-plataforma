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
  // Evita duplicados: si se envió exactamente lo mismo hace menos de 2 minutos, no se vuelve a crear.
  const { data: rep } = await createClient().from("publicaciones").select("id").eq("user_id", perfil.id).eq("canal", canal).eq("titulo", titulo).eq("cuerpo", cuerpo).gte("created_at", new Date(Date.now() - 120000).toISOString()).limit(1);
  if (rep && rep.length) redirect("/comunidad");
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

// Me gusta: se llama desde un botón del navegador (sin recargar la página).
export async function alternarLike(postId: string): Promise<{ ok: boolean; mio: boolean; n: number; error?: string }> {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const sb = createClient();
  const cuenta = async () => (await sb.from("likes").select("post_id", { count: "exact", head: true }).eq("post_id", postId)).count ?? 0;
  if (!perm.comunidad) return { ok: false, mio: false, n: await cuenta(), error: "Solo los miembros pueden dar me gusta." };
  const { data, error: e1 } = await sb.from("likes").select("post_id").eq("post_id", postId).eq("user_id", perfil.id).maybeSingle();
  if (e1) return { ok: false, mio: false, n: 0, error: e1.message };
  if (data) {
    const { error } = await sb.from("likes").delete().eq("post_id", postId).eq("user_id", perfil.id);
    if (error) return { ok: false, mio: true, n: await cuenta(), error: error.message };
    return { ok: true, mio: false, n: await cuenta() };
  }
  const { error } = await sb.from("likes").insert({ post_id: postId, user_id: perfil.id });
  if (error) return { ok: false, mio: false, n: await cuenta(), error: error.message };
  return { ok: true, mio: true, n: await cuenta() };
}

export async function comentar(f: FormData) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.comunidad) fallo("/comunidad", "Tu plan solo permite leer la comunidad.");
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  if (!cuerpo) fallo("/comunidad", "Escribe tu respuesta.");
  const { data: rep } = await createClient().from("comentarios").select("id").eq("user_id", perfil.id).eq("post_id", String(f.get("id") ?? "")).eq("cuerpo", cuerpo).gte("created_at", new Date(Date.now() - 120000).toISOString()).limit(1);
  if (rep && rep.length) redirect(String(f.get("volver") || "/comunidad") + "#p" + String(f.get("id") ?? ""));
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
