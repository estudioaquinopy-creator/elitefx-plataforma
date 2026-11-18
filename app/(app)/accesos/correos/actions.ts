"use server";
import { revalidatePath } from "next/cache";
import { perfilActual } from "@/lib/sesion";
import { clienteAdmin } from "@/lib/supabase/admin";
import { aviso, fallo } from "@/lib/subida";
import { registrar } from "@/lib/auditoria";
import { leerAjustes } from "@/lib/ajustes";
import { AUDIENCIAS, TOPE_DIA_DEFECTO, enviarLote, gruposDe, inicioDiaUTC } from "@/lib/correos";

const RUTA = "/accesos/correos";

async function admin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const db = clienteAdmin();
  if (!db) fallo(RUTA, "Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return { p, db };
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export async function crearEnvio(f: FormData) {
  const { p, db } = await admin();
  const asunto = String(f.get("asunto") ?? "").trim().slice(0, 150);
  const mensaje = String(f.get("mensaje") ?? "").trim().slice(0, 8000);
  if (!asunto || !mensaje) fallo(RUTA, "Escribe el asunto y el mensaje.");
  const grupos = f.getAll("grupo").map(String).filter((g) => AUDIENCIAS.some((a) => a.id === g));
  const extras = String(f.get("extras") ?? "").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => EMAIL.test(e));
  if (!grupos.length && !extras.length) fallo(RUTA, "Elige al menos un grupo o escribe algún correo.");

  const dest = new Map<string, string>();
  if (grupos.length) {
    const { data, error } = await db.from("perfiles").select("email,nombre,rol,plan,es_alumno,prueba_hasta,vence").limit(5000);
    if (error) fallo(RUTA, "No se pudo leer a las personas: " + error.message);
    for (const x of data ?? []) {
      if (!x.email || !EMAIL.test(x.email)) continue;
      if (gruposDe(x).some((g) => grupos.includes(g))) dest.set(x.email.toLowerCase(), x.nombre ?? "");
    }
  }
  for (const e of extras) if (!dest.has(e)) dest.set(e, "");

  const { data: bajas } = await db.from("correos_bajas").select("email");
  const baja = new Set((bajas ?? []).map((b) => String(b.email).toLowerCase()));
  const lista = [...dest.entries()].filter(([e]) => !baja.has(e));
  const excluidos = dest.size - lista.length;
  if (!lista.length) fallo(RUTA, "No hay a quién enviar (nadie en ese grupo, o todos pidieron no recibir correos).");

  const nombres = grupos.map((g) => AUDIENCIAS.find((a) => a.id === g)?.etiqueta).filter(Boolean).join(", ") + (extras.length ? (grupos.length ? " + " : "") + extras.length + " correo(s) sueltos" : "");
  const { data: env, error: e1 } = await db.from("correos_envios").insert({ creado_por: p.id, asunto, mensaje, audiencia: nombres }).select("id").single();
  if (e1 || !env) fallo(RUTA, "No se pudo crear el envío (¿corriste la migración 0069?): " + (e1?.message ?? ""));
  for (let i = 0; i < lista.length; i += 500) {
    const { error } = await db.from("correos_cola").insert(lista.slice(i, i + 500).map(([email, nombre]) => ({ envio_id: env.id, email, nombre })));
    if (error) fallo(RUTA, "No se pudo guardar la lista: " + error.message);
  }
  await registrar("correo_masivo", env.id, "Creó el envío «" + asunto + "» para " + lista.length + " personas (" + nombres + ")");
  revalidatePath(RUTA);
  aviso(RUTA + "?e=" + env.id, "Envío creado para " + lista.length + " personas" + (excluidos ? " (" + excluidos + " no lo reciben porque pidieron la baja)" : "") + ". Ahora envía la primera tanda.");
}

export async function enviarTanda(f: FormData) {
  const { db } = await admin();
  const id = String(f.get("envio") ?? "");
  const ruta = RUTA + "?e=" + id;
  const { data: env } = await db.from("correos_envios").select("id,asunto,mensaje").eq("id", id).single();
  if (!env) fallo(RUTA, "No se encontró el envío.");
  const aj = await leerAjustes();
  const tope = Math.min(100, Math.max(1, Number(aj.correos_tope_dia) || TOPE_DIA_DEFECTO));
  const { count: hoy } = await db.from("correos_cola").select("id", { count: "exact", head: true }).eq("estado", "enviado").gte("enviado_at", inicioDiaUTC());
  const queda = tope - (hoy ?? 0);
  if (queda <= 0) fallo(ruta, "Ya llegaste al tope de hoy (" + tope + " correos). El contador se reinicia a las 21:00 (hora de Paraguay).");

  const { data: pend } = await db.from("correos_cola").select("id").eq("envio_id", id).eq("estado", "pendiente").order("id").limit(queda);
  const ids = (pend ?? []).map((x) => x.id);
  if (!ids.length) fallo(ruta, "No quedan correos pendientes en este envío.");
  // Se "reservan" antes de enviar para que un doble clic no los mande dos veces.
  const { data: reservados } = await db.from("correos_cola").update({ estado: "enviando" }).in("id", ids).eq("estado", "pendiente").select("id,email,nombre");
  const lote = reservados ?? [];
  if (!lote.length) fallo(ruta, "Esos correos ya se estaban enviando. Recarga la página.");

  const { data: bajas } = await db.from("correos_bajas").select("email").in("email", lote.map((l) => l.email));
  const baja = new Set((bajas ?? []).map((b) => String(b.email).toLowerCase()));
  const aEnviar = lote.filter((l) => !baja.has(l.email.toLowerCase()));
  const omitidos = lote.filter((l) => baja.has(l.email.toLowerCase()));
  if (omitidos.length) await db.from("correos_cola").update({ estado: "fallido", error: "Pidió la baja" }).in("id", omitidos.map((o) => o.id));

  const err = aEnviar.length ? await enviarLote(env.asunto, env.mensaje, aEnviar.map((l) => ({ email: l.email, nombre: l.nombre ?? "" }))) : null;
  const idsEnv = aEnviar.map((l) => l.id);
  if (err) {
    if (idsEnv.length) await db.from("correos_cola").update({ estado: "pendiente", error: err.slice(0, 300) }).in("id", idsEnv);
    fallo(ruta, "No se envió la tanda: " + err);
  }
  if (idsEnv.length) await db.from("correos_cola").update({ estado: "enviado", enviado_at: new Date().toISOString(), error: null }).in("id", idsEnv);
  await registrar("correo_masivo", id, "Envió una tanda de " + idsEnv.length + " correos («" + env.asunto + "»)");
  revalidatePath(RUTA);
  aviso(ruta, "Se enviaron " + idsEnv.length + " correos.");
}

export async function enviarPrueba(f: FormData) {
  const { p } = await admin();
  const asunto = String(f.get("asunto") ?? "").trim().slice(0, 150);
  const mensaje = String(f.get("mensaje") ?? "").trim().slice(0, 8000);
  if (!asunto || !mensaje) fallo(RUTA, "Escribe el asunto y el mensaje para enviarte la prueba.");
  const err = await enviarLote("[Prueba] " + asunto, mensaje, [{ email: p.email, nombre: p.nombre ?? "" }]);
  if (err) fallo(RUTA, "No se pudo enviar la prueba: " + err);
  aviso(RUTA, "Te enviamos una prueba a " + p.email + " (cuenta para el tope diario de Resend).");
}

export async function eliminarEnvio(f: FormData) {
  const { db } = await admin();
  const id = String(f.get("envio") ?? "");
  await db.from("correos_envios").delete().eq("id", id);
  await registrar("correo_masivo", id, "Eliminó un envío");
  revalidatePath(RUTA);
  aviso(RUTA, "Envío eliminado.");
}
