// Utilidades del navegador para preparar imágenes antes de subirlas (se usan en publicaciones y respuestas de la comunidad).
export const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_IMAGENES = 3;
export const MAX_TOTAL = 4 * 1024 * 1024; // el servidor (Vercel) rechaza pedidos de más de ~4,5 MB

// Reduce la foto (máx. `lado` px, JPEG) antes de subirla: sube mucho más rápido y pesa una fracción.
export async function achicar(file: File, lado = 1600, calidad = 0.82, minimo = 300 * 1024): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.size < minimo) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", calidad));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}
