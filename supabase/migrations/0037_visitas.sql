-- 0037 · Agendar visita a las oficinas (solo miembros VIP). Idempotente. Correr después de 0036.
-- Solo miércoles, entre las 8:00 y las 17:00 (turnos de 1 hora: el último empieza a las 16:00). El administrador aprueba o rechaza a mano.

create table if not exists public.visitas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  fecha date not null,
  hora time not null,
  tema text not null default 'Otro',
  detalle text not null default '',
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  nota text not null default '',
  created_at timestamptz not null default now(),
  revisado_at timestamptz,
  revisado_por uuid references public.perfiles(id) on delete set null,
  constraint visitas_miercoles check (extract(dow from fecha) = 3),
  constraint visitas_horario check (hora >= time '08:00' and hora <= time '16:00' and extract(minute from hora) = 0)
);
-- Un mismo turno no puede aprobarse para dos personas.
create unique index if not exists visitas_turno_uq on public.visitas (fecha, hora) where estado = 'aprobada';
create index if not exists visitas_user_idx on public.visitas (user_id, fecha);

alter table public.visitas enable row level security;
drop policy if exists "visitas ver" on public.visitas;
create policy "visitas ver" on public.visitas for select to authenticated using (user_id = auth.uid() or public.es_admin());
drop policy if exists "visitas pedir" on public.visitas;
create policy "visitas pedir" on public.visitas for insert to authenticated
  with check (user_id = auth.uid() and estado = 'pendiente' and revisado_at is null and nota = '');
drop policy if exists "visitas cancelar" on public.visitas;
create policy "visitas cancelar" on public.visitas for update to authenticated
  using (user_id = auth.uid() and estado in ('pendiente', 'aprobada')) with check (user_id = auth.uid() and estado = 'cancelada');
drop policy if exists "visitas admin" on public.visitas;
create policy "visitas admin" on public.visitas for update to authenticated using (public.es_admin()) with check (public.es_admin());

-- Reglas al pedir una visita: solo VIP (o admin), fecha futura (máx. 8 semanas) y una sola solicitud activa por persona.
create or replace function public.visitas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Asuncion')::date; vip boolean;
begin
  select (plan <> 'gratis' or rol = 'admin') into vip from public.perfiles where id = new.user_id;
  if not coalesce(vip, false) then raise exception 'Las visitas son solo para miembros VIP.'; end if;
  if new.fecha <= hoy then raise exception 'Elige una fecha a partir de mañana.'; end if;
  if new.fecha > hoy + 56 then raise exception 'Solo se puede agendar con hasta 8 semanas de anticipación.'; end if;
  if exists (select 1 from public.visitas v where v.user_id = new.user_id and v.estado in ('pendiente', 'aprobada') and v.fecha >= hoy) then
    raise exception 'Ya tienes una visita pendiente o aprobada. Cancélala si quieres pedir otra.';
  end if;
  if exists (select 1 from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada') then
    raise exception 'Ese horario ya está ocupado. Elige otro.';
  end if;
  new.tema := left(btrim(new.tema), 60);
  new.detalle := left(btrim(new.detalle), 600);
  return new;
end $$;
drop trigger if exists visitas_validar_tr on public.visitas;
create trigger visitas_validar_tr before insert on public.visitas for each row execute function public.visitas_validar();

-- Turnos ya aprobados (para mostrarlos como ocupados sin revelar de quién son).
create or replace function public.visitas_ocupadas() returns table(fecha date, hora time)
language sql stable security definer set search_path = public as $$
  select v.fecha, v.hora from public.visitas v where v.estado = 'aprobada' and v.fecha >= (now() at time zone 'America/Asuncion')::date;
$$;
grant execute on function public.visitas_ocupadas() to authenticated;
