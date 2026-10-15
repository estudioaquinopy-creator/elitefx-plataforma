"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";

export async function marcarLeidas() {
  const perfil = await perfilActual();
  await createClient().from("perfiles").update({ notif_leidas_at: new Date().toISOString() }).eq("id", perfil.id);
  revalidatePath("/", "layout");
}
