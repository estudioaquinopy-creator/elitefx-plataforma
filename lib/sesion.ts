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
  prueba_hasta?: string | null; // prueba VIP por enlace de invitación (vuelve a gratuito al vencer)
  es_alumno?: boolean; // fue VIP alguna vez: si hoy es gratuito, es "gratuito alumno" (todos los cursos)
  calendario_bono_hasta?: string | null; // calendario gratis por tener cuenta de Liquid (miembros gratuitos)
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
  // Prueba VIP vencida: vuelve a gratuito (se devuelve ya como gratuito y se actualiza la base).
  if (real.prueba_hasta && real.rol !== "admin" && new Date(real.prueba_hasta).getTime() <= Date.now()) {
    try { await supabase.rpc("cerrar_pruebas_vencidas"); } catch { /* se reintenta en la próxima visita */ }
    return { ...real, plan: "gratis", vence: null, prueba_hasta: null };
  }
  // VIP vencido: pasa a gratuito alumno (se devuelve ya así y se actualiza la base).
  if (real.rol !== "admin" && real.plan !== "gratis" && !real.prueba_hasta && real.vence && real.vence < hoyPY()) {
    try { await supabase.rpc("cerrar_pruebas_vencidas"); } catch { /* se reintenta en la próxima visita */ }
    return { ...real, plan: "gratis", es_alumno: true };
  }
  // Modo alumno: el administrador ve la plataforma tal como la ve un alumno (miembro o gratis).
  const vista = cookies().get("ver_como")?.value;
  if (real.rol === "admin" && (vista === "miembro" || vista === "gratis")) {
    const lim = new Date(); lim.setDate(lim.getDate() + 30);
    return { ...real, rol: "alumno", plan: vista === "gratis" ? "gratis" : "live_trading", vence: vista === "gratis" ? null : lim.toISOString().slice(0, 10), es_alumno: false, vista };
  }
  return real;
});

// VIP vigente: administrador o plan VIP cuya fecha de vencimiento no pasó (sin fecha = no vencido). Al vencer pasa a gratuito alumno (solo cursos y tutoriales).
export function vipVigente(p: Perfil): boolean {
  return p.rol === "admin" || (p.plan !== "gratis" && (!p.vence || p.vence >= hoyPY()));
}

// Plan que cuenta para el ranking: quien está en prueba o tiene el VIP vencido se trata como gratuito.
export function planRanking(p: Perfil): "gratis" | "live_trading" | "scanner" {
  return p.prueba_hasta || !vipVigente(p) ? "gratis" : p.plan;
}

export function esMiembro(p: Perfil): boolean {
  return p.rol === "admin" || p.plan !== "gratis" || !!p.es_alumno;
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
  const miembro = admin || p.plan !== "gratis" || !!p.es_alumno; // VIP o gratuito alumno: todos los cursos y tutoriales
  const vip = vipVigente(p); // VIP vigente: calendario, comunidad, journal y noticias
  const vigente = !!p.vence && p.vence >= hoyPY();
  const bono = p.plan === "gratis" && !!p.calendario_bono_hasta && p.calendario_bono_hasta >= hoyPY();
  return {
    admin,
    miembro: vip,
    cursos: miembro || ov.has("cursos"),
    calendario: admin || (p.plan !== "gratis" && vigente) || bono || ov.has("calendario"),
    tutoriales: true, // libre también para el plan gratuito
    comunidad: vip || ov.has("comunidad"),
    journal: vip || ov.has("journal"),
    noticias: vip || ov.has("noticias"),
  };
});

export type Estado = { clave: "gratis" | "sin" | "activo" | "porvencer" | "vencido"; texto: string };

// Estado de la membresía según la fecha de vencimiento del calendario.
export function estadoMembresia(p: { plan: string; vence: string | null; es_alumno?: boolean }): Estado {
  if (p.plan === "gratis") {
    // VIP que venció: pasó solo a gratuito alumno pero conserva `vence` como historial; sigue contando como vencido
    if (p.es_alumno && p.vence && p.vence < hoyPY()) return { clave: "vencido", texto: "Vencido · gratuito alumno" };
    return { clave: "gratis", texto: p.es_alumno ? "Gratuito alumno" : "Gratuito nuevo" };
  }
  if (!p.vence) return { clave: "sin", texto: "Sin calendario" };
  const hoy = hoyPY();
  if (p.vence < hoy) return { clave: "vencido", texto: "Vencido" };
  const lim = new Date(hoy + "T00:00:00Z");
  lim.setUTCDate(lim.getUTCDate() + 7);
  if (p.vence <= lim.toISOString().slice(0, 10)) return { clave: "porvencer", texto: "Por vencer" };
  return { clave: "activo", texto: "Activo" };
}
