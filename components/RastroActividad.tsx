"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Registra qué sección abre cada persona (y a qué hora) para las métricas de Accesos. Si la migración 0056 no está, no pasa nada.
export default function RastroActividad() {
  const ruta = usePathname();
  const ultimo = useRef("");
  useEffect(() => {
    const sec = (ruta || "/").split("/")[1] || "inicio";
    if (ultimo.current === ruta) return;
    ultimo.current = ruta || "";
    const t = setTimeout(() => { try { createClient().rpc("registrar_actividad", { p_seccion: sec }).then(() => {}, () => {}); } catch { /* sin registro */ } }, 1500);
    return () => clearTimeout(t);
  }, [ruta]);
  return null;
}
