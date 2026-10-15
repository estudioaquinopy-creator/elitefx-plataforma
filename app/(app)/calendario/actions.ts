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

export async function crearClase(f: FormData) {
  await soloAdmin();
  const titulo = String(f.get("titulo") ?? "").trim() || "Trading en vivo";
  const fecha = String(f.get("fecha") ?? "");
  const hora = String(f.get("hora") ?? "");
  const zoom = String(f.get("zoom_url") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) fallo("/calendario", "Elige la fecha y la hora.");
  // La hora se escribe en horario de Paraguay (UTC-3).
  const inicio = new Date(fecha + "T" + hora + ":00-03:00").toISOString();
  const { error } = await createClient().from("clases").insert({ titulo, inicio, zoom_url: zoom });
  if (error) fallo("/calendario", "No se pudo crear la clase: " + error.message);
  revalidatePath("/calendario");
  revalidatePath("/inicio");
  redirect("/calendario?m=" + fecha.slice(0, 7) + "&d=" + Number(fecha.slice(8, 10)));
}

export async function eliminarClase(f: FormData) {
  await soloAdmin();
  await createClient().from("clases").delete().eq("id", String(f.get("id") ?? ""));
  revalidatePath("/calendario");
  revalidatePath("/inicio");
}
