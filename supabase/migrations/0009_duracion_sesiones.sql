-- Duración de cada sesión en vivo (minutos). Por defecto 90.
alter table public.clases add column if not exists duracion_min int not null default 90;
alter table public.horario_fijo add column if not exists duracion_min int not null default 90;
