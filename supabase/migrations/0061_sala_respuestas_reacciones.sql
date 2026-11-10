-- 0061 · Sala de trading: responder a un mensaje y reaccionar con emojis. Idempotente. Correr después de 0060.

alter table public.sala_mensajes add column if not exists responde_a uuid references public.sala_mensajes(id) on delete set null;
alter table public.sala_mensajes add column if not exists resp_nombre text;
alter table public.sala_mensajes add column if not exists resp_texto text;

-- Al escribir: igual que antes, y si responde a otro mensaje se guarda una copia corta del original (sigue viéndose aunque ese mensaje se borre).
create or replace function public.sala_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare ahora time := (now() at time zone 'America/Asuncion')::time; es_adm boolean; p record; o record;
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
  new.resp_nombre := null; new.resp_texto := null;
  if new.responde_a is not null then
    select autor_nombre, texto, imagen_url into o from public.sala_mensajes where id = new.responde_a;
    if found then
      new.resp_nombre := o.autor_nombre;
      new.resp_texto := case when btrim(o.texto) <> '' then left(o.texto, 120) else '📷 Imagen' end;
    else
      new.responde_a := null;
    end if;
  end if;
  return new;
end $$;

create table if not exists public.sala_reacciones (
  mensaje_id uuid not null references public.sala_mensajes(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '🔥', '😂', '🎯', '🚀')),
  created_at timestamptz not null default now(),
  primary key (mensaje_id, user_id, emoji)
);
create index if not exists sala_reacciones_user on public.sala_reacciones (user_id, created_at desc);
alter table public.sala_reacciones enable row level security;
drop policy if exists "sala reacciones ver" on public.sala_reacciones;
create policy "sala reacciones ver" on public.sala_reacciones for select to authenticated
  using (public.tiene_acceso('comunidad') or public.es_admin());
drop policy if exists "sala reacciones poner" on public.sala_reacciones;
create policy "sala reacciones poner" on public.sala_reacciones for insert to authenticated
  with check (user_id = auth.uid() and (public.tiene_acceso('comunidad') or public.es_admin()));
drop policy if exists "sala reacciones quitar" on public.sala_reacciones;
create policy "sala reacciones quitar" on public.sala_reacciones for delete to authenticated
  using (user_id = auth.uid() or public.es_admin());

-- Reaccionar sigue el horario de la sala, respeta los bloqueos y tiene un límite de velocidad.
create or replace function public.sala_reaccion_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare ahora time := (now() at time zone 'America/Asuncion')::time; es_adm boolean;
begin
  select coalesce(rol = 'admin', false) into es_adm from public.perfiles where id = new.user_id;
  if ahora < time '06:00' or ahora > time '23:30' then
    raise exception 'La sala está cerrada. Abre todos los días a las 6:00 y cierra a las 23:30 (hora de Paraguay).';
  end if;
  if not coalesce(es_adm, false) then
    if exists (select 1 from public.sala_bloqueos b where b.user_id = new.user_id and (b.hasta is null or b.hasta > now())) then
      raise exception 'Un administrador te bloqueó en la sala de trading.';
    end if;
    if (select count(*) from public.sala_reacciones r where r.user_id = new.user_id and r.created_at > now() - interval '1 minute') >= 30 then
      raise exception 'Estás reaccionando demasiado rápido. Espera un momento.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists sala_reaccion_tr on public.sala_reacciones;
create trigger sala_reaccion_tr before insert on public.sala_reacciones for each row execute function public.sala_reaccion_validar();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sala_reacciones') then
    alter publication supabase_realtime add table public.sala_reacciones;
  end if;
end $$;

notify pgrst, 'reload schema';
