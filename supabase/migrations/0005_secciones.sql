-- ELITE FX · Etapa 4: calendario, tutoriales, aliados, comunidad, journal y accesos.
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

-- ¿Tiene el usuario actual acceso a una sección? (miembros/admin, o acceso puntual concedido)
create or replace function public.tiene_acceso(sec text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_miembro()
    or exists (select 1 from public.accesos a where a.user_id = auth.uid() and a.seccion = sec and a.concedido);
$$;

-- Calendario: solo mientras la membresía esté vigente (fecha "vence"), o acceso puntual.
create or replace function public.puede_calendario() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.plan <> 'gratis'
               and p.vence is not null and p.vence >= (now() at time zone 'America/Asuncion')::date)
    or exists (select 1 from public.accesos a where a.user_id = auth.uid() and a.seccion = 'calendario' and a.concedido);
$$;

-- Textos y portadas editables (aliados, portadas del calendario y tutoriales, enlace de Zoom general).
create table public.ajustes (clave text primary key, valor text not null default '');
alter table public.ajustes enable row level security;
create policy "ver ajustes" on public.ajustes for select to authenticated using (true);
create policy "admin gestiona ajustes" on public.ajustes for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
insert into public.ajustes (clave, valor) values
  ('aliados_broker_url', 'https://my.liquidbrokers.com/auth/register?partner_code=6813172'),
  ('aliados_broker_desc', '[Descripción breve: regulación, depósito mínimo, plataformas.]'),
  ('aliados_tarjeta_url', ''),
  ('aliados_tarjeta_desc', 'Tarjeta virtual para usar tus criptomonedas en el día a día. [Descripción breve: comisiones, límites, países disponibles.]'),
  ('aliados_video', ''),
  ('aliados_legal', 'Divulgación: [texto legal sobre la comisión de afiliado y el riesgo de operar].'),
  ('zoom_general', ''),
  ('portada_calendario', ''),
  ('portada_tutoriales', '');

-- Clases en vivo
create table public.clases (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  inicio timestamptz not null,
  zoom_url text not null default '',
  created_at timestamptz not null default now()
);
create index on public.clases (inicio);
alter table public.clases enable row level security;
create policy "ver clases" on public.clases for select to authenticated using (public.puede_calendario());
create policy "admin gestiona clases" on public.clases for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Tutoriales
create table public.tutoriales (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  categoria text not null default 'General',
  youtube_url text not null default '',
  created_at timestamptz not null default now()
);
alter table public.tutoriales enable row level security;
create policy "ver tutoriales" on public.tutoriales for select to authenticated using (public.tiene_acceso('tutoriales'));
create policy "admin gestiona tutoriales" on public.tutoriales for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Comunidad
create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  autor text not null default '',
  canal text not null check (canal in ('anuncios', 'preguntas', 'resultados')),
  titulo text not null,
  cuerpo text not null default '',
  created_at timestamptz not null default now()
);
create index on public.publicaciones (created_at desc);
alter table public.publicaciones enable row level security;
-- Todos con sesión pueden leer (también el plan gratuito).
create policy "leer publicaciones" on public.publicaciones for select to authenticated using (true);
-- Anuncios: solo el administrador. Preguntas y Resultados: miembros (o con acceso puntual).
create policy "publicar" on public.publicaciones for insert to authenticated
  with check (
    user_id = auth.uid()
    and ((canal = 'anuncios' and public.es_admin())
      or (canal in ('preguntas', 'resultados') and public.tiene_acceso('comunidad')))
  );
create policy "borrar publicación propia o admin" on public.publicaciones for delete to authenticated
  using (user_id = auth.uid() or public.es_admin());

-- Journal personal: cada persona ve solo lo suyo (ni el administrador).
create table public.operaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null default current_date,
  par text not null,
  direccion text not null check (direccion in ('compra', 'venta')),
  resultado numeric not null default 0,
  notas text not null default '',
  created_at timestamptz not null default now()
);
create index on public.operaciones (user_id, fecha desc);
alter table public.operaciones enable row level security;
create policy "journal propio" on public.operaciones for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- El administrador cambia plan y vencimiento mediante esta función (los alumnos no pueden).
create or replace function public.admin_actualizar_perfil(p_id uuid, p_plan plan_usuario, p_vence date) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede hacer esto.'; end if;
  update public.perfiles set plan = p_plan, vence = p_vence where id = p_id;
end $$;

-- Avisos automáticos: anuncios y clases nuevas.
create or replace function public.avisar_anuncio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.canal = 'anuncios' then
    insert into public.notificaciones (titulo, cuerpo, enlace, solo_miembros)
    values ('Anuncio: ' || new.titulo, 'ELITE FX', '/comunidad?canal=anuncios', false);
  end if;
  return new;
end $$;
create trigger al_crear_publicacion after insert on public.publicaciones
  for each row execute function public.avisar_anuncio();

create or replace function public.avisar_clase() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notificaciones (titulo, cuerpo, enlace, solo_miembros)
  values ('Nueva clase: ' || new.titulo,
          to_char(new.inicio at time zone 'America/Asuncion', 'DD/MM HH24:MI'),
          '/calendario', true);
  return new;
end $$;
create trigger al_crear_clase after insert on public.clases
  for each row execute function public.avisar_clase();
