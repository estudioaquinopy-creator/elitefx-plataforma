import { vimeoInfo } from "@/lib/video";
import { youtubeId } from "@/lib/youtube";

// Dirección de la miniatura de un video (YouTube o Vimeo), o null si no se puede obtener.
// Vimeo no publica miniaturas con una dirección fija: se consulta su oEmbed desde el servidor (con el dominio de la plataforma
// como referencia, por si el video está restringido a dominios) y se guarda en caché un día.
export async function miniatura(url: string): Promise<string | null> {
  const y = youtubeId(url);
  if (y) return "https://img.youtube.com/vi/" + y + "/hqdefault.jpg";
  const v = vimeoInfo(url);
  if (!v) return null;
  try {
    const enlace = "https://vimeo.com/" + v.id + (v.h ? "/" + v.h : "");
    const r = await fetch("https://vimeo.com/api/oembed.json?width=640&url=" + encodeURIComponent(enlace), {
      headers: { Referer: "https://academia.elitefx.com.py/" },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { thumbnail_url?: string };
    return j.thumbnail_url ? j.thumbnail_url.replace(/_\d+x\d+/, "_640") : null;
  } catch {
    return null;
  }
}
