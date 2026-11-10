"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { registrar } from "@/lib/auditoria";
import { fallo, aviso } from "@/lib/subida";
import { HORAS, TEMAS, horaCorta, fechaLarga } from "@/lib/visitas";

export async function agendarVisita(f: FormData) {
  const yo = await perfilActual();
  if (yo.plan === "gratis" && yo.rol !== "admin") fallo("/visitas", "Las visitas son solo para miembros VIP.");
  const fecha = String(f.get("fecha") ?? "");
  const hora = String(f.get("hora") ?? "");
  const tema = String(f.get("tema") ?? "");
  const detalle = String(f.get("detalle") ?? "").trim().slice(0, 600);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || new Date(fecha + "T12:00:00Z").getUTCDay() !== 3) fallo("/visitas", "Solo se puede agendar los miércoles.");
  if (!HORAS.includes(hora)) fallo("/visitas", "Elige un horario entre las 8:00 y las 17:00.");
  if (!TEMAS.includes(tema)) fallo("/visitas", "Elige el tema de la visita.");
  if (tema === "Otro" && detalle.length < 5) fallo("/visitas", "Cuéntanos brevemente qué quieres tratar.");
  const { error } = await createClient().from("visitas").insert({ user_id: yo.id, fecha, hora, tema, detalle });
  if (error) fallo("/visitas", error.message.includes("visitas") && error.message.includes("does not exist") ? "La función aún no está activada." : error.message.replace(/^.*?:\s*/, ""));
  revalidatePath("/visitas");
  aviso("/visitas", "Solicitud enviada. Te avisaremos cuando la aprobemos.");
}

export async function cancelarVisita(f: FormData) {
  const yo = await perfilActual();
  const id = String(f.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) fallo("/visitas", "Visita no válida.");
  const { error } = await createClient().from("visitas").update({ estado: "cancelada" }).eq("id", id).eq("user_id", yo.id);
  if (error) fallo("/visitas", "No se pudo cancelar: " + error.message);
  revalidatePath("/visitas");
  aviso("/visitas", "Visita cancelada.");
}

// Solo el administrador: aprueba o rechaza (con una nota opcional que ve la persona).
export async function revisarVisita(f: FormData) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const id = String(f.get("id") ?? "");
  const decision = String(f.get("decision") ?? "");
  const nota = String(f.get("nota") ?? "").trim().slice(0, 200);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["aprobar", "rechazar"].includes(decision)) fallo("/visitas", "Datos no válidos.");
  const encargadoId = String(f.get("encargado") ?? "");
  const sb = createClient();
  // Al aprobar es obligatorio elegir quién recibe a la persona (un administrador).
  let encargado: { id: string; nombre: string } | null = null;
  if (decision === "aprobar") {
    if (!/^[0-9a-f-]{36}$/i.test(encargadoId)) fallo("/visitas", "Elige quién va a recibir a la persona antes de aprobar.");
    const { data: e } = await sb.from("perfiles").select("id, nombre, rol").eq("id", encargadoId).maybeSingle();
    const ee = e as { id: string; nombre: string; rol: string } | null;
    if (!ee || ee.rol !== "admin") fallo("/visitas", "El encargado debe ser un administrador.");
    encargado = { id: ee!.id, nombre: ee!.nombre };
  }
  const { data: v } = await sb.from("visitas").select("user_id, fecha, hora, estado").eq("id", id).maybeSingle();
  const vis = v as { user_id: string; fecha: string; hora: string; estado: string } | null;
  if (!vis) fallo("/visitas", "No se encontró la solicitud.");
  const estado = decision === "aprobar" ? "aprobada" : "rechazada";
  const { error } = await sb.from("visitas").update({ estado, nota, revisado_at: new Date().toISOString(), revisado_por: yo.id, ...(encargado ? { encargado_id: encargado.id, encargado_nombre: encargado.nombre } : {}) }).eq("id", id);
  if (error) fallo("/visitas", error.message.includes("cupo") ? "Ese horario ya está ocupado por otra visita aprobada." :  "No se pudo guardar: " + error.message);
  await registrar("visita", vis.user_id, (estado === "aprobada" ? "Aprobó" : "Rechazó") + " la visita del " + vis.fecha + " a las " + vis.hora.slice(0, 5) + (nota ? " (" + nota + ")" : "") + (encargado ? " · recibe: " + encargado.nombre : ""));
  revalidatePath("/visitas");
  aviso("/visitas", estado === "aprobada" ? "Visita aprobada: la persona verá el aviso en sus notificaciones." : "Solicitud rechazada.");
}

// Solo el administrador: propone otro día/hora (y quién recibe) a una solicitud pendiente. La persona debe aceptarlo.
export async function proponerHorario(f: FormData) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const id = String(f.get("id") ?? "");
  const fecha = String(f.get("fecha") ?? "");
  const hora = String(f.get("hora") ?? "");
  const encargadoId = String(f.get("encargado") ?? "");
  const nota = String(f.get("nota") ?? "").trim().slice(0, 200);
  if (!/^[0-9a-f-]{36}$/i.test(id)) fallo("/visitas", "Datos no válidos.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || new Date(fecha + "T12:00:00Z").getUTCDay() !== 3) fallo("/visitas", "El nuevo día debe ser miércoles.");
  if (!HORAS.includes(hora)) fallo("/visitas", "Elige el nuevo horario.");
  if (!/^[0-9a-f-]{36}$/i.test(encargadoId)) fallo("/visitas", "Elige quién va a recibir a la persona.");
  const sb = createClient();
  const { data: e } = await sb.from("perfiles").select("id, nombre, rol").eq("id", encargadoId).maybeSingle();
  const ee = e as { id: string; nombre: string; rol: string } | null;
  if (!ee || ee.rol !== "admin") fallo("/visitas", "El encargado debe ser un administrador.");
  const { data: v } = await sb.from("visitas").select("user_id, fecha, hora, estado").eq("id", id).maybeSingle();
  const vis = v as { user_id: string; fecha: string; hora: string; estado: string } | null;
  if (!vis || vis.estado !== "pendiente") fallo("/visitas", "Solo se puede proponer otro horario a una solicitud pendiente.");
  if (fecha === vis!.fecha && hora === vis!.hora.slice(0, 5)) fallo("/visitas", "Elige un horario distinto al que pidió la persona.");
  const { count } = await sb.from("visitas").select("id", { count: "exact", head: true }).eq("estado", "aprobada").eq("fecha", fecha).eq("hora", hora);
  if ((count ?? 0) > 0) fallo("/visitas", "Ese horario ya está ocupado por otra visita aprobada.");
  const { error } = await sb.from("visitas").update({
    estado: "propuesta", propuesta_fecha: fecha, propuesta_hora: hora, encargado_id: ee!.id, encargado_nombre: ee!.nombre,
    nota, revisado_at: new Date().toISOString(), revisado_por: yo.id,
  }).eq("id", id).eq("estado", "pendiente");
  if (error) fallo("/visitas", "No se pudo guardar: " + error.message);
  await registrar("visita", vis!.user_id, "Propuso otro horario: " + fecha + " a las " + horaCorta(hora) + " (pidió " + vis!.fecha + " " + vis!.hora.slice(0, 5) + ") · recibe: " + ee!.nombre);
  revalidatePath("/visitas");
  aviso("/visitas", "Propuesta enviada: la persona verá el aviso y deberá aceptar el nuevo horario (" + fechaLarga(fecha) + " a las " + horaCorta(hora) + ").");
}

// La persona acepta o rechaza el nuevo horario que le propusieron.
export async function responderPropuesta(f: FormData) {
  await perfilActual();
  const id = String(f.get("id") ?? "");
  const acepta = String(f.get("decision") ?? "") === "aceptar";
  if (!/^[0-9a-f-]{36}$/i.test(id)) fallo("/visitas", "Visita no válida.");
  const { error } = await createClient().rpc("visitas_responder", { p_id: id, p_acepta: acepta });
  if (error) fallo("/visitas", error.message.replace(/^.*?:\s*/, ""));
  revalidatePath("/visitas");
  aviso("/visitas", acepta ? "¡Listo! Aceptaste el nuevo horario: tu visita quedó aprobada." : "Rechazaste el nuevo horario. Puedes pedir otra visita cuando quieras.");
}
