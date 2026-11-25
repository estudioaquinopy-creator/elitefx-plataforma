-- 0080 · Reuniones virtuales con un educador, en la MISMA agenda que las visitas a la oficina. Idempotente. Correr después de 0079.
--  · visitas.modalidad ('presencial' | 'virtual'), visitas.educador_id (con quién pidió la reunión virtual) y visitas.enlace_meet (lo pega el educador al aprobar).
--  · Una sola agenda por educador: aprobada una visita (presencial o virtual), ese educador (encargado_id) queda ocupado en ese día y hora.
--  · Presencial: sigue habiendo un solo cupo por horario en la oficina (ajuste visitas_cupo); además la persona no puede pedir un horario donde ya no queda ningún educador libre.
--  · Virtual: la persona elige educador; no se puede pedir si ese educador ya tiene algo aprobado en ese horario.

alter table public.visitas add column if not exists modalidad text not null default 'presencial';
alter table public.visitas add column if not exists educador_id uuid references public.perfiles(id) on delete set null;
alter table public.visitas add column if not exists enlace_meet text not null default '';
alter table public.visitas drop constraint if exists visitas_modalidad_check;
alter table public.visitas add constraint visitas_modalidad_check check (modalidad in ('presencial', 'virtual'));

-- Red de seguridad: un educador no puede tener dos visitas aprobadas a la misma hora (si ya hubiera datos que lo impidan, se omite sin romper la migración).
do $$ begin
  create unique index if not exists visitas_educador_turno_uq on public.visitas (fecha, hora, encargado_id) where estado = 'aprobada' and encargado_id is not null;
exception when others then
  raise notice 'No se creó visitas_educador_turno_uq: %', sqlerrm;
end $$;

-- Educadores que se pueden elegir (administradores). Los miembros no pueden leer perfiles ajenos, por eso va en una función.
create or replace function public.visitas_educadores() returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from public.perfiles p where p.rol = 'admin' order by p.nombre;
$$;
grant execute on function public.visitas_educadores() to authenticated;

-- Horarios en que cada educador ya tiene algo aprobado (sin revelar con quién).
create or replace function public.visitas_educadores_ocupados() returns table(fecha date, hora time, educador_id uuid)
language sql stable security definer set search_path = public as $$
  select v.fecha, v.hora, v.encargado_id from public.visitas v
  where v.estado = 'aprobada' and v.encargado_id is not null and v.fecha >= (now() at time zone 'America/Asuncion')::date;
$$;
grant execute on function public.visitas_educadores_ocupados() to authenticated;

-- Horarios de la oficina que ya no se pueden pedir: cupo presencial completo, o todos los educadores ocupados.
create or replace function public.visitas_ocupadas() returns table(fecha date, hora time)
language sql stable security definer set search_path = public as $$
  select x.fecha, x.hora from (
    select v.fecha, v.hora,
           count(*) filter (where v.modalidad = 'presencial') as pres,
           count(distinct v.encargado_id) as edus
    from public.visitas v
    where v.estado = 'aprobada' and v.fecha >= (now() at time zone 'America/Asuncion')::date
    group by v.fecha, v.hora
  ) x
  where x.pres >= greatest(1, public.ajuste_num('visitas_cupo', 1))
     or x.edus >= greatest(1, (select count(*) from public.perfiles p where p.rol = 'admin'));
$$;
grant execute on function public.visitas_ocupadas() to authenticated;

-- Al aprobar (o al aceptar la persona un nuevo horario): hace falta un encargado libre; si es virtual, también el enlace de la reunión.
create or replace function public.visitas_cupo_ok() returns trigger language plpgsql security definer set search_path = public as $$
declare cupo int := greatest(1, public.ajuste_num('visitas_cupo', 1)); n int;
begin
  if new.estado = 'aprobada' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobada') then
    if new.encargado_id is null then raise exception 'Indica quién va a recibir a la persona antes de aprobar.'; end if;
    if new.modalidad = 'virtual' and coalesce(btrim(new.enlace_meet), '') = '' then raise exception 'Pega el enlace de Google Meet antes de aprobar la reunión virtual.'; end if;
    perform pg_advisory_xact_lock(hashtext(new.fecha::text || new.hora::text));
    if exists (select 1 from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada' and v.encargado_id = new.encargado_id and v.id <> new.id) then
      raise exception 'Ese educador ya está ocupado en ese horario.';
    end if;
    if new.modalidad = 'presencial' then
      select count(*) into n from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada' and v.modalidad = 'presencial' and v.id <> new.id;
      if n >= cupo then raise exception 'Ese horario ya tiene el cupo completo en la oficina.'; end if;
    end if;
  end if;
  return new;
end $$;

-- Al pedir: solo VIP, fecha futura, una solicitud activa por persona y horario libre (presencial: cupo de la oficina; virtual: educador libre).
create or replace function public.visitas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Asuncion')::date; vip boolean; cupo int := greatest(1, public.ajuste_num('visitas_cupo', 1)); edu_nombre text;
begin
  select (plan <> 'gratis' or rol = 'admin') into vip from public.perfiles where id = new.user_id;
  if not coalesce(vip, false) then raise exception 'Las visitas son solo para miembros VIP.'; end if;
  if new.fecha <= hoy then raise exception 'Elige una fecha a partir de mañana.'; end if;
  if new.fecha > hoy + 56 then raise exception 'Solo se puede agendar con hasta 8 semanas de anticipación.'; end if;
  if exists (select 1 from public.visitas v where v.user_id = new.user_id and v.estado in ('pendiente', 'aprobada', 'propuesta') and v.fecha >= hoy) then
    raise exception 'Ya tienes una visita o reunión pendiente o aprobada. Cancélala si quieres pedir otra.';
  end if;
  -- Lo que escribe la persona nunca decide el encargado ni el enlace: lo fija el equipo al aprobar.
  new.enlace_meet := '';
  if new.modalidad = 'virtual' then
    select nombre into edu_nombre from public.perfiles where id = new.educador_id and rol = 'admin';
    if new.educador_id is null or edu_nombre is null then raise exception 'Elige con qué educador quieres la reunión.'; end if;
    if exists (select 1 from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada' and v.encargado_id = new.educador_id) then
      raise exception 'Ese educador ya está ocupado en ese horario. Elige otro horario u otro educador.';
    end if;
    new.encargado_id := new.educador_id;
    new.encargado_nombre := edu_nombre;
  else
    new.educador_id := null;
    new.encargado_id := null;
    new.encargado_nombre := '';
    if (select count(*) from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada' and v.modalidad = 'presencial') >= cupo then
      raise exception 'Ese horario ya está ocupado. Elige otro.';
    end if;
    if (select count(distinct v.encargado_id) from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada') >= (select count(*) from public.perfiles p where p.rol = 'admin') then
      raise exception 'Ese horario ya está ocupado. Elige otro.';
    end if;
  end if;
  new.tema := left(btrim(new.tema), 60);
  new.detalle := left(btrim(new.detalle), 600);
  return new;
end $$;

-- La persona acepta o rechaza el nuevo horario propuesto. Al aceptar, la visita pasa a aprobada en el nuevo día y hora (el trigger comprueba que el encargado siga libre).
create or replace function public.visitas_responder(p_id uuid, p_acepta boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.visitas; hoy date := (now() at time zone 'America/Asuncion')::date;
begin
  select * into v from public.visitas where id = p_id and user_id = auth.uid() and estado = 'propuesta' for update;
  if not found then raise exception 'Esa propuesta ya no está disponible.'; end if;
  if p_acepta then
    if v.propuesta_fecha is null or v.propuesta_hora is null or v.propuesta_fecha <= hoy then raise exception 'Ese horario ya pasó. Pide otra visita.'; end if;
    update public.visitas set fecha = v.propuesta_fecha, hora = v.propuesta_hora, estado = 'aprobada', propuesta_fecha = null, propuesta_hora = null, revisado_at = now() where id = v.id;
  else
    update public.visitas set estado = 'cancelada', nota = 'No aceptó el nuevo horario', propuesta_fecha = null, propuesta_hora = null, revisado_at = now() where id = v.id;
  end if;
end $$;
grant execute on function public.visitas_responder(uuid, boolean) to authenticated;
