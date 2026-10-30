"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rutaSegura } from "@/lib/seguridad";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { clienteAdmin } from "@/lib/supabase/admin";
import { hoyPY, perfilActual } from "@/lib/sesion";
import { aviso, fallo } from "@/lib/subida";
import { registrar } from "@/lib/auditoria";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
}

// Solo hay dos niveles: gratuito y VIP (se guarda como "live_trading").
const PLANES = ["gratis", "live_trading"];

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
  await registrar("membresía", id, texto + " (plan " + (plan === "gratis" ? "gratuito" : "VIP") + ", vence " + (vence ?? "sin fecha") + ")");
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
  if (act.plan === "gratis") fallo(ruta, "Primero cambia el plan a VIP.");
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

const SECCIONES = ["cursos", "calendario", "tutoriales", "comunidad", "journal", "noticias"];

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
  const plan = tipo === "miembro" ? "live_trading" : "gratis";
  const meses = Number(f.get("meses"));
  let vence = String(f.get("vence") ?? "");
  if (!vence && [1, 2, 3].includes(meses)) vence = sumarMeses(hoyPY(), meses);
  if (!/^\S+@\S+\.\S+$/.test(email)) fallo(ruta, "Escribe un correo válido.");
  const invitar = f.get("invitar") === "on";
  if (!invitar && password.length < 8) fallo(ruta, "La contraseña debe tener al menos 8 caracteres (o marca \"Enviar invitación por correo\").");
  if (tipo === "miembro" && !/^\d{4}-\d{2}-\d{2}$/.test(vence)) fallo(ruta, "Elige cuántos meses de acceso VIP tendrá (1, 2 o 3).");
  const admin = clienteAdmin();
  if (!admin) fallo(ruta, FALTA_CLAVE);

  const h = headers();
  const origen = h.get("origin") || ("https://" + (h.get("x-forwarded-host") || h.get("host")));
  const { data, error } = invitar
    ? await admin.auth.admin.inviteUserByEmail(email, { data: { nombre, telefono }, redirectTo: origen + "/nueva-clave" })
    : await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nombre } });
  if (error || !data.user) {
    const m = (error?.message ?? "").toLowerCase();
    fallo(ruta, m.includes("already") || m.includes("registered") ? "Ese correo ya tiene una cuenta. Búscalo en la lista y gestiónalo ahí." : "No se pudo " + (invitar ? "enviar la invitación" : "crear la cuenta") + ": " + (error?.message ?? "error desconocido"));
  }
  const { error: e2 } = await admin.from("perfiles").update({
    nombre, email, telefono: telefono || null,
    rol: tipo === "admin" ? "admin" : "alumno",
    plan,
    vence: tipo === "miembro" ? vence : null,
  }).eq("id", data.user.id);
  if (e2) fallo("/accesos/" + data.user.id, "La cuenta se creó, pero no se pudieron guardar sus datos: " + e2.message);
  await registrar("crear persona", data.user.id, email + " · " + (tipo === "admin" ? "administrador" : plan === "gratis" ? "gratuito" : "VIP"));
  revalidatePath("/accesos");
  aviso("/accesos/" + data.user.id, invitar ? "Invitación enviada a " + email + ". Al abrir el enlace, elegirá su contraseña." : "Persona creada. Pásale su correo y la contraseña que definiste (no se vuelve a mostrar).");
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
  await registrar("rol", id, "Nuevo rol: " + rol);
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
  await registrar("contraseña", id, "El administrador cambió la contraseña");
  aviso(ruta, "Contraseña actualizada. Pásasela a la persona.");
}

// Envía a una persona que ya tiene cuenta el correo para que cree/cambie su contraseña y entre a la plataforma.
export async function enviarInvitacion(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  const { data: act } = await createClient().from("perfiles").select("email, rol").eq("id", id).single();
  if (!act) fallo(ruta, "No se encontró la persona.");
  const email = String(act!.email ?? "");
  if (!email) fallo(ruta, "Esta persona no tiene correo registrado.");
  const h = headers();
  const origen = h.get("origin") || ("https://" + (h.get("x-forwarded-host") || h.get("host")));
  const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: origen + "/nueva-clave" });
  if (error) fallo(ruta, "No se pudo enviar el correo: " + error.message);
  await registrar("invitación", id, "Correo enviado a " + email);
  aviso(ruta, "Listo: se envió el correo a " + email + " para que cree su contraseña y entre.");
}

// Elimina la cuenta y todo lo suyo (perfil, avances, publicaciones, journal). No se puede deshacer.
export async function eliminarPersona(f: FormData) {
  await soloAdmin();
  const yo = await perfilActual();
  const id = String(f.get("id") ?? "");
  const ruta = "/accesos/" + id;
  if (id === yo.id) fallo(ruta, "No puedes eliminar tu propia cuenta.");
  const { data: act } = await createClient().from("perfiles").select("email, rol").eq("id", id).single();
  if (!act) fallo(ruta, "No se encontró la persona.");
  if (act!.rol === "admin") fallo(ruta, "Primero quítale el rol de administrador y luego elimínala.");
  const admin = clienteAdmin();
  if (!admin) fallo(ruta, "Falta configurar SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  const { error } = await admin!.auth.admin.deleteUser(id);
  if (error) fallo(ruta, "No se pudo eliminar: " + error.message);
  await registrar("eliminar cuenta", id, String(act!.email ?? ""));
  revalidatePath("/accesos");
  aviso("/accesos", "Cuenta eliminada.");
}

// Ancla o desancla el journal de un alumno (cada administrador tiene sus propios anclados).
export async function alternarAnclaje(formData: FormData) {
  await soloAdmin();
  const yo = await perfilActual();
  const alumno = String(formData.get("id") ?? "");
  const volver = rutaSegura(formData.get("volver"), "/accesos");
  if (!/^[0-9a-f-]{36}$/i.test(alumno)) redirect(volver);
  const sb = createClient();
  const { data: ya } = await sb.from("journals_anclados").select("alumno_id").eq("admin_id", yo.id).eq("alumno_id", alumno).maybeSingle();
  if (ya) await sb.from("journals_anclados").delete().eq("admin_id", yo.id).eq("alumno_id", alumno);
  else await sb.from("journals_anclados").insert({ admin_id: yo.id, alumno_id: alumno });
  revalidatePath("/accesos");
  redirect(volver);
}

// Aprueba o rechaza el número de cuenta de Liquid de un alumno (después de comprobar a mano que es cliente nuestro).
export async function revisarLiquid(formData: FormData) {
  await soloAdmin();
  const yo = await perfilActual();
  const uid = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const nota = String(formData.get("nota") ?? "").trim().slice(0, 200);
  if (!/^[0-9a-f-]{36}$/i.test(uid) || !["aprobar", "rechazar"].includes(decision)) redirect("/accesos/liquid");
  const sb = createClient();
  const { data: ant } = await sb.from("liquid_cuentas").select("estado, cuenta, user_id").eq("id", uid).maybeSingle();
  const a = ant as { estado: string; cuenta: string; user_id: string } | null;
  if (!a) redirect("/accesos/liquid");
  if (decision === "aprobar" && a.estado === "aprobado") redirect("/accesos/liquid");
  const estado = decision === "aprobar" ? "aprobado" : "rechazado";
  const { error } = await sb.from("liquid_cuentas").update({ estado, revisado_at: new Date().toISOString(), revisado_por: yo.id, nota }).eq("id", uid);
  if (error) fallo("/accesos/liquid", "No se pudo guardar: " + error.message);
  await registrar("liquid", a.user_id, (estado === "aprobado" ? "Aprobó" : "Rechazó") + " la cuenta de Liquid " + a.cuenta + (nota ? " (" + nota + ")" : ""));
  revalidatePath("/accesos/liquid");
  aviso("/accesos/liquid", estado === "aprobado" ? "Cuenta aprobada: ya suma sus puntos." : "Cuenta rechazada.");
}

// Procesa el CSV de clientes de Liquid: (1) aprueba las cuentas pendientes cuyo número aparece en la columna "account";
// (2) en las cuentas aprobadas, si "reward" es mayor a 0 (opera en real) marca la fecha para sumar los puntos extra (una sola vez).
function numero(t: string): number {
  let x = t.replace(/[^0-9.,-]/g, "");
  if (x.includes(",") && x.includes(".")) x = x.lastIndexOf(",") > x.lastIndexOf(".") ? x.replace(/\./g, "").replace(",", ".") : x.replace(/,/g, "");
  else if (x.includes(",")) x = /,\d{1,2}$/.test(x) ? x.replace(",", ".") : x.replace(/,/g, "");
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

export async function aprobarPorCsv(formData: FormData) {
  await soloAdmin();
  const yo = await perfilActual();
  let lista: unknown;
  try { lista = JSON.parse(String(formData.get("cuentas") ?? "[]")); } catch { lista = null; }
  if (!Array.isArray(lista) || lista.length === 0) fallo("/accesos/liquid", "No se pudo leer el CSV.");
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  // Cada cuenta del CSV (p. ej. ECN_2617822_1) se busca completa; si la persona escribió solo el número del medio (2617822), también coincide.
  const csv = new Map<string, number>();
  const numerico = new Map<string, number>();
  for (const f of lista as unknown[]) {
    if (!Array.isArray(f)) continue;
    const cta = norm(String(f[0] ?? ""));
    if (!cta) continue;
    const rw = numero(String(f[1] ?? ""));
    csv.set(cta, Math.max(csv.get(cta) ?? 0, rw));
    for (const t of cta.split(/[_-]/)) if (/^\d{6,}$/.test(t)) numerico.set(t, Math.max(numerico.get(t) ?? 0, rw));
  }
  const buscar = (c: string): number | undefined => csv.get(norm(c)) ?? (/^\d{6,}$/.test(norm(c)) ? numerico.get(norm(c)) : undefined);
  const sb = createClient();
  const { data } = await sb.from("liquid_cuentas").select("id, user_id, cuenta, estado, reward, reward_at").in("estado", ["pendiente", "aprobado"]);
  const filas = (data ?? []) as { id: string; user_id: string; cuenta: string; estado: string; reward: number; reward_at: string | null }[];
  const ahora = new Date().toISOString();
  let aprobadas = 0, reales = 0;
  for (const p of filas) {
    const rw = buscar(p.cuenta);
    if (rw === undefined) continue;
    const cambios: Record<string, unknown> = {};
    if (p.estado === "pendiente") Object.assign(cambios, { estado: "aprobado", revisado_at: ahora, revisado_por: yo.id, nota: "Aprobada automáticamente con el CSV" });
    if (Number(p.reward) !== rw) cambios.reward = rw;
    if (rw > 0 && !p.reward_at) cambios.reward_at = ahora;
    if (Object.keys(cambios).length === 0) continue;
    const { error } = await sb.from("liquid_cuentas").update(cambios).eq("id", p.id).eq("estado", p.estado);
    if (error) continue;
    if (p.estado === "pendiente") aprobadas++;
    if (cambios.reward_at) reales++;
  }
  const pendientes = filas.filter((p) => p.estado === "pendiente").length;
  await registrar("liquid", null, "CSV de Liquid: " + aprobadas + " cuentas aprobadas de " + pendientes + " pendientes; " + reales + " con puntos por operar en real");
  revalidatePath("/accesos/liquid");
  aviso("/accesos/liquid", aprobadas + " cuenta(s) aprobada(s) y " + reales + " con puntos extra por operar en real; " + (pendientes - aprobadas) + " siguen pendientes.");
}
