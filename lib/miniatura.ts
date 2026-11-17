import { youtubeId } from "@/lib/youtube";
import { vimeoInfo } from "@/lib/video";

// Miniatura (imagen) de un video de YouTube o Vimeo, o null si no se puede obtener.
// Vimeo: se pide a su API oEmbed enviando el dominio de la academia (los videos están restringidos a dominios).
export async function miniaturaVideo(url: string): Promise<string | null> {
  const y = youtubeId(url);
  if (y) return "https://img.youtube.com/vi/" + y + "/hqdefault.jpg";
  const v = vimeoInfo(url);
  if (!v) return null;
  try {
    const enlace = "https://vimeo.com/" + v.id + (v.h ? "/" + v.h : "");
    const r = await fetch("https://vimeo.com/api/oembed.json?width=640&url=" + encodeURIComponent(enlace), {
      headers: { Referer: "https://academia.elitefx.com.py/" },
      next: { revalidate: 86400 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { thumbnail_url?: string };
    return typeof j.thumbnail_url === "string" && j.thumbnail_url.startsWith("https://") ? j.thumbnail_url : null;
  } catch {
    return null;
  }
}
