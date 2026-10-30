"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { fallo, subirImagen } from "@/lib/subida";
import { normalizarInstagram } from "@/lib/redes";

async function soloAdmin() {
  const p = await perfilActual();
  if (p.rol !== "admin") throw new Error("Solo el administrador puede hacer esto.");
}

const CLAVES_PORTADA = ["portada_calendario", "portada_tutoriales"];
const CLAVES_TEXTO = [
  "aliados_broker_url", "aliados_broker_desc", "aliados_tarjeta_url", "aliados_tarjeta_desc",
  "aliados_video", "aliados_legal", "zoom_general", "ranking_premio", "ranking_premios", "ranking_pts_certificado", "ranking_pts_foto", "ranking_pts_liquid", "ranking_pts_ref", "ranking_pts_ref_vip", "ranking_ref_tope", "referidos_desde",
  ...["academia", "personal"].flatMap((g) => ["instagram"].map((n) => "red_" + g + "_" + n)),
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
  const filas = CLAVES_TEXTO.filter((k) => f.has(k)).map((k) => {
    let valor = String(f.get(k) ?? "").trim();
    if (k.endsWith("_instagram")) {
      const ok = normalizarInstagram(valor);
      if (ok === null) fallo(ruta, "El enlace de Instagram no es válido. Debe ser como https://www.instagram.com/tu_usuario");
      valor = ok;
    }
    return { clave: k, valor };
  });
  const { error } = await createClient().from("ajustes").upsert(filas);
  if (error) fallo(ruta, "No se pudo guardar: " + error.message);
  revalidatePath(ruta);
  revalidatePath("/", "layout");
}
