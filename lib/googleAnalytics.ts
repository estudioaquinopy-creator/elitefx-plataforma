// Google Analytics 4. El ID de medición (G-XXXXXXXXXX) va en la variable de entorno
// NEXT_PUBLIC_GA_ID de Vercel. Si no está, no se carga nada y nada se rompe.
export const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || "").trim();

// Solo acepta IDs con forma de GA4, para no inyectar texto raro en el script.
export const GA_ACTIVO = /^G-[A-Z0-9]{4,20}$/.test(GA_ID);

// Código oficial de gtag.js, sin page_view automático: lo envía components/GoogleAnalytics.tsx
// en la primera carga y en cada cambio de ruta (Next.js navega sin recargar).
export const SCRIPT_GA = `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());
gtag('config','${GA_ID}',{send_page_view:false});`;

// Solo en el navegador.
export function enviarEventoGA(evento: string, datos: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !GA_ACTIVO) return;
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag === "function") gtag("event", evento, datos);
  } catch {}
}
