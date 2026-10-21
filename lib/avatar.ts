import { createClient } from "@/lib/supabase/client";

// Recorta al centro en cuadrado, reduce a 256 px y comprime a JPEG: la foto queda en ~15–30 KB.
export async function procesarAvatar(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const lado = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, 256, 256);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.8));
  if (!blob) throw new Error("No se pudo procesar la imagen.");
  return blob;
}

// Sube (reemplaza) la foto de la persona y guarda su enlace en el perfil. Devuelve el enlace público.
export async function subirAvatar(uid: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  const blob = await procesarAvatar(file);
  const sb = createClient();
  const ruta = uid + "/avatar.jpg";
  const { error } = await sb.storage.from("avatares").upload(ruta, blob, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
  const url = sb.storage.from("avatares").getPublicUrl(ruta).data.publicUrl + "?v=" + Date.now();
  const { error: e2 } = await sb.from("perfiles").update({ avatar_url: url }).eq("id", uid);
  if (e2) throw new Error(e2.message);
  return url;
}
