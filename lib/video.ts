import { youtubeId } from "@/lib/youtube";

// Vimeo: vimeo.com/123456789, vimeo.com/123456789/abcdef1234 (privado), player.vimeo.com/video/123456789?h=abcdef1234
export function vimeoInfo(url: string): { id: string; h: string } | null {
  const u = (url || "").trim();
  const m = u.match(/vimeo\.com\/(?:video\/|manage\/videos\/)?(\d+)(?:\/([a-f0-9]+))?/i);
  if (!m) return null;
  const h = m[2] || (u.match(/[?&]h=([a-f0-9]+)/i)?.[1] ?? "");
  return { id: m[1], h };
}

// Dirección del reproductor incrustado (Vimeo o YouTube) o null si el enlace no es válido.
export function embedUrl(url: string, extra = ""): string | null {
  const v = vimeoInfo(url);
  if (v) return "https://player.vimeo.com/video/" + v.id + "?" + (v.h ? "h=" + v.h + "&" : "") + "dnt=1&title=0&byline=0&portrait=0&pip=0" + extra;
  const y = youtubeId(url);
  if (y) return "https://www.youtube-nocookie.com/embed/" + y + "?rel=0&modestbranding=1" + extra;
  return null;
}

export const esVideoValido = (url: string) => embedUrl(url) !== null;
