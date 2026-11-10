-- 0058 · Visitas: el administrador propone otro horario y la persona debe aceptarlo. Idempotente. Correr después de 0057.
alter table public.visitas add column if not exists propuesta_fecha date;
alter table public.visitas add column if not exists propuesta_hora time;

alter table public.visitas drop constraint if exists visitas_estado_check;
alter table public.visitas add constraint visitas_estado_check check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada', 'propuesta'));

-- La persona puede cancelar también mientras tiene una propuesta de nuevo horario.
drop policy if exists "visitas cancelar" on public.visitas;
create policy "visitas cancelar" on public.visitas for update to authenticated
  using (user_id = auth.uid() and estado in ('pendiente', 'aprobada', 'propuesta')) with check (user_id = auth.uid() and estado = 'cancelada');

-- Una solicitud con propuesta también cuenta como activa (una sola por persona).
create or replace function public.visitas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Asuncion')::date; vip boolean; cupo int := greatest(1, public.ajuste_num('visitas_cupo', 1));
begin
  select (plan <> 'gratis' or rol = 'admin') into vip from public.perfiles where id = new.user_id;
  if not coalesce(vip, false) then raise exception 'Las visitas son solo para miembros VIP.'; end if;
  if new.fecha <= hoy then raise exception 'Elige una fecha a partir de mañana.'; end if;
  if new.fecha > hoy + 56 then raise exception 'Solo se puede agendar con hasta 8 semanas de anticipación.'; end if;
  if exists (select 1 from public.visitas v where v.user_id = new.user_id and v.estado in ('pendiente', 'aprobada', 'propuesta') and v.fecha >= hoy) then
    raise exception 'Ya tienes una visita pendiente o aprobada. Cancélala si quieres pedir otra.';
  end if;
  if (select count(*) from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada') >= cupo then
    raise exception 'Ese horario ya está ocupado. Elige otro.';
  end if;
  new.tema := left(btrim(new.tema), 60);
  new.detalle := left(btrim(new.detalle), 600);
  return new;
end $$;

-- La persona acepta o rechaza el nuevo horario propuesto. Al aceptar, la visita pasa a aprobada en el nuevo día y hora.
create or replace function public.visitas_responder(p_id uuid, p_acepta boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v public.visitas; hoy date := (now() at time zone 'America/Asuncion')::date; cupo int := greatest(1, public.ajuste_num('visitas_cupo', 1));
begin
  select * into v from public.visitas where id = p_id and user_id = auth.uid() and estado = 'propuesta' for update;
  if not found then raise exception 'Esa propuesta ya no está disponible.'; end if;
  if p_acepta then
    if v.propuesta_fecha is null or v.propuesta_hora is null or v.propuesta_fecha <= hoy then raise exception 'Ese horario ya pasó. Pide otra visita.'; end if;
    perform pg_advisory_xact_lock(hashtext(v.propuesta_fecha::text || v.propuesta_hora::text));
    if (select count(*) from public.visitas x where x.fecha = v.propuesta_fecha and x.hora = v.propuesta_hora and x.estado = 'aprobada' and x.id <> v.id) >= cupo then
      raise exception 'Ese horario ya fue ocupado por otra visita. Cancela y pide otro.';
    end if;
    update public.visitas set fecha = v.propuesta_fecha, hora = v.propuesta_hora, estado = 'aprobada', propuesta_fecha = null, propuesta_hora = null, revisado_at = now() where id = v.id;
  else
    update public.visitas set estado = 'cancelada', nota = 'No aceptó el nuevo horario', propuesta_fecha = null, propuesta_hora = null, revisado_at = now() where id = v.id;
  end if;
end $$;
grant execute on function public.visitas_responder(uuid, boolean) to authenticated;
