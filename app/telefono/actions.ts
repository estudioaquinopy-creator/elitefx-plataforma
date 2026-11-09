"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";

// Guarda el teléfono obligatorio (solo dígitos y "+"; mínimo 8 dígitos, con código de país).
export async function guardarTelefono(f: FormData) {
  const perfil = await perfilActual();
  const t = String(f.get("telefono") ?? "").replace(/[^\d+]/g, "");
  if (t.replace(/\D/g, "").length < 8) redirect("/telefono?error=" + encodeURIComponent("Escribe un número válido, con código de país (ej.: +595981123456)."));
  const { error } = await createClient().from("perfiles").update({ telefono: t }).eq("id", perfil.id);
  if (error) redirect("/telefono?error=" + encodeURIComponent("No se pudo guardar: " + error.message));
  redirect("/inicio");
}
