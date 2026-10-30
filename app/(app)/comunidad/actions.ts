"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import { fallo, subirImagen } from "@/lib/subida";
import { rutaSegura } from "@/lib/seguridad";
import { registrar } from "@/lib/auditoria";

export async function publicar(f: FormData) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const canal = String(f.get("canal") ?? "");
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  if (cuerpo.length > 5000) fallo("/comunidad", "El mensaje es demasiado largo (máximo 5.000 caracteres).");
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
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  // Permisos y comprobación de respuesta repetida a la vez (una consulta menos en fila).
  const [perm, { data: rep }] = await Promise.all([
    permisos(perfil),
    createClient().from("comentarios").select("id").eq("user_id", perfil.id).eq("post_id", String(f.get("id") ?? "")).eq("cuerpo", cuerpo).gte("created_at", new Date(Date.now() - 120000).toISOString()).limit(1),
  ]);
  if (!perm.comunidad) fallo("/comunidad", "Tu plan solo permite leer la comunidad.");
  if (!cuerpo) fallo("/comunidad", "Escribe tu respuesta.");
  if (cuerpo.length > 2000) fallo("/comunidad", "La respuesta es demasiado larga (máximo 2.000 caracteres).");
  if (rep && rep.length) redirect(rutaSegura(f.get("volver")) + "#p" + String(f.get("id") ?? ""));
  const { error } = await createClient().from("comentarios").insert({
    post_id: String(f.get("id") ?? ""), user_id: perfil.id,
    autor: perfil.nombre || perfil.email.split("@")[0], cuerpo,
  });
  if (error) fallo("/comunidad", "No se pudo responder: " + error.message);
  revalidatePath("/comunidad");
  redirect(rutaSegura(f.get("volver")) + "#p" + String(f.get("id") ?? ""));
}

export async function borrarComentario(f: FormData) {
  await perfilActual();
  await createClient().from("comentarios").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/comunidad");
  redirect(rutaSegura(f.get("volver")) + "#p" + String(f.get("post") ?? ""));
}

// Respuesta útil: la marca quien hizo la pregunta (o el administrador) y suma puntos al ranking de quien respondió.
export async function marcarUtil(f: FormData) {
  await perfilActual();
  const volver = rutaSegura(f.get("volver"));
  const util = f.get("util") === "1";
  const { error } = await createClient().rpc("marcar_comentario_util", { p_id: String(f.get("id") ?? ""), p_valor: util });
  if (error) fallo("/comunidad", error.message.includes("marcar_comentario_util") ? "Falta correr la migración 0022 en Supabase." : error.message);
  revalidatePath("/comunidad");
  redirect(volver + "#p" + String(f.get("post") ?? ""));
}

// Solo administrador: suma o resta puntos a una persona en el ranking de un mes (con motivo).
export async function ajustarPuntos(f: FormData) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const ruta = "/comunidad/ranking";
  const mes = String(f.get("mes") ?? "");
  const user_id = String(f.get("user_id") ?? "");
  const puntos = Math.trunc(Number(f.get("puntos")));
  const motivo = String(f.get("motivo") ?? "").trim().slice(0, 200);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || !user_id) fallo(ruta, "Elige a la persona.");
  if (!Number.isFinite(puntos) || puntos === 0 || Math.abs(puntos) > 1000) fallo(ruta, "Escribe los puntos a sumar o restar (por ejemplo 10 o -5).");
  if (!motivo) fallo(ruta, "Escribe el motivo del ajuste.");
  const { error } = await createClient().from("ranking_ajustes").insert({ mes, user_id, puntos, motivo, admin_id: yo.id });
  if (error) fallo(ruta, "No se pudo guardar el ajuste: " + error.message);
  await registrar("ranking", user_id, (puntos > 0 ? "+" : "") + puntos + " puntos (" + mes + "): " + motivo);
  revalidatePath(ruta);
  redirect(ruta + "?m=" + mes);
}
