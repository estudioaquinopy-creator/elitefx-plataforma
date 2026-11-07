-- 1) Dudas en cada lección: los alumnos preguntan debajo del video y solo los educadores (administradores) responden.
-- 2) Avisos personales (alguien respondió o te mencionó) en la campana.
-- 3) Publicaciones fijadas como importantes (máximo 3).

-- ───────── Avisos personales en la campana ─────────
alter table public.notificaciones add column if not exists user_id uuid references public.perfiles(id) on delete cascade;
create index if not exists notificaciones_user_idx on public.notificaciones (user_id, created_at desc);

drop policy if exists "ver notificaciones" on public.notificaciones;
create policy "ver notificaciones" on public.notificaciones for select to authenticated
  using ((user_id is null and (not solo_miembros or public.es_miembro())) or user_id = auth.uid());

-- Avisa a las personas mencionadas con @Nombre Apellido (hasta 10 por texto; no avisa al autor ni a la persona excluida).
create or replace function public.avisar_menciones(p_texto text, p_autor uuid, p_excluir uuid, p_titulo text, p_enlace text) returns void
language plpgsql security definer set search_path = public as $$
declare r record; t text := lower(coalesce(p_texto, ''));
begin
  if position('@' in t) = 0 then return; end if;
  for r in
    select p.id from public.perfiles p
    where btrim(p.nombre) <> '' and p.id <> p_autor and (p_excluir is null or p.id <> p_excluir)
      and position('@' || lower(btrim(p.nombre)) in t) > 0
      and t ~ ('@' || regexp_replace(lower(btrim(p.nombre)), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '(?![[:alnum:]_])')
    limit 10
  loop
    insert into public.notificaciones (titulo, cuerpo, enlace, solo_miembros, user_id)
    values (p_titulo, left(btrim(p_texto), 90), p_enlace, false, r.id);
  end loop;
end $$;

-- Publicación nueva: avisa a quienes se mencionan.
create or replace function public.publicaciones_menciones() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.avisar_menciones(coalesce(new.titulo, '') || ' ' || coalesce(new.cuerpo, ''), new.user_id, null, new.autor || ' te mencionó en la comunidad', '/comunidad#p' || new.id);
  return new;
end $$;
drop trigger if exists publicaciones_menciones on public.publicaciones;
create trigger publicaciones_menciones after insert on public.publicaciones
  for each row execute function public.publicaciones_menciones();

-- Respuesta en la comunidad: avisa al autor de la publicación y a quienes se mencionan.
create or replace function public.comentarios_avisos() returns trigger
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select user_id, titulo, cuerpo into p from public.publicaciones where id = new.post_id;
  if found and p.user_id <> new.user_id then
    insert into public.notificaciones (titulo, cuerpo, enlace, solo_miembros, user_id)
    values (new.autor || ' respondió tu publicación', left(btrim(new.cuerpo), 90), '/comunidad#p' || new.post_id, false, p.user_id);
  end if;
  perform public.avisar_menciones(new.cuerpo, new.user_id, case when found then p.user_id end, new.autor || ' te mencionó en una respuesta', '/comunidad#p' || new.post_id);
  return new;
end $$;
drop trigger if exists comentarios_avisos on public.comentarios;
create trigger comentarios_avisos after insert on public.comentarios
  for each row execute function public.comentarios_avisos();

-- Buscador de personas para @menciones (los alumnos no pueden leer otros perfiles): educadores siempre; miembros VIP solo si quien busca tiene comunidad.
create or replace function public.buscar_mencionables(p_q text) returns table (id uuid, nombre text, educador boolean)
language plpgsql stable security definer set search_path = public as $$
declare q text := btrim(regexp_replace(coalesce(p_q, ''), '[%_\\]', '', 'g')); ok boolean;
begin
  if auth.uid() is null or length(q) < 1 then return; end if;
  ok := public.es_admin() or public.tiene_acceso('comunidad');
  return query
    select p.id, btrim(p.nombre), (p.rol = 'admin')
    from public.perfiles p
    where p.id <> auth.uid() and btrim(p.nombre) <> ''
      and (btrim(p.nombre) ilike q || '%' or btrim(p.nombre) ilike '% ' || q || '%')
      and (p.rol = 'admin' or (ok and p.plan <> 'gratis' and p.prueba_hasta is null and (p.vence is null or p.vence >= (now() at time zone 'America/Asuncion')::date)))
    order by (p.rol = 'admin') desc, p.nombre
    limit 8;
end $$;
grant execute on function public.buscar_mencionables(text) to authenticated;

-- ───────── Dudas en las lecciones ─────────
create table if not exists public.lecciones_comentarios (
  id uuid primary key default gen_random_uuid(),
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  autor text not null default '',
  cuerpo text not null check (char_length(cuerpo) between 1 and 2000),
  parent_id uuid references public.lecciones_comentarios(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists lecciones_comentarios_idx on public.lecciones_comentarios (leccion_id, created_at);
create index if not exists lecciones_comentarios_sin_resp on public.lecciones_comentarios (created_at desc) where parent_id is null;
alter table public.lecciones_comentarios enable row level security;

drop policy if exists "ver dudas de la lección" on public.lecciones_comentarios;
create policy "ver dudas de la lección" on public.lecciones_comentarios for select to authenticated
  using (public.puede_ver_curso(curso_id));

-- Preguntar: cualquiera con acceso al curso. Responder (con parent_id): solo administradores.
drop policy if exists "preguntar o responder" on public.lecciones_comentarios;
create policy "preguntar o responder" on public.lecciones_comentarios for insert to authenticated
  with check (user_id = auth.uid() and public.puede_ver_curso(curso_id) and (parent_id is null or public.es_admin()));

drop policy if exists "borrar duda propia o admin" on public.lecciones_comentarios;
create policy "borrar duda propia o admin" on public.lecciones_comentarios for delete to authenticated
  using (user_id = auth.uid() or public.es_admin());

create or replace function public.lec_coment_antes() returns trigger
language plpgsql security definer set search_path = public as $$
declare c uuid; par record; nom text; hoy int;
begin
  select curso_id into c from public.lecciones where id = new.leccion_id;
  if c is null then raise exception 'La lección no existe.'; end if;
  new.curso_id := c;
  select coalesce(nullif(btrim(nombre), ''), split_part(email, '@', 1)) into nom from public.perfiles where id = new.user_id;
  new.autor := coalesce(nom, '');
  new.cuerpo := btrim(new.cuerpo);
  if new.cuerpo = '' then raise exception 'Escribe tu mensaje.'; end if;
  if new.parent_id is not null then
    select * into par from public.lecciones_comentarios where id = new.parent_id;
    if not found or par.parent_id is not null or par.leccion_id <> new.leccion_id then raise exception 'Respuesta no válida.'; end if;
  elsif not public.es_admin() then
    select count(*) into hoy from public.lecciones_comentarios where user_id = new.user_id and parent_id is null and created_at > now() - interval '24 hours';
    if hoy >= 10 then raise exception 'Llegaste al límite de 10 preguntas por día. Inténtalo mañana.'; end if;
  end if;
  return new;
end $$;
drop trigger if exists lec_coment_antes on public.lecciones_comentarios;
create trigger lec_coment_antes before insert on public.lecciones_comentarios
  for each row execute function public.lec_coment_antes();

create or replace function public.lec_coment_despues() returns trigger
language plpgsql security definer set search_path = public as $$
declare lec text; enlace text; q uuid;
begin
  select titulo into lec from public.lecciones where id = new.leccion_id;
  enlace := '/cursos/' || new.curso_id || '?l=' || new.leccion_id || '#dudas';
  if new.parent_id is not null then
    select user_id into q from public.lecciones_comentarios where id = new.parent_id;
    if q is not null and q <> new.user_id then
      insert into public.notificaciones (titulo, cuerpo, enlace, solo_miembros, user_id)
      values ('Respondieron tu pregunta', 'En «' || coalesce(lec, 'la lección') || '»: ' || left(new.cuerpo, 80), enlace, false, q);
    end if;
  end if;
  perform public.avisar_menciones(new.cuerpo, new.user_id, q, new.autor || ' te mencionó en «' || coalesce(lec, 'una lección') || '»', enlace);
  return new;
end $$;
drop trigger if exists lec_coment_despues on public.lecciones_comentarios;
create trigger lec_coment_despues after insert on public.lecciones_comentarios
  for each row execute function public.lec_coment_despues();

-- ───────── Publicaciones fijadas (máximo 3) ─────────
alter table public.publicaciones add column if not exists fijada_at timestamptz;

drop policy if exists "fijar publicaciones (admin)" on public.publicaciones;
create policy "fijar publicaciones (admin)" on public.publicaciones for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Solo el administrador puede fijar; no más de 3 a la vez. (Reemplaza la función de la migración 0048 conservando sus reglas.)
create or replace function public.publicaciones_editar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := old.user_id;
  new.autor := old.autor;
  new.canal := old.canal;
  new.imagen_url := old.imagen_url;
  new.created_at := old.created_at;
  if new.titulo is distinct from old.titulo or new.cuerpo is distinct from old.cuerpo then
    new.editado_at := now();
  else
    new.editado_at := old.editado_at;
  end if;
  if not public.es_admin() then
    new.fijada_at := old.fijada_at;
  elsif new.fijada_at is not null and old.fijada_at is null
        and (select count(*) from public.publicaciones where fijada_at is not null) >= 3 then
    raise exception 'Solo se pueden fijar 3 publicaciones. Quita una antes.';
  end if;
  return new;
end $$;
