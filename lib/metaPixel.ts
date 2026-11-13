// Píxel de Meta + API de conversiones. El navegador (fbq) y el servidor (/api/meta)
// envían el MISMO evento con el mismo event_id, así Meta los cuenta una sola vez.
export const PIXEL_ID = "1042503102192540";

// Eventos que acepta /api/meta (cualquier otro se ignora).
export const EVENTOS_META = ["PageView", "CompleteRegistration", "Lead"] as const;
export type EventoMeta = (typeof EVENTOS_META)[number];

// Código oficial del píxel, sin el PageView (lo envía components/PixelMeta.tsx con su event_id).
export const SCRIPT_PIXEL = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${PIXEL_ID}');`;

type DatosPersona = { email?: string; telefono?: string; nombre?: string };

// Solo en el navegador.
export function enviarEventoMeta(evento: EventoMeta, datos: Record<string, unknown> = {}, persona: DatosPersona = {}) {
  if (typeof window === "undefined") return;
  const id = evento + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  try {
    const fbq = (window as any).fbq;
    if (typeof fbq === "function") fbq("track", evento, datos, { eventID: id });
  } catch {}
  try {
    fetch("/api/meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evento, id, url: window.location.href, datos, persona }),
      keepalive: true, // que llegue aunque la página cambie enseguida (registro, WhatsApp)
    }).catch(() => {});
  } catch {}
}
