"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clienteAdmin } from "@/lib/supabase/admin";
import { perfilActual } from "@/lib/sesion";
import { registrar } from "@/lib/auditoria";

const RE_ID = /^[0-9a-f-]{36}$/i;

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  return p;
}

// Borra un mensaje de la sala (y su imagen, si tenía).
export async function borrarMensajeSala(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  if (!RE_ID.test(id)) return;
  const sb = createClient();
  const { data: m } = await sb.from("sala_mensajes").select("user_id, imagen_path").eq("id", id).maybeSingle();
  const msg = m as { user_id: string; imagen_path: string | null } | null;
  await sb.from("sala_mensajes").delete().eq("id", id);
  if (msg?.imagen_path) await clienteAdmin()?.storage.from("sala").remove([msg.imagen_path]);
  await registrar("sala_borrar", msg?.user_id ?? null, "Borró un mensaje de la sala de trading");
}

// Bloquea a una persona en la sala por un tiempo (horas) o de forma permanente (0).
export async function bloquearEnSala(f: FormData) {
  const yo = await soloAdmin();
  const uid = String(f.get("user") ?? "");
  const horas = Number(String(f.get("horas") ?? "0"));
  if (!RE_ID.test(uid) || uid === yo.id || !Number.isFinite(horas) || horas < 0 || horas > 24 * 365) return;
  const hasta = horas > 0 ? new Date(Date.now() + horas * 3600000).toISOString() : null;
  await createClient().from("sala_bloqueos").upsert({ user_id: uid, hasta, por: yo.id, created_at: new Date().toISOString() });
  await registrar("sala_bloquear", uid, horas > 0 ? "Bloqueó en la sala por " + horas + " h" : "Bloqueó en la sala de forma permanente");
  revalidatePath("/comunidad/sala");
}

export async function desbloquearEnSala(f: FormData) {
  await soloAdmin();
  const uid = String(f.get("user") ?? "");
  if (!RE_ID.test(uid)) return;
  await createClient().from("sala_bloqueos").delete().eq("user_id", uid);
  await registrar("sala_desbloquear", uid, "Quitó el bloqueo de la sala");
  revalidatePath("/comunidad/sala");
}
