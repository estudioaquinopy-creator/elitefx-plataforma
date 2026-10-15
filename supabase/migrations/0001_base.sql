-- ELITE FX · Etapa 1: perfiles, roles, membresías y accesos.
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

create type rol_usuario as enum ('admin', 'alumno');
create type plan_usuario as enum ('gratis', 'live_trading', 'scanner');

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  telefono text,
  rol rol_usuario not null default 'alumno',
  plan plan_usuario not null default 'gratis',
  vence date,                       -- fin del acceso al calendario / sesiones en vivo
  created_at timestamptz not null default now()
);

-- Accesos puntuales que el administrador concede a un alumno (p. ej. 'calendario', 'tutoriales').
create table public.accesos (
  user_id uuid not null references public.perfiles(id) on delete cascade,
  seccion text not null,
  concedido boolean not null default true,
  primary key (user_id, seccion)
);

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Al registrarse un usuario se crea su perfil automáticamente (siempre como alumno gratuito).
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'nombre', ''));
  return new;
end $$;

create trigger al_crear_usuario after insert on auth.users
  for each row execute function public.crear_perfil();

alter table public.perfiles enable row level security;
alter table public.accesos enable row level security;

-- Cada persona ve su perfil; el administrador ve y edita todos.
create policy "ver perfil propio o admin" on public.perfiles
  for select using (id = auth.uid() or public.es_admin());
create policy "admin edita perfiles" on public.perfiles
  for update using (public.es_admin()) with check (public.es_admin());
create policy "ver accesos propios o admin" on public.accesos
  for select using (user_id = auth.uid() or public.es_admin());
create policy "admin gestiona accesos" on public.accesos
  for all using (public.es_admin()) with check (public.es_admin());

-- Un alumno nunca puede cambiarse el rol, plan ni vencimiento (no tiene política de UPDATE).
-- Para convertirte en administrador, ejecuta UNA vez (con tu correo):
--   update public.perfiles set rol = 'admin' where email = 'TU-CORREO';
