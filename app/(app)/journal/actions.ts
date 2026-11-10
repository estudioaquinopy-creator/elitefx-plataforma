"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo } from "@/lib/subida";
import { EMOCIONES, SESIONES } from "@/lib/journal";

const RE_ID = /^[0-9a-f-]{36}$/i;
const rutaCuenta = (id: string) => (RE_ID.test(id) ? "/journal?c=" + id : "/journal");

// Crea una cuenta del journal (cada una tiene sus propias operaciones, capital y estadísticas).
export async function crearCuenta(f: FormData) {
  const perfil = await perfilActual();
  const nombre = String(f.get("nombre") ?? "").trim().slice(0, 40);
  const capital = Number(String(f.get("capital") ?? "").replace(/\s/g, "").replace(",", ".") || "0");
  if (!nombre) fallo("/journal", "Ponle un nombre a la cuenta (por ejemplo: FTMO, Capital propio, Demo).");
  if (!Number.isFinite(capital) || capital < 0) fallo("/journal", "El capital inicial debe ser un número positivo.");
  const sb = createClient();
  const { count, error: e0 } = await sb.from("journal_cuentas").select("id", { count: "exact", head: true }).eq("user_id", perfil.id);
  if (e0) fallo("/journal", e0.message.includes("journal_cuentas") ? "Falta correr la migración 0059 en Supabase." : "No se pudo crear: " + e0.message);
  if ((count ?? 0) >= 10) fallo("/journal", "Puedes tener hasta 10 cuentas. Elimina una que no uses para crear otra.");
  const { data, error } = await sb.from("journal_cuentas").insert({ user_id: perfil.id, nombre, capital_inicial: capital }).select("id").single();
  if (error || !data) fallo("/journal", "No se pudo crear la cuenta: " + (error?.message ?? ""));
  revalidatePath("/journal");
  redirect(rutaCuenta((data as { id: string }).id));
}

// Elimina la cuenta y todas sus operaciones (no se puede deshacer).
export async function eliminarCuenta(f: FormData) {
  const perfil = await perfilActual();
  const id = String(f.get("cuenta") ?? "");
  if (!RE_ID.test(id)) fallo("/journal", "Cuenta no válida.");
  const { error } = await createClient().from("journal_cuentas").delete().eq("id", id).eq("user_id", perfil.id);
  if (error) fallo("/journal", "No se pudo eliminar: " + error.message);
  revalidatePath("/journal");
  redirect("/journal");
}

export async function renombrarCuenta(f: FormData) {
  const perfil = await perfilActual();
  const id = String(f.get("cuenta") ?? "");
  const nombre = String(f.get("nombre") ?? "").trim().slice(0, 40);
  if (!RE_ID.test(id)) fallo("/journal", "Cuenta no válida.");
  if (!nombre) fallo(String(f.get("volver") ?? "") === "lista" ? "/journal" : rutaCuenta(id), "El nombre no puede quedar vacío.");
  const desdeLista = String(f.get("volver") ?? "") === "lista";
  const { error } = await createClient().from("journal_cuentas").update({ nombre }).eq("id", id).eq("user_id", perfil.id);
  if (error) fallo(desdeLista ? "/journal" : rutaCuenta(id), "No se pudo cambiar el nombre: " + error.message);
  revalidatePath("/journal");
  if (desdeLista) redirect("/journal?ok=" + encodeURIComponent("Nombre actualizado."));
  redirect(rutaCuenta(id));
}

export async function guardarOperacion(f: FormData) {
  const perfil = await perfilActual();
  const cuenta = String(f.get("cuenta") ?? "");
  const ruta = rutaCuenta(cuenta);
  const par = String(f.get("par") ?? "").trim().toUpperCase();
  const direccion = String(f.get("direccion") ?? "");
  const fecha = String(f.get("fecha") ?? "");
  const resultado = Number(String(f.get("resultado") ?? "").replace(",", "."));
  if (!par) fallo(ruta, "Elige o escribe el par.");
  if (!["compra", "venta"].includes(direccion)) fallo(ruta, "Elige la dirección.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fallo(ruta, "Elige la fecha.");
  if (!Number.isFinite(resultado)) fallo(ruta, "El resultado debe ser un número (negativo si perdiste).");
  const opc = (k: string) => { const t = String(f.get(k) ?? "").trim().replace(",", "."); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
  const fila: Record<string, unknown> = {
    user_id: perfil.id, ...(RE_ID.test(cuenta) ? { cuenta_id: cuenta } : {}), fecha, par, direccion, resultado, notas: String(f.get("notas") ?? "").trim(),
  };
  // Los datos opcionales solo se envían si se completaron.
  const lotes = opc("volumen"), pa = opc("precio_ap"), pc = opc("precio_ci");
  if (lotes != null && lotes >= 0) fila.volumen = lotes;
  if (pa != null) fila.precio_ap = pa;
  if (pc != null) fila.precio_ci = pc;
  const sesion = String(f.get("sesion") ?? "");
  if (SESIONES.includes(sesion)) fila.sesion = sesion;
  const emocion = String(f.get("emocion") ?? "");
  if (EMOCIONES.includes(emocion)) fila.emocion = emocion;
  const setup = String(f.get("setup") ?? "").trim().slice(0, 60);
  if (setup) fila.setup = setup;
  const plan = String(f.get("respeto_plan") ?? "");
  if (plan === "si") fila.respeto_plan = true;
  if (plan === "no") fila.respeto_plan = false;
  const { error } = await createClient().from("operaciones").insert(fila);
  if (error) fallo(ruta, error.message.includes("column") ? "Falta correr la migración 0017 en Supabase para guardar estos datos." : "No se pudo guardar: " + error.message);
  revalidatePath("/journal");
  redirect(ruta);
}

export async function borrarOperacion(f: FormData) {
  const perfil = await perfilActual();
  await createClient().from("operaciones").delete().eq("id", String(f.get("id") ?? "")).eq("user_id", perfil.id);
  revalidatePath("/journal");
  redirect(rutaCuenta(String(f.get("cuenta") ?? "")));
}

export type OpImp = {
  ticket: string; par: string; direccion: "compra" | "venta"; volumen: number | null;
  apertura: string | null; cierre: string | null; precio_ap: number | null; precio_ci: number | null;
  comision: number; swap: number; resultado: number;
};
export type ResImp = { ok: boolean; nuevas: number; repetidas: number; error?: string };

const RE_TS = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const fin = (x: unknown) => typeof x === "number" && Number.isFinite(x);

// Guarda las operaciones leídas del reporte de MT5. Las que ya estaban (mismo ticket) se omiten.
export async function importarOperaciones(filas: OpImp[], cuentaId?: string): Promise<ResImp> {
  const perfil = await perfilActual();
  if (!Array.isArray(filas) || filas.length === 0) return { ok: false, nuevas: 0, repetidas: 0, error: "No hay operaciones para guardar." };
  if (filas.length > 1000) return { ok: false, nuevas: 0, repetidas: 0, error: "Demasiadas operaciones en un solo envío." };
  const cuenta = RE_ID.test(cuentaId ?? "") ? cuentaId! : "";
  const filasOk: Record<string, unknown>[] = [];
  for (const o of filas) {
    const ticket = String(o?.ticket ?? "").trim().slice(0, 40);
    const par = String(o?.par ?? "").trim().toUpperCase().slice(0, 30);
    const cierre = o?.cierre && RE_TS.test(o.cierre) ? o.cierre : null;
    const apertura = o?.apertura && RE_TS.test(o.apertura) ? o.apertura : null;
    const dia = (cierre || apertura || "").slice(0, 10);
    if (!ticket || !par || !["compra", "venta"].includes(o?.direccion) || !fin(o?.resultado) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
    filasOk.push({
      user_id: perfil.id, ...(cuenta ? { cuenta_id: cuenta } : {}), ticket, origen: "mt5", par, direccion: o.direccion, fecha: dia,
      resultado: o.resultado, comision: fin(o.comision) ? o.comision : 0, swap: fin(o.swap) ? o.swap : 0,
      volumen: fin(o.volumen) ? o.volumen : null, apertura, cierre,
      precio_ap: fin(o.precio_ap) ? o.precio_ap : null, precio_ci: fin(o.precio_ci) ? o.precio_ci : null,
    });
  }
  if (!filasOk.length) return { ok: false, nuevas: 0, repetidas: 0, error: "Ninguna operación tiene datos válidos." };
  const { data, error } = await createClient().from("operaciones").upsert(filasOk, { onConflict: cuenta ? "cuenta_id,ticket" : "user_id,ticket", ignoreDuplicates: true }).select("id");
  if (error) return { ok: false, nuevas: 0, repetidas: 0, error: error.message.includes("column") || error.message.includes("ticket") ? "Falta correr la migración 0016 en Supabase." : "No se pudo guardar: " + error.message };
  revalidatePath("/journal");
  const nuevas = (data ?? []).length;
  return { ok: true, nuevas, repetidas: filasOk.length - nuevas };
}

// Borra solo lo importado desde MT5 (no toca lo que la persona anotó a mano).
export async function borrarImportadas(f: FormData) {
  const perfil = await perfilActual();
  const cuenta = String(f.get("cuenta") ?? "");
  let q = createClient().from("operaciones").delete().eq("user_id", perfil.id).eq("origen", "mt5");
  if (RE_ID.test(cuenta)) q = q.eq("cuenta_id", cuenta);
  await q;
  revalidatePath("/journal");
  redirect(rutaCuenta(cuenta));
}

// Capital inicial de la cuenta: es la base de todos los porcentajes del Journal.
export async function guardarCapital(f: FormData) {
  const perfil = await perfilActual();
  const cuenta = String(f.get("cuenta") ?? "");
  const ruta = rutaCuenta(cuenta);
  const capital = Number(String(f.get("capital") ?? "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(capital) || capital < 0) fallo(ruta, "El capital inicial debe ser un número positivo.");
  if (RE_ID.test(cuenta)) {
    const { error } = await createClient().from("journal_cuentas").update({ capital_inicial: capital }).eq("id", cuenta).eq("user_id", perfil.id);
    if (error) fallo(ruta, "No se pudo guardar: " + error.message);
  } else {
    const { error } = await createClient().from("journal_config").upsert({ user_id: perfil.id, capital_inicial: capital });
    if (error) fallo(ruta, error.message.includes("journal_config") ? "Falta correr la migración 0018 en Supabase." : "No se pudo guardar: " + error.message);
  }
  revalidatePath("/journal");
  redirect(ruta);
}
