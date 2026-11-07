-- Términos y condiciones: cada persona debe aceptarlos para crear la cuenta o, si ya tenía una, al entrar por primera vez.
-- Guarda la versión aceptada y la fecha en el perfil, y un historial por si los términos cambian. Idempotente.
alter table public.perfiles add column if not exists terminos_version text;
alter table public.perfiles add column if not exists terminos_at timestamptz;

create table if not exists public.terminos_aceptaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  aceptado_at timestamptz not null default now()
);
create index if not exists terminos_aceptaciones_user on public.terminos_aceptaciones (user_id, aceptado_at desc);
alter table public.terminos_aceptaciones enable row level security;
drop policy if exists "ver aceptaciones propias o admin" on public.terminos_aceptaciones;
create policy "ver aceptaciones propias o admin" on public.terminos_aceptaciones
  for select to authenticated using (user_id = auth.uid() or public.es_admin());

-- Los alumnos no pueden editar estas columnas del perfil directamente: se aceptan con esta función.
create or replace function public.aceptar_terminos(p_version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión para aceptar los términos.'; end if;
  if p_version is null or length(trim(p_version)) = 0 or length(p_version) > 40 then raise exception 'Versión no válida.'; end if;
  update public.perfiles set terminos_version = p_version, terminos_at = now() where id = auth.uid();
  insert into public.terminos_aceptaciones (user_id, version) values (auth.uid(), p_version);
end $$;
revoke all on function public.aceptar_terminos(text) from public;
grant execute on function public.aceptar_terminos(text) to authenticated;
