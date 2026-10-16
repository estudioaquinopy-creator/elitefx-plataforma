"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo } from "@/lib/subida";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
}

function leer(f: FormData) {
  const titulo = String(f.get("titulo") ?? "").trim();
  if (!titulo) fallo("/aliados", "Escribe un título.");
  return {
    tipo: String(f.get("tipo") ?? "Broker").trim() || "Broker",
    titulo,
    descripcion: String(f.get("descripcion") ?? "").trim(),
    url: String(f.get("url") ?? "").trim(),
    boton: String(f.get("boton") ?? "").trim() || "Abrir cuenta",
    tutorial_url: String(f.get("tutorial_url") ?? "").trim(),
  };
}

export async function crearAliado(f: FormData) {
  await soloAdmin();
  const datos = leer(f);
  const { count } = await createClient().from("aliados").select("id", { count: "exact", head: true });
  const { error } = await createClient().from("aliados").insert({ ...datos, orden: (count ?? 0) + 1 });
  if (error) fallo("/aliados", "No se pudo crear: " + error.message);
  revalidatePath("/aliados");
  redirect("/aliados");
}

export async function guardarAliado(f: FormData) {
  await soloAdmin();
  const { error } = await createClient().from("aliados").update(leer(f)).eq("id", String(f.get("id") ?? ""));
  if (error) fallo("/aliados", "No se pudo guardar: " + error.message);
  revalidatePath("/aliados");
  redirect("/aliados");
}

export async function eliminarAliado(f: FormData) {
  await soloAdmin();
  await createClient().from("aliados").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/aliados");
  redirect("/aliados");
}
