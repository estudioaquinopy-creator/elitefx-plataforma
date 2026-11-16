-- 0066 · Métricas por rango de fechas y registro de renovaciones VIP. Idempotente. Correr después de 0065.
-- Las renovaciones se cuentan desde el momento en que se corre esta migración (antes no se guardaban).

create table if not exists public.renovaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  vence_antes date,
  vence_despues date
);
create index if not exists renovaciones_fecha_idx on public.renovaciones (created_at);
alter table public.renovaciones enable row level security;
drop policy if exists "renovaciones admin" on public.renovaciones;
create policy "renovaciones admin" on public.renovaciones for select to authenticated using (public.es_admin());

-- Renovación = alguien que ya había sido VIP (o es alumno) y queda VIP con una fecha de vencimiento más lejana.
-- No cuenta: la primera vez que pasa a VIP, ni el paso de prueba a pago, ni los administradores.
create or replace function public.registrar_renovacion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.rol <> 'admin' and new.plan::text <> 'gratis' and new.prueba_hasta is null and new.vence is not null
     and old.prueba_hasta is null and (old.plan::text <> 'gratis' or old.es_alumno)
     and (old.vence is null or new.vence > old.vence) then
    insert into public.renovaciones (user_id, vence_antes, vence_despues) values (new.id, old.vence, new.vence);
  end if;
  return new;
end $$;
drop trigger if exists registrar_renovacion_tr on public.perfiles;
create trigger registrar_renovacion_tr after update of plan, vence on public.perfiles
  for each row execute function public.registrar_renovacion();

-- Métricas entre dos fechas (inclusive, hora de Paraguay). Solo administradores. Máximo 366 días.
create or replace function public.metricas_rango(p_desde date, p_hasta date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  hoy date := (now() at time zone 'America/Asuncion')::date;
  d0 date := least(p_desde, p_hasta);
  d1 date := least(greatest(p_desde, p_hasta), least(p_desde, p_hasta) + 365);
  t0 timestamptz; t1 timestamptz; r jsonb;
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  t0 := (d0::timestamp) at time zone 'America/Asuncion';
  t1 := ((d1 + 1)::timestamp) at time zone 'America/Asuncion';
  with pf as (select * from public.perfiles where rol <> 'admin')
  select jsonb_build_object(
    'desde', d0, 'hasta', d1,
    'registros', (select count(*) from pf where created_at >= t0 and created_at < t1),
    'registros_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'n', c) order by d), '[]') from
        (select g::date d, (select count(*) from pf where pf.created_at >= (g::timestamp at time zone 'America/Asuncion') and pf.created_at < ((g::date + 1)::timestamp at time zone 'America/Asuncion')) c
         from generate_series(d0, d1, interval '1 day') g) s),
    'pruebas', (select count(*) from public.pruebas_canjeadas c join pf on pf.id = c.user_id where c.canjeado_at >= t0 and c.canjeado_at < t1),
    'nuevos_vip', (select count(*) from pf where vip_desde >= t0 and vip_desde < t1),
    'renovaciones', (select count(*) from public.renovaciones x join pf on pf.id = x.user_id where x.created_at >= t0 and x.created_at < t1),
    'renovaron_personas', (select count(distinct x.user_id) from public.renovaciones x join pf on pf.id = x.user_id where x.created_at >= t0 and x.created_at < t1),
    'renovaciones_desde', (select min(created_at) from public.renovaciones),
    'vencieron', (select count(*) from pf where vence between d0 and d1 and vence < hoy and prueba_hasta is null and (plan::text <> 'gratis' or es_alumno)),
    'por_vencer', (select count(*) from pf where vence between d0 and d1 and vence >= hoy and prueba_hasta is null and plan::text <> 'gratis'),
    'activos', (select count(distinct a.user_id) from public.actividad a join pf on pf.id = a.user_id where a.dia between d0 and d1),
    'actividad_desde', (select min(dia) from public.actividad),
    'lecciones', (select count(*) from public.progreso g join pf on pf.id = g.user_id where g.completada_at >= t0 and g.completada_at < t1),
    'alumnos_estudian', (select count(distinct g.user_id) from public.progreso g join pf on pf.id = g.user_id where g.completada_at >= t0 and g.completada_at < t1),
    'examenes', (select count(*) from public.examen_intentos where created_at >= t0 and created_at < t1),
    'examenes_aprobados', (select count(*) from public.examen_intentos where aprobado and created_at >= t0 and created_at < t1),
    'certificados', (select count(*) from public.certificados where emitido_at >= t0 and emitido_at < t1),
    'publicaciones', (select count(*) from public.publicaciones where created_at >= t0 and created_at < t1),
    'respuestas', (select count(*) from public.comentarios where created_at >= t0 and created_at < t1),
    'dudas', (select count(*) from public.lecciones_comentarios where parent_id is null and created_at >= t0 and created_at < t1)
  ) into r;
  return r;
end $$;
grant execute on function public.metricas_rango(date, date) to authenticated;
