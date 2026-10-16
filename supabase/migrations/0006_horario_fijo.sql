-- ELITE FX · Horario fijo semanal de sesiones en vivo (editable por el administrador).
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

create table public.horario_fijo (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  dias int[] not null default '{}',   -- 1 = lunes ... 7 = domingo
  hora time not null,                 -- hora de Paraguay
  activo boolean not null default true,
  zoom_url text not null default '',
  created_at timestamptz not null default now()
);
alter table public.horario_fijo enable row level security;

create policy "ver horario fijo" on public.horario_fijo for select to authenticated
  using (public.es_miembro());
create policy "admin gestiona horario fijo" on public.horario_fijo for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

insert into public.horario_fijo (titulo, dias, hora) values
  ('Trading en vivo · Sesión de Londres',     '{1,2,3,4,5}', '06:00'),
  ('Trading en vivo · Sesión de Nueva York',  '{1,2,3,4,5}', '10:00'),
  ('Trading en vivo · Sesión de Asia',        '{1,2,3,4}',   '21:00');
