-- ELITE FX · Etapa 3: notificaciones y edición de perfil.
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

alter table public.perfiles add column if not exists notif_leidas_at timestamptz;

create or replace function public.es_miembro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and (rol = 'admin' or plan <> 'gratis'));
$$;

create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  cuerpo text not null default '',
  enlace text,
  solo_miembros boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notificaciones enable row level security;

create policy "ver notificaciones" on public.notificaciones for select to authenticated
  using (not solo_miembros or public.es_miembro());
create policy "admin gestiona notificaciones" on public.notificaciones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Cada lección nueva avisa a los alumnos que pueden verla.
create or replace function public.avisar_leccion_nueva() returns trigger
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select nombre, gratis into c from public.cursos where id = new.curso_id;
  insert into public.notificaciones (titulo, cuerpo, enlace, solo_miembros)
  values ('Nueva lección: ' || new.titulo, c.nombre, '/cursos/' || new.curso_id || '?l=' || new.id, not c.gratis);
  return new;
end $$;
create trigger al_crear_leccion after insert on public.lecciones
  for each row execute function public.avisar_leccion_nueva();

-- Cada persona puede cambiar SOLO su nombre, teléfono y la marca de notificaciones leídas.
-- (rol, plan y vencimiento no se pueden tocar desde la plataforma salvo por el administrador.)
revoke update on public.perfiles from authenticated;
grant update (nombre, telefono, notif_leidas_at) on public.perfiles to authenticated;
create policy "editar perfil propio" on public.perfiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
