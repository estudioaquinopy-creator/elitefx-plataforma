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

// Duración en minutos (15 a 720; por defecto 90).
function duracion(f: FormData) {
  const n = Math.round(Number(f.get("duracion_min")));
  return Number.isFinite(n) && n >= 15 ? Math.min(n, 720) : 90;
}

export async function crearClase(f: FormData) {
  await soloAdmin();
  const titulo = String(f.get("titulo") ?? "").trim() || "Trading en vivo";
  const fecha = String(f.get("fecha") ?? "");
  const hora = String(f.get("hora") ?? "");
  const zoom = String(f.get("zoom_url") ?? "").trim();
  const duracion_min = duracion(f);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) fallo("/calendario", "Elige la fecha y la hora.");
  // La hora se escribe en horario de Paraguay (UTC-3).
  const inicio = new Date(fecha + "T" + hora + ":00-03:00").toISOString();
  const { error } = await createClient().from("clases").insert({ titulo, inicio, zoom_url: zoom, duracion_min });
  if (error) fallo("/calendario", "No se pudo crear la clase: " + error.message);
  revalidatePath("/calendario");
  revalidatePath("/inicio");
  redirect("/calendario?s=" + fecha);
}

export async function eliminarClase(f: FormData) {
  await soloAdmin();
  await createClient().from("clases").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/calendario");
  revalidatePath("/inicio");
}

function leerFijo(f: FormData) {
  const titulo = String(f.get("titulo") ?? "").trim() || "Trading en vivo";
  const hora = String(f.get("hora") ?? "");
  const dias = f.getAll("dias").map(Number).filter((n) => n >= 1 && n <= 7);
  if (!/^\d{2}:\d{2}/.test(hora)) fallo("/calendario", "Elige la hora.");
  return { titulo, hora: hora.slice(0, 5), dias, activo: f.get("activo") === "on", zoom_url: String(f.get("zoom_url") ?? "").trim(), duracion_min: duracion(f) };
}

export async function crearFijo(f: FormData) {
  await soloAdmin();
  const { error } = await createClient().from("horario_fijo").insert({ ...leerFijo(f), activo: true });
  if (error) fallo("/calendario", "No se pudo crear: " + error.message);
  revalidatePath("/calendario"); revalidatePath("/inicio");
  redirect("/calendario");
}

export async function guardarFijo(f: FormData) {
  await soloAdmin();
  const { error } = await createClient().from("horario_fijo").update(leerFijo(f)).eq("id", String(f.get("id") ?? ""));
  if (error) fallo("/calendario", "No se pudo guardar: " + error.message);
  revalidatePath("/calendario"); revalidatePath("/inicio");
  redirect("/calendario");
}

export async function eliminarFijo(f: FormData) {
  await soloAdmin();
  await createClient().from("horario_fijo").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/calendario"); revalidatePath("/inicio");
  redirect("/calendario");
}
