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
  const virtual = String(f.get("modalidad") ?? "") === "virtual";
  const educador = String(f.get("educador") ?? "");
  if (virtual && !/^[0-9a-f-]{36}$/i.test(educador)) fallo("/visitas", "Elige con qué educador quieres la reunión.");
  const fila = virtual ? { user_id: yo.id, fecha, hora, tema, detalle, modalidad: "virtual", educador_id: educador } : { user_id: yo.id, fecha, hora, tema, detalle };
  const { error } = await createClient().from("visitas").insert(fila);
  if (error) fallo("/visitas", error.message.includes("visitas") && error.message.includes("does not exist") ? "La función aún no está activada." : virtual && /modalidad|educador_id/.test(error.message) ? "Las reuniones virtuales aún no están activadas." : error.message.replace(/^.*?:\s*/, ""));
  revalidatePath("/visitas");
  aviso("/visitas", virtual ? "Solicitud enviada. Cuando el educador la apruebe verás aquí el enlace de la reunión." : "Solicitud enviada. Te avisaremos cuando la aprobemos.");
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
  const enlace = String(f.get("enlace") ?? "").trim().slice(0, 300);
  const sb = createClient();
  const { data: v } = await sb.from("visitas").select("*").eq("id", id).maybeSingle();
  const vis = v as { user_id: string; fecha: string; hora: string; estado: string; modalidad?: string; educador_id?: string | null } | null;
  if (!vis) fallo("/visitas", "No se encontró la solicitud.");
  const virtual = vis!.modalidad === "virtual";
  // Al aprobar es obligatorio elegir quién recibe a la persona (un administrador); en una reunión virtual es el educador que la persona eligió.
  let encargado: { id: string; nombre: string } | null = null;
  if (decision === "aprobar") {
    const quienId = virtual ? String(vis!.educador_id ?? "") : encargadoId;
    if (!/^[0-9a-f-]{36}$/i.test(quienId)) fallo("/visitas", virtual ? "Esta reunión no tiene educador asignado." : "Elige quién va a recibir a la persona antes de aprobar.");
    if (virtual && !/^https:\/\/\S+$/i.test(enlace)) fallo("/visitas", "Pega el enlace de Google Meet (empieza con https://) antes de aprobar la reunión virtual.");
    const { data: e } = await sb.from("perfiles").select("id, nombre, rol").eq("id", quienId).maybeSingle();
    const ee = e as { id: string; nombre: string; rol: string } | null;
    if (!ee || ee.rol !== "admin") fallo("/visitas", "El encargado debe ser un administrador.");
    encargado = { id: ee!.id, nombre: ee!.nombre };
  }
  const estado = decision === "aprobar" ? "aprobada" : "rechazada";
  const { error } = await sb.from("visitas").update({ estado, nota, revisado_at: new Date().toISOString(), revisado_por: yo.id, ...(encargado ? { encargado_id: encargado.id, encargado_nombre: encargado.nombre } : {}), ...(encargado && virtual ? { enlace_meet: enlace } : {}) }).eq("id", id);
  if (error) fallo("/visitas", /cupo|ocupado|Meet|educador/i.test(error.message) ? error.message.replace(/^.*?:\s*/, "") : "No se pudo guardar: " + error.message);
  await registrar("visita", vis.user_id, (estado === "aprobada" ? "Aprobó" : "Rechazó") + (virtual ? " la reunión virtual del " : " la visita del ") + vis.fecha + " a las " + vis.hora.slice(0, 5) + (nota ? " (" + nota + ")" : "") + (encargado ? " · recibe: " + encargado.nombre : ""));
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
  const enlace = String(f.get("enlace") ?? "").trim().slice(0, 300);
  if (!/^[0-9a-f-]{36}$/i.test(id)) fallo("/visitas", "Datos no válidos.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || new Date(fecha + "T12:00:00Z").getUTCDay() !== 3) fallo("/visitas", "El nuevo día debe ser miércoles.");
  if (!HORAS.includes(hora)) fallo("/visitas", "Elige el nuevo horario.");
  if (!/^[0-9a-f-]{36}$/i.test(encargadoId)) fallo("/visitas", "Elige quién va a recibir a la persona.");
  const sb = createClient();
  const { data: e } = await sb.from("perfiles").select("id, nombre, rol").eq("id", encargadoId).maybeSingle();
  const ee = e as { id: string; nombre: string; rol: string } | null;
  if (!ee || ee.rol !== "admin") fallo("/visitas", "El encargado debe ser un administrador.");
  const { data: v } = await sb.from("visitas").select("*").eq("id", id).maybeSingle();
  const vis = v as { user_id: string; fecha: string; hora: string; estado: string; modalidad?: string } | null;
  if (!vis || vis.estado !== "pendiente") fallo("/visitas", "Solo se puede proponer otro horario a una solicitud pendiente.");
  const virtual = vis!.modalidad === "virtual";
  if (virtual && !/^https:\/\/\S+$/i.test(enlace)) fallo("/visitas", "Pega el enlace de Google Meet (empieza con https://) para la reunión que propones.");
  if (fecha === vis!.fecha && hora === vis!.hora.slice(0, 5)) fallo("/visitas", "Elige un horario distinto al que pidió la persona.");
  // Una sola agenda: el encargado no puede tener otra visita o reunión aprobada a esa hora; en la oficina, además, un solo cupo.
  const { data: ocu } = await sb.from("visitas").select("encargado_id, modalidad").eq("estado", "aprobada").eq("fecha", fecha).eq("hora", hora);
  const aprobadas = (ocu ?? []) as { encargado_id: string | null; modalidad?: string }[];
  if (aprobadas.some((x) => x.encargado_id === ee!.id)) fallo("/visitas", ee!.nombre + " ya está ocupado en ese horario.");
  if (!virtual && aprobadas.some((x) => (x.modalidad ?? "presencial") === "presencial")) fallo("/visitas", "Ese horario ya está ocupado en la oficina.");
  const { error } = await sb.from("visitas").update({
    estado: "propuesta", propuesta_fecha: fecha, propuesta_hora: hora, encargado_id: ee!.id, encargado_nombre: ee!.nombre,
    ...(virtual ? { educador_id: ee!.id, enlace_meet: enlace } : {}),
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

// Solo el administrador: marca si la visita fue atendida o no asistió, con nota interna (solo el equipo) y seguimiento pendiente.
export async function marcarResultado(f: FormData) {
  const yo = await perfilActual();
  if (yo.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  const id = String(f.get("id") ?? "");
  const resultado = String(f.get("resultado") ?? "");
  const nota = String(f.get("nota") ?? "").trim().slice(0, 600);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["atendida", "no_asistio"].includes(resultado)) fallo("/visitas", "Datos no válidos.");
  const sb = createClient();
  const { data: v } = await sb.from("visitas").select("user_id, fecha, hora, estado").eq("id", id).maybeSingle();
  const vis = v as { user_id: string; fecha: string; hora: string; estado: string } | null;
  if (!vis || vis.estado !== "aprobada") fallo("/visitas", "Solo se puede marcar una visita aprobada.");
  const { data: prev } = await sb.from("visitas_seguimiento").select("visita_id").eq("visita_id", id).maybeSingle();
  // Si no vino y es la primera vez, queda con seguimiento pendiente (para contactarla y reagendar), salvo que se desmarque.
  let pendiente = f.get("pendiente") === "on";
  if (resultado === "no_asistio" && !prev && f.get("pendiente_visto") !== "1") pendiente = true;
  const { error } = await sb.from("visitas").update({ resultado, resultado_at: new Date().toISOString(), resultado_por: yo.id }).eq("id", id);
  if (error) fallo("/visitas", error.message.includes("resultado") ? "Falta correr la migración 0065 en Supabase." : "No se pudo guardar: " + error.message);
  const { error: e2 } = await sb.from("visitas_seguimiento").upsert({ visita_id: id, nota, pendiente, updated_by: yo.id, updated_at: new Date().toISOString() });
  if (e2) fallo("/visitas", "No se pudo guardar la nota: " + e2.message);
  await registrar("visita", vis!.user_id, (resultado === "atendida" ? "Marcó como atendida" : "Marcó que no asistió") + " la visita del " + vis!.fecha + " a las " + vis!.hora.slice(0, 5) + (pendiente ? " · seguimiento pendiente" : ""));
  revalidatePath("/visitas");
  aviso("/visitas", resultado === "atendida" ? "Visita marcada como atendida." : "Visita marcada como no asistió.");
}

// La persona deja su reseña de una visita en la que fue atendida.
export async function resenarVisita(f: FormData) {
  await perfilActual();
  const id = String(f.get("id") ?? "");
  const estrellas = Number(f.get("estrellas"));
  const texto = String(f.get("texto") ?? "").trim().slice(0, 500);
  if (!/^[0-9a-f-]{36}$/i.test(id)) fallo("/visitas", "Visita no válida.");
  if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) fallo("/visitas", "Elige de 1 a 5 estrellas.");
  const { error } = await createClient().rpc("visitas_resenar", { p_id: id, p_estrellas: estrellas, p_texto: texto });
  if (error) fallo("/visitas", error.message.includes("function") ? "Falta correr la migración 0065 en Supabase." : error.message.replace(/^.*?:\s*/, ""));
  revalidatePath("/visitas");
  aviso("/visitas", "¡Gracias por tu opinión!");
}
