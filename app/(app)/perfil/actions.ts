"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";

function msg(t: string, tipo: "ok" | "error", texto: string): never {
  redirect("/perfil?t=" + t + "&" + tipo + "=" + encodeURIComponent(texto));
}

export async function guardarPerfil(f: FormData) {
  const perfil = await perfilActual();
  const nombre = String(f.get("nombre") ?? "").trim();
  const telefono = String(f.get("telefono") ?? "").trim();
  if (!nombre) msg("editar", "error", "Escribe tu nombre.");
  const { error } = await createClient().from("perfiles").update({ nombre, telefono: telefono || null }).eq("id", perfil.id);
  if (error) msg("editar", "error", "No se pudo guardar: " + error.message);
  msg("editar", "ok", "Perfil actualizado.");
}

export async function cambiarClave(f: FormData) {
  await perfilActual();
  const a = String(f.get("clave") ?? "");
  const b = String(f.get("clave2") ?? "");
  if (a.length < 8) msg("clave", "error", "La contraseña debe tener al menos 8 caracteres.");
  if (a !== b) msg("clave", "error", "Las contraseñas no coinciden.");
  const { error } = await createClient().auth.updateUser({ password: a });
  if (error) msg("clave", "error", "No se pudo cambiar: " + error.message);
  msg("clave", "ok", "Contraseña actualizada.");
}
