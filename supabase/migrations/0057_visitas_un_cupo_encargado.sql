-- 0057 · Visitas: un solo cupo por horario y encargado obligatorio al aprobar. Idempotente. Correr después de 0056.
-- (1) Cuando un horario queda aprobado para alguien, nadie más puede pedirlo (cupo 1).
-- (2) Al aprobar, hay que indicar quién recibe a la persona (un administrador).

alter table public.visitas add column if not exists encargado_id uuid references public.perfiles(id) on delete set null;
alter table public.visitas add column if not exists encargado_nombre text not null default '';

-- Cupo por defecto = 1 (y se fija el ajuste guardado, que antes podía ser 3).
update public.ajustes set valor = '1' where clave = 'visitas_cupo';
insert into public.ajustes (clave, valor) select 'visitas_cupo', '1' where not exists (select 1 from public.ajustes where clave = 'visitas_cupo');

create or replace function public.visitas_cupo_ok() returns trigger language plpgsql security definer set search_path = public as $$
declare cupo int := greatest(1, public.ajuste_num('visitas_cupo', 1)); n int;
begin
  if new.estado = 'aprobada' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobada') then
    if new.encargado_id is null then raise exception 'Indica quién va a recibir a la persona antes de aprobar.'; end if;
    perform pg_advisory_xact_lock(hashtext(new.fecha::text || new.hora::text));
    select count(*) into n from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada' and v.id <> new.id;
    if n >= cupo then raise exception 'Ese horario ya tiene el cupo completo (% personas).', cupo; end if;
  end if;
  return new;
end $$;

create or replace function public.visitas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Asuncion')::date; vip boolean; cupo int := greatest(1, public.ajuste_num('visitas_cupo', 1));
begin
  select (plan <> 'gratis' or rol = 'admin') into vip from public.perfiles where id = new.user_id;
  if not coalesce(vip, false) then raise exception 'Las visitas son solo para miembros VIP.'; end if;
  if new.fecha <= hoy then raise exception 'Elige una fecha a partir de mañana.'; end if;
  if new.fecha > hoy + 56 then raise exception 'Solo se puede agendar con hasta 8 semanas de anticipación.'; end if;
  if exists (select 1 from public.visitas v where v.user_id = new.user_id and v.estado in ('pendiente', 'aprobada') and v.fecha >= hoy) then
    raise exception 'Ya tienes una visita pendiente o aprobada. Cancélala si quieres pedir otra.';
  end if;
  if (select count(*) from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada') >= cupo then
    raise exception 'Ese horario ya está ocupado. Elige otro.';
  end if;
  new.tema := left(btrim(new.tema), 60);
  new.detalle := left(btrim(new.detalle), 600);
  return new;
end $$;

create or replace function public.visitas_ocupadas() returns table(fecha date, hora time)
language sql stable security definer set search_path = public as $$
  select v.fecha, v.hora from public.visitas v
  where v.estado = 'aprobada' and v.fecha >= (now() at time zone 'America/Asuncion')::date
  group by v.fecha, v.hora having count(*) >= greatest(1, public.ajuste_num('visitas_cupo', 1));
$$;
grant execute on function public.visitas_ocupadas() to authenticated;
