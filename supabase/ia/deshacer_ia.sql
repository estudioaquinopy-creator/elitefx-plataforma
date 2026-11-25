-- =====================================================================
-- ELITE FX · Asistente IA · DESHACER TODO
-- ---------------------------------------------------------------------
-- Quita por completo el asistente. La plataforma queda exactamente
-- como estaba antes de la instalación.
-- ATENCIÓN: borra también el historial de alertas, revisiones y soporte.
-- =====================================================================

select cron.unschedule('ia-auditoria-ranking')
  where exists (select 1 from cron.job where jobname = 'ia-auditoria-ranking');
select cron.unschedule('ia-revision-textos')
  where exists (select 1 from cron.job where jobname = 'ia-revision-textos');

delete from vault.secrets where name = 'ia_cron_token';

drop schema if exists ia cascade;

-- Después, borrar las funciones desde la terminal:
--   supabase functions delete ia-auditoria-ranking
--   supabase functions delete ia-revision-textos
--   supabase functions delete ia-soporte
--   supabase functions delete ia-panel
-- Y quitar de la web los componentes de la carpeta frontend/.
-- (pg_cron y pg_net pueden quedar activadas: no afectan a nada.)
