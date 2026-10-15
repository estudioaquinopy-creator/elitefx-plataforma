"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { hoyPY, perfilActual } from "@/lib/sesion";
import { aviso, fallo } from "@/lib/subida";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
}

const PLANES = ["gratis", "live_trading", "scanner"];

// Suma meses sin desbordar (31 de enero + 1 mes = 28/29 de febrero).
function sumarMeses(base: string, n: number): string {
  const [a, m, d] = base.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const ya = Math.floor(total / 12);
  const ym = (total % 12) + 1;
  const ultimo = new Date(Date.UTC(ya, ym, 0)).getUTCDate();
  return ya + "-" + String(ym).padStart(2, "0") + "-" + String(Math.min(d, ultimo)).padStart(2, "0");
}

async function actualizar(id: string, plan: string, vence: string | null, ruta: string, texto: string) {
  const { error } = await createClient().rpc("admin_actualizar_perfil", { p_id: id, p_plan: plan, p_vence: vence });
  if (error) fallo(ruta, "No se pudo actualizar: " + error.message);
  revalidatePath("/accesos");
  revalidatePath(ruta.split("?")[0]);
  aviso(ruta, texto);
}

async function cargar(id: string) {
  const { data } = await createClient().from("perfiles").select("plan, vence").eq("id", id).single();
  return data as { plan: string; vence: string | null } | null;
}

export async function cambiarPlan(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const plan = String(f.get("plan") ?? "");
  if (!PLANES.includes(plan)) fallo(ruta, "Plan no válido.");
  const act = await cargar(id);
  if (!act) fallo(ruta, "No se encontró la persona.");
  await actualizar(id, plan, act.vence, ruta, "Plan actualizado.");
}

// Suma 1, 2 o 3 meses de calendario, contando desde hoy o desde el vencimiento actual si todavía no pasó.
export async function sumarCalendario(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const n = Number(f.get("meses"));
  if (![1, 2, 3].includes(n)) fallo(ruta, "Elige 1, 2 o 3 meses.");
  const act = await cargar(id);
  if (!act) fallo(ruta, "No se encontró la persona.");
  if (act.plan === "gratis") fallo(ruta, "Primero cambia el plan a Live Trading o Scanner.");
  const hoy = hoyPY();
  const base = act.vence && act.vence > hoy ? act.vence : hoy;
  await actualizar(id, act.plan, sumarMeses(base, n), ruta, "Calendario extendido " + n + (n === 1 ? " mes." : " meses."));
}

export async function quitarCalendario(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const act = await cargar(id);
  if (!act) fallo(ruta, "No se encontró la persona.");
  await actualizar(id, act.plan, null, ruta, "Calendario quitado.");
}

export async function fijarFecha(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const fecha = String(f.get("vence") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fallo(ruta, "Elige una fecha.");
  const act = await cargar(id);
  if (!act) fallo(ruta, "No se encontró la persona.");
  await actualizar(id, act.plan, fecha, ruta, "Vencimiento actualizado.");
}

const SECCIONES = ["cursos", "calendario", "tutoriales", "comunidad"];

export async function guardarAccesos(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const filas = SECCIONES.map((s) => ({ user_id: id, seccion: s, concedido: f.get(s) === "on" }));
  const { error } = await createClient().from("accesos").upsert(filas);
  if (error) fallo(ruta, "No se pudo guardar: " + error.message);
  revalidatePath(ruta);
  aviso(ruta, "Accesos guardados.");
}
