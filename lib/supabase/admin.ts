import { createClient } from "@supabase/supabase-js";

// Cliente con la clave de servicio: SOLO para acciones de servidor del administrador (crear personas, cambiar roles).
// La clave vive únicamente en la variable SUPABASE_SERVICE_ROLE_KEY de Vercel (sin NEXT_PUBLIC_) y nunca llega al navegador.
export function clienteAdmin() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
