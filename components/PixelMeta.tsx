"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { PIXEL_ID, enviarEventoMeta } from "@/lib/metaPixel";
import { WHATSAPP_VENTAS } from "@/lib/sorpresa";

// El script del píxel se carga en <head> (app/layout.tsx). Aquí se envía:
// - PageView en la primera carga y en cada cambio de ruta (Next.js navega sin recargar).
// - Lead al tocar cualquier enlace de WhatsApp de ventas (wa.me/WHATSAPP_VENTAS).
// Cada evento sale por el navegador y por la API de conversiones con el mismo event_id.
export default function PixelMeta() {
  const ruta = usePathname();

  useEffect(() => {
    enviarEventoMeta("PageView");
  }, [ruta]);

  useEffect(() => {
    const alTocar = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href") || "";
      if (!href.includes("wa.me/" + WHATSAPP_VENTAS)) return;
      enviarEventoMeta("Lead", { content_name: (a?.textContent || "WhatsApp ventas").trim().slice(0, 80) });
    };
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        alt=""
        src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
      />
    </noscript>
  );
}
