"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo } from "@/lib/subida";

export async function guardarOperacion(f: FormData) {
  const perfil = await perfilActual();
  const par = String(f.get("par") ?? "").trim().toUpperCase();
  const direccion = String(f.get("direccion") ?? "");
  const fecha = String(f.get("fecha") ?? "");
  const resultado = Number(String(f.get("resultado") ?? "").replace(",", "."));
  if (!par) fallo("/journal", "Elige o escribe el par.");
  if (!["compra", "venta"].includes(direccion)) fallo("/journal", "Elige la dirección.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) fallo("/journal", "Elige la fecha.");
  if (!Number.isFinite(resultado)) fallo("/journal", "El resultado debe ser un número (negativo si perdiste).");
  const { error } = await createClient().from("operaciones").insert({
    user_id: perfil.id, fecha, par, direccion, resultado, notas: String(f.get("notas") ?? "").trim(),
  });
  if (error) fallo("/journal", "No se pudo guardar: " + error.message);
  revalidatePath("/journal");
  redirect("/journal");
}

export async function borrarOperacion(f: FormData) {
  const perfil = await perfilActual();
  await createClient().from("operaciones").delete().eq("id", String(f.get("id") ?? "")).eq("user_id", perfil.id);
  revalidatePath("/journal");
  redirect("/journal");
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
export async function importarOperaciones(filas: OpImp[]): Promise<ResImp> {
  const perfil = await perfilActual();
  if (!Array.isArray(filas) || filas.length === 0) return { ok: false, nuevas: 0, repetidas: 0, error: "No hay operaciones para guardar." };
  if (filas.length > 1000) return { ok: false, nuevas: 0, repetidas: 0, error: "Demasiadas operaciones en un solo envío." };
  const filasOk: Record<string, unknown>[] = [];
  for (const o of filas) {
    const ticket = String(o?.ticket ?? "").trim().slice(0, 40);
    const par = String(o?.par ?? "").trim().toUpperCase().slice(0, 30);
    const cierre = o?.cierre && RE_TS.test(o.cierre) ? o.cierre : null;
    const apertura = o?.apertura && RE_TS.test(o.apertura) ? o.apertura : null;
    const dia = (cierre || apertura || "").slice(0, 10);
    if (!ticket || !par || !["compra", "venta"].includes(o?.direccion) || !fin(o?.resultado) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) continue;
    filasOk.push({
      user_id: perfil.id, ticket, origen: "mt5", par, direccion: o.direccion, fecha: dia,
      resultado: o.resultado, comision: fin(o.comision) ? o.comision : 0, swap: fin(o.swap) ? o.swap : 0,
      volumen: fin(o.volumen) ? o.volumen : null, apertura, cierre,
      precio_ap: fin(o.precio_ap) ? o.precio_ap : null, precio_ci: fin(o.precio_ci) ? o.precio_ci : null,
    });
  }
  if (!filasOk.length) return { ok: false, nuevas: 0, repetidas: 0, error: "Ninguna operación tiene datos válidos." };
  const { data, error } = await createClient().from("operaciones").upsert(filasOk, { onConflict: "user_id,ticket", ignoreDuplicates: true }).select("id");
  if (error) return { ok: false, nuevas: 0, repetidas: 0, error: error.message.includes("column") || error.message.includes("ticket") ? "Falta correr la migración 0016 en Supabase." : "No se pudo guardar: " + error.message };
  revalidatePath("/journal");
  const nuevas = (data ?? []).length;
  return { ok: true, nuevas, repetidas: filasOk.length - nuevas };
}

// Borra solo lo importado desde MT5 (no toca lo que la persona anotó a mano).
export async function borrarImportadas() {
  const perfil = await perfilActual();
  await createClient().from("operaciones").delete().eq("user_id", perfil.id).eq("origen", "mt5");
  revalidatePath("/journal");
  redirect("/journal");
}
