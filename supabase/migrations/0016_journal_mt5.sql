-- 0016 · Journal: importar el reporte de MetaTrader 5 (HTML o XLSX).
-- Agrega a "operaciones" los datos de cada operación importada. Idempotente.
alter table public.operaciones
  add column if not exists ticket text,
  add column if not exists origen text not null default 'manual',
  add column if not exists volumen numeric,
  add column if not exists apertura timestamp,
  add column if not exists cierre timestamp,
  add column if not exists precio_ap numeric,
  add column if not exists precio_ci numeric,
  add column if not exists comision numeric not null default 0,
  add column if not exists swap numeric not null default 0;

-- Evita duplicados al volver a subir el mismo reporte (mismo usuario y mismo ticket).
create unique index if not exists operaciones_user_ticket on public.operaciones (user_id, ticket);
create index if not exists operaciones_user_cierre on public.operaciones (user_id, cierre);
