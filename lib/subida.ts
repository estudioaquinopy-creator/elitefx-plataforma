import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TIPOS_IMAGEN } from "@/lib/seguridad";

export function fallo(ruta: string, msg: string): never {
  redirect(ruta + (ruta.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(msg));
}

export function aviso(ruta: string, msg: string): never {
  redirect(ruta + (ruta.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent(msg));
}

// Sube una imagen al almacenamiento y devuelve su enlace público (o null si no se eligió archivo).
export async function subirImagen(file: FormDataEntryValue | null, ruta: string, bucket = "portadas"): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!TIPOS_IMAGEN.includes(file.type)) fallo(ruta, "El archivo debe ser una imagen JPG, PNG, WEBP o GIF.");
  if (file.size > 5 * 1024 * 1024) fallo(ruta, "La imagen pesa más de 5 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const nombre = crypto.randomUUID() + "." + (ext || "jpg");
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(nombre, file, { contentType: file.type });
  if (error) fallo(ruta, "No se pudo subir la imagen: " + error.message);
  return supabase.storage.from(bucket).getPublicUrl(nombre).data.publicUrl;
}

// Sube varias imágenes (hasta `max`) y devuelve sus enlaces. No redirige: si algo falla devuelve el mensaje en `error`
// (sirve tanto para publicar, que redirige con el aviso, como para responder, que muestra el error en la misma caja).
export async function subirVarias(archivos: FormDataEntryValue[], bucket = "comunidad", max = 3): Promise<{ urls: string[]; error?: string }> {
  const files = archivos.filter((x): x is File => x instanceof File && x.size > 0);
  if (!files.length) return { urls: [] };
  if (files.length > max) return { urls: [], error: "Máximo " + max + " imágenes." };
  let total = 0;
  for (const file of files) {
    if (!TIPOS_IMAGEN.includes(file.type)) return { urls: [], error: "Los archivos deben ser imágenes JPG, PNG, WEBP o GIF." };
    if (file.size > 5 * 1024 * 1024) return { urls: [], error: "Una imagen pesa más de 5 MB." };
    total += file.size;
  }
  if (total > 4.4 * 1024 * 1024) return { urls: [], error: "Las imágenes pesan demasiado juntas. Usa menos o más livianas." };
  const supabase = createClient();
  const subidas: string[] = [];
  try {
    for (const file of files) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const nombre = crypto.randomUUID() + "." + (ext || "jpg");
      const { error } = await supabase.storage.from(bucket).upload(nombre, file, { contentType: file.type });
      if (error) { if (subidas.length) await supabase.storage.from(bucket).remove(subidas); return { urls: [], error: "No se pudo subir la imagen: " + error.message }; }
      subidas.push(nombre);
    }
  } catch {
    if (subidas.length) await supabase.storage.from(bucket).remove(subidas).catch(() => {});
    return { urls: [], error: "No se pudo subir la imagen. Prueba con una más liviana o sin imagen." };
  }
  return { urls: subidas.map((n) => supabase.storage.from(bucket).getPublicUrl(n).data.publicUrl) };
}
