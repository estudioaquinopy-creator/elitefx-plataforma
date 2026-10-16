"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { perfilActual } from "@/lib/sesion";

export async function marcarLeidas() {
  const perfil = await perfilActual();
  await createClient().from("perfiles").update({ notif_leidas_at: new Date().toISOString() }).eq("id", perfil.id);
  revalidatePath("/", "layout");
}

// Solo el administrador real puede entrar o salir del modo alumno.
export async function modoAlumno(f: FormData) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await sb.from("perfiles").select("rol").eq("id", user.id).single();
  if (data?.rol !== "admin") redirect("/inicio");
  const como = String(f.get("como") ?? "");
  if (como === "miembro" || como === "gratis") cookies().set("ver_como", como, { path: "/", httpOnly: true, sameSite: "lax", secure: true });
  else cookies().delete("ver_como");
  revalidatePath("/", "layout");
  redirect("/inicio");
}
