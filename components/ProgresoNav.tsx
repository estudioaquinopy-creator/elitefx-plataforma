"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Barra fina arriba que avanza apenas haces clic en un enlace y se completa cuando la página nueva carga.
function Barra() {
  const ruta = usePathname();
  const q = useSearchParams();
  const [fase, setFase] = useState<"idle" | "run" | "end">("idle");

  useEffect(() => {
    setFase("end");
    const t = setTimeout(() => setFase("idle"), 350);
    return () => clearTimeout(t);
  }, [ruta, q]);

  useEffect(() => {
    const clic = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
      const h = a.getAttribute("href");
      if (!h || h.startsWith("#") || h.startsWith("mailto:") || /^https?:/.test(h)) return;
      if (h === location.pathname + location.search) return;
      setFase("run");
    };
    document.addEventListener("click", clic);
    return () => document.removeEventListener("click", clic);
  }, []);

  return <div className={"navbar " + fase} aria-hidden="true" />;
}

export default function ProgresoNav() {
  return <Suspense fallback={null}><Barra /></Suspense>;
}
