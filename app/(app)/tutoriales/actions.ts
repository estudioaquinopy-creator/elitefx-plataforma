"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo } from "@/lib/subida";
import { youtubeId } from "@/lib/youtube";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
}

export async function agregarTutorial(f: FormData) {
  await soloAdmin();
  const titulo = String(f.get("titulo") ?? "").trim();
  const categoria = String(f.get("categoria") ?? "").trim() || "General";
  const youtube_url = String(f.get("youtube_url") ?? "").trim();
  if (!titulo) fallo("/tutoriales", "Escribe el título del tutorial.");
  if (!youtubeId(youtube_url)) fallo("/tutoriales", "El enlace de YouTube no es válido.");
  const { error } = await createClient().from("tutoriales").insert({ titulo, categoria, youtube_url });
  if (error) fallo("/tutoriales", "No se pudo guardar: " + error.message);
  revalidatePath("/tutoriales");
  redirect("/tutoriales");
}

export async function eliminarTutorial(f: FormData) {
  await soloAdmin();
  await createClient().from("tutoriales").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/tutoriales");
  redirect("/tutoriales");
}
