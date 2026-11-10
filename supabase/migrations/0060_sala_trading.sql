-- 0060 · Sala de trading en vivo (chat en tiempo real, solo VIP). Idempotente. Correr después de 0059.
-- Abierta todos los días de 6:00 a 23:30 (hora de Paraguay). El historial visible es de 24 horas. Los administradores borran mensajes y bloquean personas.

create table if not exists public.sala_mensajes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  autor_nombre text not null default '',
  autor_avatar text,
  autor_admin boolean not null default false,
  texto text not null default '' check (char_length(texto) <= 500),
  imagen_url text,
  imagen_path text,
  created_at timestamptz not null default now(),
  constraint sala_contenido check (btrim(texto) <> '' or imagen_url is not null)
);
create index if not exists sala_mensajes_fecha on public.sala_mensajes (created_at);
create index if not exists sala_mensajes_user on public.sala_mensajes (user_id, created_at desc);

create table if not exists public.sala_bloqueos (
  user_id uuid primary key references public.perfiles(id) on delete cascade,
  hasta timestamptz, -- null = bloqueo permanente
  por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.sala_mensajes enable row level security;
alter table public.sala_bloqueos enable row level security;

drop policy if exists "sala ver" on public.sala_mensajes;
create policy "sala ver" on public.sala_mensajes for select to authenticated
  using ((public.tiene_acceso('comunidad') or public.es_admin()) and created_at > now() - interval '24 hours');
drop policy if exists "sala escribir" on public.sala_mensajes;
create policy "sala escribir" on public.sala_mensajes for insert to authenticated
  with check (user_id = auth.uid() and (public.tiene_acceso('comunidad') or public.es_admin()));
drop policy if exists "sala borrar" on public.sala_mensajes;
create policy "sala borrar" on public.sala_mensajes for delete to authenticated
  using (public.es_admin() or user_id = auth.uid());

drop policy if exists "sala bloqueos admin" on public.sala_bloqueos;
create policy "sala bloqueos admin" on public.sala_bloqueos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "sala bloqueo propio" on public.sala_bloqueos;
create policy "sala bloqueo propio" on public.sala_bloqueos for select to authenticated using (user_id = auth.uid());

-- Reglas al escribir: horario, bloqueos, límite de velocidad, y se guarda el nombre/foto de quien escribe (los alumnos no leen perfiles ajenos).
create or replace function public.sala_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare ahora time := (now() at time zone 'America/Asuncion')::time; es_adm boolean; p record;
begin
  select * into p from public.perfiles where id = new.user_id;
  es_adm := coalesce(p.rol = 'admin', false);
  if ahora < time '06:00' or ahora > time '23:30' then
    raise exception 'La sala está cerrada. Abre todos los días a las 6:00 y cierra a las 23:30 (hora de Paraguay).';
  end if;
  if not es_adm then
    if exists (select 1 from public.sala_bloqueos b where b.user_id = new.user_id and (b.hasta is null or b.hasta > now())) then
      raise exception 'Un administrador te bloqueó en la sala de trading.';
    end if;
    if exists (select 1 from public.sala_mensajes m where m.user_id = new.user_id and m.created_at > now() - interval '2 seconds') then
      raise exception 'Espera un momento antes de enviar otro mensaje.';
    end if;
    if (select count(*) from public.sala_mensajes m where m.user_id = new.user_id and m.created_at > now() - interval '1 minute') >= 20 then
      raise exception 'Estás enviando demasiados mensajes. Espera un minuto.';
    end if;
  end if;
  new.texto := left(btrim(new.texto), 500);
  new.autor_nombre := coalesce(nullif(btrim(p.nombre), ''), split_part(p.email, '@', 1));
  new.autor_avatar := p.avatar_url;
  new.autor_admin := es_adm;
  return new;
end $$;
drop trigger if exists sala_validar_tr on public.sala_mensajes;
create trigger sala_validar_tr before insert on public.sala_mensajes for each row execute function public.sala_validar();

-- Imágenes de la sala (bucket público; cada persona sube solo a su carpeta; máx. 5 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sala', 'sala', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
drop policy if exists "subir imagen sala" on storage.objects;
create policy "subir imagen sala" on storage.objects for insert to authenticated
  with check (bucket_id = 'sala' and (storage.foldername(name))[1] = auth.uid()::text and (public.tiene_acceso('comunidad') or public.es_admin()));

-- Mensajes en tiempo real.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sala_mensajes') then
    alter publication supabase_realtime add table public.sala_mensajes;
  end if;
end $$;

notify pgrst, 'reload schema';
