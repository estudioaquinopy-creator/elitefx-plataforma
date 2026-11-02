-- 0042 · El administrador puede marcar una sesión concreta como terminada (y reabrirla). Idempotente. Correr después de 0041.
-- `sesion_id` es el id de la sesión: el de la clase suelta, o "f-<id del horario fijo>-<AAAA-MM-DD>" para una sesión fija de ese día.
-- Solo afecta a esa sesión; la del día siguiente aparece normal.
create table if not exists public.sesiones_terminadas (
  sesion_id text primary key,
  terminada_at timestamptz not null default now(),
  por uuid references auth.users(id) on delete set null
);
alter table public.sesiones_terminadas enable row level security;

drop policy if exists "ver sesiones terminadas" on public.sesiones_terminadas;
create policy "ver sesiones terminadas" on public.sesiones_terminadas for select to authenticated using (true);
drop policy if exists "admin gestiona sesiones terminadas" on public.sesiones_terminadas;
create policy "admin gestiona sesiones terminadas" on public.sesiones_terminadas for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
