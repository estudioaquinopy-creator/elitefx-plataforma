"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo, subirImagen } from "@/lib/subida";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
}

const CLAVES_PORTADA = ["portada_calendario", "portada_tutoriales"];
const CLAVES_TEXTO = [
  "aliados_broker_url", "aliados_broker_desc", "aliados_tarjeta_url", "aliados_tarjeta_desc",
  "aliados_video", "aliados_legal", "zoom_general",
];

export async function guardarPortada(f: FormData) {
  await soloAdmin();
  const clave = String(f.get("clave") ?? "");
  const ruta = String(f.get("ruta") ?? "/inicio");
  if (!CLAVES_PORTADA.includes(clave)) return;
  const url = f.get("quitar") === "1" ? "" : await subirImagen(f.get("portada"), ruta);
  if (url === null) fallo(ruta, "Elige una imagen primero.");
  const { error } = await createClient().from("ajustes").upsert({ clave, valor: url });
  if (error) fallo(ruta, "No se pudo guardar la portada: " + error.message);
  revalidatePath(ruta);
  revalidatePath("/", "layout");
}

export async function guardarTextos(f: FormData) {
  await soloAdmin();
  const ruta = String(f.get("ruta") ?? "/inicio");
  const filas = CLAVES_TEXTO.filter((k) => f.has(k)).map((k) => ({ clave: k, valor: String(f.get(k) ?? "").trim() }));
  const { error } = await createClient().from("ajustes").upsert(filas);
  if (error) fallo(ruta, "No se pudo guardar: " + error.message);
  revalidatePath(ruta);
}
