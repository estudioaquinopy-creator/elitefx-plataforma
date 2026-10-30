-- 0038 · Visitas: varias personas por horario (cupo). Idempotente. Correr después de 0037.
-- Por defecto 3 personas por turno (el dueño y dos educadores). Se cambia con el ajuste `visitas_cupo` (tabla ajustes).

drop index if exists public.visitas_turno_uq;

-- Al aprobar, el turno no puede superar el cupo (con bloqueo para que dos aprobaciones simultáneas no se pasen).
create or replace function public.visitas_cupo_ok() returns trigger language plpgsql security definer set search_path = public as $$
declare cupo int := greatest(1, public.ajuste_num('visitas_cupo', 3)); n int;
begin
  if new.estado = 'aprobada' and (tg_op = 'INSERT' or old.estado is distinct from 'aprobada') then
    perform pg_advisory_xact_lock(hashtext(new.fecha::text || new.hora::text));
    select count(*) into n from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada' and v.id <> new.id;
    if n >= cupo then raise exception 'Ese horario ya tiene el cupo completo (% personas).', cupo; end if;
  end if;
  return new;
end $$;
drop trigger if exists visitas_cupo_tr on public.visitas;
create trigger visitas_cupo_tr before insert or update on public.visitas for each row execute function public.visitas_cupo_ok();

-- Al pedir: solo se rechaza si el turno ya está lleno.
create or replace function public.visitas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Asuncion')::date; vip boolean; cupo int := greatest(1, public.ajuste_num('visitas_cupo', 3));
begin
  select (plan <> 'gratis' or rol = 'admin') into vip from public.perfiles where id = new.user_id;
  if not coalesce(vip, false) then raise exception 'Las visitas son solo para miembros VIP.'; end if;
  if new.fecha <= hoy then raise exception 'Elige una fecha a partir de mañana.'; end if;
  if new.fecha > hoy + 56 then raise exception 'Solo se puede agendar con hasta 8 semanas de anticipación.'; end if;
  if exists (select 1 from public.visitas v where v.user_id = new.user_id and v.estado in ('pendiente', 'aprobada') and v.fecha >= hoy) then
    raise exception 'Ya tienes una visita pendiente o aprobada. Cancélala si quieres pedir otra.';
  end if;
  if (select count(*) from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada') >= cupo then
    raise exception 'Ese horario ya está completo. Elige otro.';
  end if;
  new.tema := left(btrim(new.tema), 60);
  new.detalle := left(btrim(new.detalle), 600);
  return new;
end $$;

-- Turnos completos (para mostrarlos como ocupados).
create or replace function public.visitas_ocupadas() returns table(fecha date, hora time)
language sql stable security definer set search_path = public as $$
  select v.fecha, v.hora from public.visitas v
  where v.estado = 'aprobada' and v.fecha >= (now() at time zone 'America/Asuncion')::date
  group by v.fecha, v.hora having count(*) >= greatest(1, public.ajuste_num('visitas_cupo', 3));
$$;
grant execute on function public.visitas_ocupadas() to authenticated;
