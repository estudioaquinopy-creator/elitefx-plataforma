"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { registrar } from "@/lib/auditoria";
import { fallo, aviso } from "@/lib/subida";
import { HORAS, TEMAS } from "@/lib/visitas";

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
  const sb = createClient();
  const { data: v } = await sb.from("visitas").select("user_id, fecha, hora").eq("id", id).maybeSingle();
  const vis = v as { user_id: string; fecha: string; hora: string } | null;
  if (!vis) fallo("/visitas", "No se encontró la solicitud.");
  const estado = decision === "aprobar" ? "aprobada" : "rechazada";
  const { error } = await sb.from("visitas").update({ estado, nota, revisado_at: new Date().toISOString(), revisado_por: yo.id }).eq("id", id);
  if (error) fallo("/visitas", error.code === "23505" ? "Ese horario ya está aprobado para otra persona." : "No se pudo guardar: " + error.message);
  await registrar("visita", vis.user_id, (estado === "aprobada" ? "Aprobó" : "Rechazó") + " la visita del " + vis.fecha + " a las " + vis.hora.slice(0, 5) + (nota ? " (" + nota + ")" : ""));
  revalidatePath("/visitas");
  aviso("/visitas", estado === "aprobada" ? "Visita aprobada: la persona verá el aviso en sus notificaciones." : "Solicitud rechazada.");
}
