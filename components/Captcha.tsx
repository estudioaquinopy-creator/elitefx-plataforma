"use client";
import { useEffect, useRef } from "react";

// Verificación de seguridad (Cloudflare Turnstile, gratis). Solo aparece si la variable NEXT_PUBLIC_TURNSTILE_SITE_KEY está puesta en Vercel;
// sin ella la pantalla funciona igual que antes. Para que Supabase la EXIJA, se activa aparte en Supabase → Authentication → Attack Protection.
const SITIO = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const CAPTCHA_ACTIVO = SITIO !== "";

type Turnstile = { render: (el: HTMLElement, o: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id?: string) => void };
declare global { interface Window { turnstile?: Turnstile } }

// `reinicio`: súmale 1 para pedir una verificación nueva (cada código sirve una sola vez, por ejemplo tras un intento fallido).
export default function Captcha({ onToken, reinicio = 0 }: { onToken: (t: string) => void; reinicio?: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const idw = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!CAPTCHA_ACTIVO) return;
    let vivo = true;
    const montar = () => {
      if (!vivo || !caja.current || !window.turnstile || idw.current) return;
      idw.current = window.turnstile.render(caja.current, {
        sitekey: SITIO,
        theme: "auto",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
    };
    if (window.turnstile) montar();
    else {
      let s = document.getElementById("turnstile-js") as HTMLScriptElement | null;
      if (!s) {
        s = document.createElement("script");
        s.id = "turnstile-js";
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", montar);
    }
    return () => {
      vivo = false;
      if (idw.current && window.turnstile) { try { window.turnstile.remove(idw.current); } catch { /* ya no existe */ } }
      idw.current = undefined;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reinicio > 0 && idw.current && window.turnstile) { onToken(""); window.turnstile.reset(idw.current); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reinicio]);

  if (!CAPTCHA_ACTIVO) return null;
  return <div ref={caja} style={{ margin: "4px 0 12px", minHeight: 65 }} />;
}
