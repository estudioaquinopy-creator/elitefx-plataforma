import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export function fallo(ruta: string, msg: string): never {
  redirect(ruta + (ruta.includes("?") ? "&" : "?") + "error=" + encodeURIComponent(msg));
}

export function aviso(ruta: string, msg: string): never {
  redirect(ruta + (ruta.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent(msg));
}

// Sube una imagen al almacenamiento y devuelve su enlace público (o null si no se eligió archivo).
export async function subirImagen(file: FormDataEntryValue | null, ruta: string, bucket = "portadas"): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  if (!file.type.startsWith("image/")) fallo(ruta, "El archivo debe ser una imagen.");
  if (file.size > 5 * 1024 * 1024) fallo(ruta, "La imagen pesa más de 5 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const nombre = crypto.randomUUID() + "." + (ext || "jpg");
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(nombre, file, { contentType: file.type });
  if (error) fallo(ruta, "No se pudo subir la imagen: " + error.message);
  return supabase.storage.from(bucket).getPublicUrl(nombre).data.publicUrl;
}
