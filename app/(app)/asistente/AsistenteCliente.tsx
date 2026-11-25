"use client";
// Conecta el chat del asistente con la sesión del navegador (el cliente de Supabase de siempre).
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import AyudaIA from "@/components/efx-ia/AyudaIA";

export default function AsistenteCliente() {
  const supabase = useMemo(() => createClient(), []);
  return <AyudaIA supabase={supabase} />;
}
