// Devuelve el ID de un enlace de YouTube (watch, youtu.be, embed, shorts) o null.
export function youtubeId(url: string): string | null {
  const m = (url || "").trim().match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
