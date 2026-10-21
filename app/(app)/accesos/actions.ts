"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clienteAdmin } from "@/lib/supabase/admin";
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

// ───── Agregar personas y administrar roles (requiere SUPABASE_SERVICE_ROLE_KEY en Vercel) ─────
const FALTA_CLAVE = "Falta configurar la clave de servicio (SUPABASE_SERVICE_ROLE_KEY) en Vercel. Mira las instrucciones y vuelve a intentar.";

export async function crearPersona(f: FormData) {
  await soloAdmin();
  const ruta = "/accesos";
  const nombre = String(f.get("nombre") ?? "").trim();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const password = String(f.get("password") ?? "");
  const telefono = String(f.get("telefono") ?? "").trim();
  const tipo = String(f.get("tipo") ?? "gratis"); // admin | gratis | miembro
  const plan = tipo === "miembro" ? (String(f.get("plan") ?? "") === "scanner" ? "scanner" : "live_trading") : "gratis";
  const vence = String(f.get("vence") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) fallo(ruta, "Escribe un correo válido.");
  if (password.length < 8) fallo(ruta, "La contraseña debe tener al menos 8 caracteres.");
  if (tipo === "miembro" && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) fallo(ruta, "Elige hasta qué fecha tiene acceso al calendario.");
  const admin = clienteAdmin();
  if (!admin) fallo(ruta, FALTA_CLAVE);

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } });
  if (error || !data.user) {
    const m = (error?.message ?? "").toLowerCase();
    fallo(ruta, m.includes("already") || m.includes("registered") ? "Ese correo ya tiene una cuenta. Búscalo en la lista y gestiónalo ahí." : "No se pudo crear la cuenta: " + (error?.message ?? "error desconocido"));
  }
  const { error: e2 } = await admin.from("perfiles").update({
    nombre, email, telefono: telefono || null,
    rol: tipo === "admin" ? "admin" : "alumno",
    plan,
    vence: tipo === "miembro" ? vence : null,
  }).eq("id", data.user.id);
  if (e2) fallo("/accesos/" + data.user.id, "La cuenta se creó, pero no se pudieron guardar sus datos: " + e2.message);
  revalidatePath("/accesos");
  aviso("/accesos/" + data.user.id, "Persona creada. Pásale su correo y la contraseña que definiste (no se vuelve a mostrar).");
}

export async function cambiarRol(f: FormData) {
  await soloAdmin();
  const yo = await perfilActual();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const rol = String(f.get("rol") ?? "") === "admin" ? "admin" : "alumno";
  if (id === yo.id && rol !== "admin") fallo(ruta, "No puedes quitarte a ti mismo el rol de administrador.");
  const admin = clienteAdmin();
  if (!admin) fallo(ruta, FALTA_CLAVE);
  const { error } = await admin.from("perfiles").update({ rol }).eq("id", id);
  if (error) fallo(ruta, "No se pudo cambiar el rol: " + error.message);
  revalidatePath("/accesos"); revalidatePath(ruta);
  aviso(ruta, rol === "admin" ? "Ahora es administrador." : "Ahora es alumno.");
}

export async function nuevaClave(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const password = String(f.get("password") ?? "");
  if (password.length < 8) fallo(ruta, "La contraseña debe tener al menos 8 caracteres.");
  const admin = clienteAdmin();
  if (!admin) fallo(ruta, FALTA_CLAVE);
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) fallo(ruta, "No se pudo cambiar la contraseña: " + error.message);
  aviso(ruta, "Contraseña actualizada. Pásasela a la persona.");
}
