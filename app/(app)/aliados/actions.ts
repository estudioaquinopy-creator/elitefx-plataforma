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

// La persona registra su ID de Liquid; el administrador lo revisa a mano (Accesos → IDs de Liquid).
export async function enviarLiquid(f: FormData) {
  const yo = await perfilActual();
  const id = String(f.get("liquid_id") ?? "").trim();
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(id)) fallo("/aliados", "Escribe tu ID de Liquid (solo letras, números, punto, guion; de 3 a 40 caracteres).");
  const sb = createClient();
  const { data: ya } = await sb.from("liquid_ids").select("estado").eq("user_id", yo.id).maybeSingle();
  const actual = ya as { estado: string } | null;
  if (actual?.estado === "aprobado") fallo("/aliados", "Tu ID de Liquid ya fue aprobado.");
  const datos = { liquid_id: id, estado: "pendiente", enviado_at: new Date().toISOString(), revisado_at: null, revisado_por: null, nota: "" };
  const { error } = actual
    ? await sb.from("liquid_ids").update(datos).eq("user_id", yo.id)
    : await sb.from("liquid_ids").insert({ user_id: yo.id, ...datos });
  if (error) fallo("/aliados", /liquid_ids_id_uq|duplicate/i.test(error.message) ? "Ese ID de Liquid ya fue registrado por otra cuenta." : "No se pudo guardar: " + error.message);
  revalidatePath("/aliados");
  redirect("/aliados?ok=" + encodeURIComponent("Recibimos tu ID. Lo revisaremos y, si todo está bien, sumarás tus puntos."));
}
