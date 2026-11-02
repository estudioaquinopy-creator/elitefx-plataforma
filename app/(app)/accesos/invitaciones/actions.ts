"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { aviso, fallo } from "@/lib/subida";
import { registrar } from "@/lib/auditoria";

const RUTA = "/accesos/invitaciones";
const LETRAS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
  return p;
}

function entero(f: FormData, k: string, def: number, min: number, max: number): number {
  const n = Math.round(Number(String(f.get(k) ?? "").replace(",", ".")));
  return Number.isFinite(n) && n >= min && n <= max ? n : def;
}

// Crea un enlace de invitación: los que se REGISTREN con él antes de que venza reciben VIP por unos días.
export async function crearInvitacionPrueba(f: FormData) {
  const yo = await soloAdmin();
  const dias = entero(f, "dias", 5, 1, 30);
  const horas = entero(f, "horas", 24, 1, 168);
  const cupo = entero(f, "cupo", 100, 1, 1000);
  const nota = String(f.get("nota") ?? "").trim().slice(0, 120);
  const arr = crypto.getRandomValues(new Uint8Array(8));
  const codigo = Array.from(arr, (b) => LETRAS[b % LETRAS.length]).join("");
  const { error } = await createClient().from("invitaciones_prueba").insert({
    codigo, dias, cupo, nota, creado_por: yo.id, expira_at: new Date(Date.now() + horas * 3600000).toISOString(),
  });
  if (error) fallo(RUTA, "No se pudo crear (¿corriste la migración 0039?): " + error.message);
  await registrar("invitacion_prueba", null, "Creó la invitación " + codigo + ": " + dias + " días de VIP, " + horas + " h de vigencia, tope " + cupo + " personas");
  revalidatePath(RUTA);
  aviso(RUTA, "Invitación creada. Copia el enlace y compártelo.");
}

export async function cerrarInvitacionPrueba(f: FormData) {
  await soloAdmin();
  const id = String(f.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) fallo(RUTA, "Invitación no válida.");
  const { error } = await createClient().from("invitaciones_prueba").update({ activa: false }).eq("id", id);
  if (error) fallo(RUTA, "No se pudo desactivar: " + error.message);
  await registrar("invitacion_prueba", null, "Desactivó una invitación de prueba");
  revalidatePath(RUTA);
  aviso(RUTA, "Invitación desactivada: el enlace ya no sirve.");
}
