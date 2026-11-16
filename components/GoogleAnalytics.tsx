"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { GA_ACTIVO, enviarEventoGA } from "@/lib/googleAnalytics";
import { WHATSAPP_VENTAS } from "@/lib/sorpresa";

// El script de gtag.js se carga en <head> (app/layout.tsx). Aquí se envía:
// - page_view en la primera carga y en cada cambio de ruta.
// - generate_lead al tocar cualquier enlace de WhatsApp de ventas (wa.me/WHATSAPP_VENTAS).
// (sign_up lo envía app/registro/page.tsx al crear la cuenta.)
export default function GoogleAnalytics() {
  const ruta = usePathname();

  useEffect(() => {
    if (!GA_ACTIVO) return;
    enviarEventoGA("page_view", {
      page_path: ruta,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [ruta]);

  useEffect(() => {
    if (!GA_ACTIVO) return;
    const alTocar = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      const href = a?.getAttribute("href") || "";
      if (!href.includes("wa.me/" + WHATSAPP_VENTAS)) return;
      enviarEventoGA("generate_lead", { link_text: (a?.textContent || "WhatsApp ventas").trim().slice(0, 80) });
    };
    document.addEventListener("click", alTocar, true);
    return () => document.removeEventListener("click", alTocar, true);
  }, []);

  return null;
}
