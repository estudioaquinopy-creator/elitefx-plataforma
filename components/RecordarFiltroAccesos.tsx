"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const CLAVE = "accesos_filtro";

// Recuerda el filtro de Accesos (búsqueda, estado, cuenta y página) en este navegador:
// al volver desde la ficha de una persona se aplica solo, hasta que se toque "Limpiar filtro".
export default function RecordarFiltroAccesos() {
  const router = useRouter();
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get("limpiar")) {
        localStorage.removeItem(CLAVE);
        router.replace("/accesos");
        return;
      }
      const hayFiltro = ["q", "e", "c", "p"].some((k) => p.has(k));
      if (hayFiltro) {
        const g = new URLSearchParams();
        for (const k of ["q", "e", "c", "p"]) { const v = p.get(k); if (v) g.set(k, v); }
        const s = g.toString();
        if (s) localStorage.setItem(CLAVE, s); else localStorage.removeItem(CLAVE);
        return;
      }
      const guardado = localStorage.getItem(CLAVE);
      if (guardado) {
        const g = new URLSearchParams(guardado);
        for (const k of ["ok", "error"]) { const v = p.get(k); if (v) g.set(k, v); }
        router.replace("/accesos?" + g.toString());
      }
    } catch {
      /* sin almacenamiento: el filtro simplemente no se recuerda */
    }
  }, [router]);
  return null;
}
