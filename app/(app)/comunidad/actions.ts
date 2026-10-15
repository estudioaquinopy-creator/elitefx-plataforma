"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import { fallo } from "@/lib/subida";

export async function publicar(f: FormData) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const canal = String(f.get("canal") ?? "");
  const titulo = String(f.get("titulo") ?? "").trim();
  const cuerpo = String(f.get("cuerpo") ?? "").trim();
  if (!["anuncios", "preguntas", "resultados"].includes(canal)) fallo("/comunidad", "Elige una etiqueta.");
  if (canal === "anuncios" && !perm.admin) fallo("/comunidad", "Solo el equipo de ELITE FX publica anuncios.");
  if (!perm.comunidad) fallo("/comunidad", "Tu plan solo permite leer la comunidad.");
  if (!titulo) fallo("/comunidad", "Escribe un título.");
  const { error } = await createClient().from("publicaciones").insert({
    user_id: perfil.id,
    autor: perfil.nombre || perfil.email.split("@")[0],
    canal, titulo, cuerpo,
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
