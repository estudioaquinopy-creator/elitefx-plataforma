import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type Perfil = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "alumno";
  plan: "gratis" | "live_trading" | "scanner"; // en la práctica: gratuito o VIP (live_trading); "scanner" es un valor antiguo que se trata como VIP
  vence: string | null;
  telefono: string | null;
  avatar_url?: string | null;
  notif_leidas_at: string | null;
  vista?: "gratis" | "miembro"; // el administrador está viendo la plataforma como alumno
};

export const ZONA = "America/Asuncion";

// Fecha de hoy en Paraguay, formato AAAA-MM-DD.
export function hoyPY(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA });
}

// Devuelve el perfil del usuario con sesión o lo manda al login.
export const perfilActual = cache(async (): Promise<Perfil> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("perfiles").select("*").eq("id", user.id).single();
  if (!data) redirect("/login");
  const real = data as Perfil;
  // Modo alumno: el administrador ve la plataforma tal como la ve un alumno (miembro o gratis).
  const vista = cookies().get("ver_como")?.value;
  if (real.rol === "admin" && (vista === "miembro" || vista === "gratis")) {
    const lim = new Date(); lim.setDate(lim.getDate() + 30);
    return { ...real, rol: "alumno", plan: vista === "gratis" ? "gratis" : "live_trading", vence: vista === "gratis" ? null : lim.toISOString().slice(0, 10), vista };
  }
  return real;
});

export function esMiembro(p: Perfil): boolean {
  return p.rol === "admin" || p.plan !== "gratis";
}

// Primer nombre para saludar; si no hay nombre, la parte del correo antes de la @.
export function primerNombre(p: Perfil): string {
  const base = (p.nombre || "").trim() || p.email.split("@")[0].replace(/[._-]+/g, " ");
  const n = base.split(/\s+/)[0] || "";
  return n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();
}

export type Permisos = {
  admin: boolean;
  miembro: boolean;
  cursos: boolean;
  calendario: boolean;
  tutoriales: boolean;
  comunidad: boolean;
  journal: boolean;
  noticias: boolean;
};

// Qué puede hacer esta persona: plan + vencimiento + accesos puntuales que concedió el administrador.
export const permisos = cache(async (p: Perfil): Promise<Permisos> => {
  const { data } = await createClient().from("accesos").select("seccion, concedido").eq("user_id", p.id);
  const ov = new Set(((data ?? []) as { seccion: string; concedido: boolean }[]).filter((a) => a.concedido).map((a) => a.seccion));
  const admin = p.rol === "admin";
  const miembro = admin || p.plan !== "gratis";
  const vigente = !!p.vence && p.vence >= hoyPY();
  return {
    admin,
    miembro,
    cursos: miembro || ov.has("cursos"),
    calendario: admin || (p.plan !== "gratis" && vigente) || ov.has("calendario"),
    tutoriales: true, // libre también para el plan gratuito
    comunidad: miembro || ov.has("comunidad"),
    journal: miembro || ov.has("journal"),
    noticias: miembro || ov.has("noticias"),
  };
});

export type Estado = { clave: "gratis" | "sin" | "activo" | "porvencer" | "vencido"; texto: string };

// Estado de la membresía según la fecha de vencimiento del calendario.
export function estadoMembresia(p: { plan: string; vence: string | null }): Estado {
  if (p.plan === "gratis") return { clave: "gratis", texto: "Gratis" };
  if (!p.vence) return { clave: "sin", texto: "Sin calendario" };
  const hoy = hoyPY();
  if (p.vence < hoy) return { clave: "vencido", texto: "Vencido" };
  const lim = new Date(hoy + "T00:00:00Z");
  lim.setUTCDate(lim.getUTCDate() + 7);
  if (p.vence <= lim.toISOString().slice(0, 10)) return { clave: "porvencer", texto: "Por vencer" };
  return { clave: "activo", texto: "Activo" };
}
