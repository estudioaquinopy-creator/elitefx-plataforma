-- =====================================================================
-- ELITE FX · Asistente IA · Tareas programadas
-- ---------------------------------------------------------------------
-- Ejecutar DESPUÉS de desplegar las Edge Functions.
-- Reemplazar <PROJECT_REF> por la referencia del proyecto de Supabase.
--
-- Requiere las extensiones pg_cron y pg_net (Database → Extensions).
-- Activarlas solo agrega funciones; no modifica nada existente.
--
-- El token se guarda en Supabase Vault, nunca escrito en el código.
-- Crear antes, en el SQL Editor (mismo valor que IA_CRON_TOKEN):
--   select vault.create_secret('<TOKEN_LARGO_ALEATORIO>', 'ia_cron_token');
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Auditoría del ranking: todos los días a las 03:00 de Paraguay (06:00 UTC).
-- Revisa el día anterior completo.
select cron.schedule(
  'ia-auditoria-ranking',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/ia-auditoria-ranking',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ia-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'ia_cron_token')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Revisión de textos: cada 30 minutos, solo publicaciones y respuestas nuevas.
select cron.schedule(
  'ia-revision-textos',
  '*/30 * * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/ia-revision-textos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-ia-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'ia_cron_token')
    ),
    body    := '{}'::jsonb
  );
  $$
);
