-- 0081 · Reuniones virtuales y visitas: solo algunos administradores cuentan como educadores (reciben a la gente); los demás administradores pueden aprobar. Idempotente. Correr después de 0080.
--  · Ajuste `visitas_educadores`: ids de los educadores separados por coma (se cambia en Accesos → "Educadores que reciben reuniones y visitas"). Vacío = todos los administradores.
--  · Si el ajuste aún no existe, se llena con Isaac, Ángel Núñez y Marcos Aquino (por nombre; revisar en Accesos).

create or replace function public.visitas_es_educador(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles p where p.id = p_id and p.rol = 'admin')
     and (
       coalesce(btrim((select a.valor from public.ajustes a where a.clave = 'visitas_educadores')), '') = ''
       or p_id::text = any (string_to_array(replace((select a.valor from public.ajustes a where a.clave = 'visitas_educadores'), ' ', ''), ','))
     );
$$;
grant execute on function public.visitas_es_educador(uuid) to authenticated;

do $$
declare ids text;
begin
  if not exists (select 1 from public.ajustes where clave = 'visitas_educadores') then
    select string_agg(p.id::text, ',') into ids from public.perfiles p
    where p.rol = 'admin' and (lower(p.nombre) like '%isaac%' or lower(p.nombre) like '%ngel%n%ez%' or lower(p.nombre) like '%marcos%aquino%');
    if ids is not null then
      insert into public.ajustes (clave, valor) values ('visitas_educadores', ids);
      raise notice 'Educadores fijados: %', (select string_agg(nombre, ', ') from public.perfiles where id::text = any (string_to_array(ids, ',')));
    else
      raise notice 'No se encontró a ningún educador por nombre: elígelos en Accesos.';
    end if;
  end if;
end $$;

create or replace function public.visitas_educadores() returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre from public.perfiles p where public.visitas_es_educador(p.id) order by p.nombre;
$$;
grant execute on function public.visitas_educadores() to authenticated;

create or replace function public.visitas_ocupadas() returns table(fecha date, hora time)
language sql stable security definer set search_path = public as $$
  select x.fecha, x.hora from (
    select v.fecha, v.hora,
           count(*) filter (where v.modalidad = 'presencial') as pres,
           count(distinct v.encargado_id) filter (where public.visitas_es_educador(v.encargado_id)) as edus
    from public.visitas v
    where v.estado = 'aprobada' and v.fecha >= (now() at time zone 'America/Asuncion')::date
    group by v.fecha, v.hora
  ) x
  where x.pres >= greatest(1, public.ajuste_num('visitas_cupo', 1))
     or x.edus >= greatest(1, (select count(*) from public.perfiles p where public.visitas_es_educador(p.id)));
$$;
grant execute on function public.visitas_ocupadas() to authenticated;

create or replace function public.visitas_cupo_ok() returns trigger language plpgsql security definer set search_path = public as $$
declare cupo int := greatest(1, public.ajuste_num('visitas_cupo', 1)); n int;
begin
  if new.estado = 'aprobada' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobada') then
    if new.encargado_id is null then raise exception 'Indica quién va a recibir a la persona antes de aprobar.'; end if;
    if not public.visitas_es_educador(new.encargado_id) then raise exception 'Solo un educador puede recibir la visita o reunión.'; end if;
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
  new.enlace_meet := '';
  if new.modalidad = 'virtual' then
    select nombre into edu_nombre from public.perfiles where id = new.educador_id and public.visitas_es_educador(new.educador_id);
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
    if (select count(distinct v.encargado_id) from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada' and public.visitas_es_educador(v.encargado_id)) >= (select count(*) from public.perfiles p where public.visitas_es_educador(p.id)) then
      raise exception 'Ese horario ya está ocupado. Elige otro.';
    end if;
  end if;
  new.tema := left(btrim(new.tema), 60);
  new.detalle := left(btrim(new.detalle), 600);
  return new;
end $$;
