"use client";
// Conecta el panel de IA con la sesión del navegador.
import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import PanelIA from "@/components/efx-ia/PanelIA";

export default function PanelCliente() {
  const supabase = useMemo(() => createClient(), []);
  return <PanelIA supabase={supabase} />;
}
