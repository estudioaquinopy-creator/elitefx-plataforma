// =====================================================================
// Utilidades comunes: base de datos, autenticación, respuestas HTTP.
// =====================================================================
import postgres from 'npm:postgres@3.4.5';
import { createClient } from 'npm:@supabase/supabase-js@2';

/** Conexión directa a Postgres (variable que Supabase ya provee a las funciones). */
export const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 3 });

/** Dominios desde los que la web puede llamar a las funciones. */
const ORIGENES = (Deno.env.get('IA_ORIGENES_PERMITIDOS') ?? 'https://academia.elitefx.com.py')
  .split(',')
  .map((s) => s.trim());

export function cabecerasCors(req: Request): HeadersInit {
  const origen = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(req: Request, datos: unknown, estado = 200): Response {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { ...cabecerasCors(req), 'Content-Type': 'application/json' },
  });
}

export function errorSimple(req: Request, mensaje: string, estado: number): Response {
  return json(req, { error: mensaje }, estado);
}

/** Usuario que llama, a partir del token de sesión de Supabase. null si no hay sesión válida. */
export async function usuarioActual(req: Request): Promise<{ id: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const clave = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const cliente = createClient(Deno.env.get('SUPABASE_URL')!, clave, { auth: { persistSession: false } });
  const { data, error } = await cliente.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

export async function esAdmin(userId: string): Promise<boolean> {
  const filas = await sql`select 1 from ia.administradores where user_id = ${userId} limit 1`;
  return filas.length > 0;
}

/** Las tareas programadas se identifican con un token secreto propio. */
export function esLlamadaProgramada(req: Request): boolean {
  const esperado = Deno.env.get('IA_CRON_TOKEN');
  const recibido = req.headers.get('x-ia-cron-token');
  return Boolean(esperado) && recibido === esperado;
}

/** Fecha de "ayer" en hora de Paraguay (UTC-3), formato AAAA-MM-DD. */
export function ayerParaguay(): string {
  const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  ahora.setUTCDate(ahora.getUTCDate() - 1);
  return ahora.toISOString().slice(0, 10);
}
