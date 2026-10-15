"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo } from "@/lib/subida";

export async function guardarOperacion(f: FormData) {
  const perfil = await perfilActual();
  const par = String(f.get("par") ?? "").trim().toUpperCase();
  const direccion = String(f.get("direccion") ?? "");
  const fecha = String(f.get("fecha") ?? "");
  const resultado = Number(String(f.get("resultado") ?? "").replace(",", "."));
  if (!par) fallo("/journal", "Elige o escribe el par.");
  if (!["compra", "venta"].includes(direccion)) fallo("/journal", "Elige la dirección.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fallo("/journal", "Elige la fecha.");
  if (!Number.isFinite(resultado)) fallo("/journal", "El resultado debe ser un número (negativo si perdiste).");
  const { error } = await createClient().from("operaciones").insert({
    user_id: perfil.id, fecha, par, direccion, resultado, notas: String(f.get("notas") ?? "").trim(),
  });
  if (error) fallo("/journal", "No se pudo guardar: " + error.message);
  revalidatePath("/journal");
  redirect("/journal");
}

export async function borrarOperacion(f: FormData) {
  const perfil = await perfilActual();
  await createClient().from("operaciones").delete().eq("id", String(f.get("id") ?? "")).eq("user_id", perfil.id);
  revalidatePath("/journal");
  redirect("/journal");
}
