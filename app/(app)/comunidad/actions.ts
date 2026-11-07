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

// Editar el título y el texto de una publicación propia (la base de datos solo deja cambiar eso, y solo al autor).
export async function editarPublicacion(f: FormData): Promise<{ ok: boolean; error?: string }> {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.comunidad) return { ok: false, error: "Tu plan solo permite leer la comunidad." };
  const id = String(f.get("id") ?? "");
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  const titulo = String(f.get("titulo") ?? "").trim().slice(0, 140);
  if (cuerpo.length > 5000) return { ok: false, error: "El mensaje es demasiado largo (máximo 5.000 caracteres)." };
  const sb = createClient();
  const { data: p } = await sb.from("publicaciones").select("id, user_id, imagen_url").eq("id", id).maybeSingle();
  if (!p || p.user_id !== perfil.id) return { ok: false, error: "Solo puedes editar tus propias publicaciones." };
  if (!cuerpo && !titulo && !p.imagen_url) return { ok: false, error: "Escribe un mensaje." };
  const { data: ok, error } = await sb.from("publicaciones").update({ titulo, cuerpo }).eq("id", id).eq("user_id", perfil.id).select("id");
  if (error) return { ok: false, error: "No se pudo guardar: " + error.message };
  if (!ok || ok.length === 0) return { ok: false, error: "No se pudo guardar. Falta activar la edición (migración 0048) o ya no tienes permiso." };
  revalidatePath("/comunidad");
  return { ok: true };
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

// Responde a una publicación. No redirige: devuelve el resultado y la página se actualiza sola (revalidatePath).
export async function comentar(f: FormData): Promise<{ ok: boolean; error?: string }> {
  const perfil = await perfilActual();
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  // Permisos y comprobación de respuesta repetida a la vez (una consulta menos en fila).
  const [perm, { data: rep }] = await Promise.all([
    permisos(perfil),
    createClient().from("comentarios").select("id").eq("user_id", perfil.id).eq("post_id", String(f.get("id") ?? "")).eq("cuerpo", cuerpo).gte("created_at", new Date(Date.now() - 120000).toISOString()).limit(1),
  ]);
  if (!perm.comunidad) return { ok: false, error: "Tu plan solo permite leer la comunidad." };
  if (!cuerpo) return { ok: false, error: "Escribe tu respuesta." };
  if (cuerpo.length > 2000) return { ok: false, error: "La respuesta es demasiado larga (máximo 2.000 caracteres)." };
  if (rep && rep.length) return { ok: true }; // ya se había publicado la misma respuesta hace un momento
  const { error } = await createClient().from("comentarios").insert({
    post_id: String(f.get("id") ?? ""), user_id: perfil.id,
    autor: perfil.nombre || perfil.email.split("@")[0], cuerpo,
  });
  if (error) return { ok: false, error: "No se pudo responder: " + error.message };
  revalidatePath("/comunidad");
  return { ok: true };
}

export async function borrarComentario(f: FormData) {
  await perfilActual();
  await createClient().from("comentarios").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/comunidad"); // sin redirigir: la página se actualiza sola y la publicación sigue abierta
}

// Respuesta útil: la marca quien hizo la pregunta (o el administrador) y suma puntos al ranking de quien respondió.
export async function marcarUtil(f: FormData) {
  await perfilActual();
  const util = f.get("util") === "1";
  const { error } = await createClient().rpc("marcar_comentario_util", { p_id: String(f.get("id") ?? ""), p_valor: util });
  if (error) fallo("/comunidad", error.message.includes("marcar_comentario_util") ? "Falta correr la migración 0022 en Supabase." : error.message);
  revalidatePath("/comunidad"); // sin redirigir: la página se actualiza sola y la publicación sigue abierta
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

// Elige qué administradores reciben la alerta de #ayuda (sin marcar a nadie = todos).
export async function guardarAdminsAyuda(f: FormData) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const sb = createClient();
  const { data: adm } = await sb.from("perfiles").select("id").eq("rol", "admin");
  const validos = new Set(((adm ?? []) as { id: string }[]).map((x) => x.id));
  const ids = f.getAll("admin").map(String).filter((x) => validos.has(x));
  const { error } = await sb.from("ajustes").upsert({ clave: "ayuda_admins", valor: ids.join(",") });
  if (error) fallo("/accesos", "No se pudo guardar: " + error.message);
  await registrar("alerta_ayuda", null, "Destinatarios de la alerta de ayuda: " + (ids.length ? ids.length + " administradores" : "todos"));
  revalidatePath("/", "layout");
  redirect("/accesos?ok=" + encodeURIComponent("Guardado: elegiste quién recibe la alerta de ayuda."));
}

// Autocompletado de @menciones: educadores y miembros que se pueden mencionar (la base de datos decide quiénes).
export async function buscarMencionables(q: string): Promise<{ id: string; nombre: string; educador: boolean }[]> {
  await perfilActual();
  const t = String(q ?? "").slice(0, 30);
  if (!t.trim()) return [];
  const { data } = await createClient().rpc("buscar_mencionables", { p_q: t });
  return (data ?? []) as { id: string; nombre: string; educador: boolean }[];
}

// Fijar o quitar una publicación como importante (solo administradores; máximo 3 fijadas).
export async function alternarFijada(f: FormData) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const id = String(f.get("id") ?? "");
  const fijar = String(f.get("fijar") ?? "") === "1";
  const sb = createClient();
  if (fijar) {
    const { count } = await sb.from("publicaciones").select("id", { count: "exact", head: true }).not("fijada_at", "is", null);
    if ((count ?? 0) >= 3) fallo("/comunidad", "Ya hay 3 publicaciones fijadas. Quita una antes de fijar otra.");
  }
  const { data: ok, error } = await sb.from("publicaciones").update({ fijada_at: fijar ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error) fallo("/comunidad", /fijada_at|schema cache/i.test(error.message) ? "Falta correr la migración 0050 en Supabase." : "No se pudo cambiar: " + error.message);
  if (!ok || ok.length === 0) fallo("/comunidad", "No se pudo cambiar. ¿Corriste la migración 0050 en Supabase?");
  await registrar(fijar ? "fijar_publicacion" : "quitar_fijada", id, "");
  revalidatePath("/comunidad");
  revalidatePath("/", "layout");
  redirect("/comunidad");
}
