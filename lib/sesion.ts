import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Perfil = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "alumno";
  plan: "gratis" | "live_trading" | "scanner";
  vence: string | null;
  telefono: string | null;
  notif_leidas_at: string | null;
};

// Devuelve el perfil del usuario con sesión o lo manda al login.
export async function perfilActual(): Promise<Perfil> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!data) redirect("/login");
  return data as Perfil;
}

export function esMiembro(p: Perfil): boolean {
  return p.rol === "admin" || p.plan !== "gratis";
}
