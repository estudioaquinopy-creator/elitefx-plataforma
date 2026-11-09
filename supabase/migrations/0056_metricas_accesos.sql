-- 0056 · Métricas de accesos y actividad (solo administradores). Idempotente. Correr después de 0055.
-- La actividad empieza a registrarse desde el momento en que se despliega esta versión (no hay historial anterior).
create table if not exists public.actividad (
  user_id uuid not null references public.perfiles(id) on delete cascade,
  dia date not null,
  hora smallint not null,
  seccion text not null,
  n int not null default 1,
  primary key (user_id, dia, hora, seccion)
);
create index if not exists actividad_dia_idx on public.actividad (dia);
alter table public.actividad enable row level security;  -- sin políticas: solo se usa por las funciones de abajo

-- Cada persona registra sus propias visitas (una fila por día, hora de Paraguay y sección).
create or replace function public.registrar_actividad(p_seccion text) returns void
language plpgsql security definer set search_path = public as $$
declare loc timestamp := now() at time zone 'America/Asuncion'; sec text;
begin
  if auth.uid() is null then return; end if;
  sec := left(regexp_replace(lower(coalesce(p_seccion, 'otra')), '[^a-z0-9-]', '', 'g'), 30);
  if sec = '' then sec := 'otra'; end if;
  insert into public.actividad (user_id, dia, hora, seccion) values (auth.uid(), loc::date, extract(hour from loc)::smallint, sec)
  on conflict (user_id, dia, hora, seccion) do update set n = public.actividad.n + 1;
end $$;
grant execute on function public.registrar_actividad(text) to authenticated;

create or replace function public.metricas_accesos() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Asuncion')::date; r jsonb;
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  with a as (select x.* from public.actividad x join public.perfiles p on p.id = x.user_id where p.rol <> 'admin' and x.dia > hoy - 30),
  pf as (select * from public.perfiles where rol <> 'admin'),
  tipo as (select id, case when prueba_hasta is not null and prueba_hasta > now() then 'prueba'
                           when plan::text <> 'gratis' and (vence is null or vence >= hoy) then 'vip'
                           when es_alumno then 'alumno' else 'nuevo' end t from pf)
  select jsonb_build_object(
    'actividad_desde', (select min(dia) from public.actividad),
    'hoy', (select count(distinct user_id) from a where dia = hoy),
    'ayer', (select count(distinct user_id) from a where dia = hoy - 1),
    'd7', (select count(distinct user_id) from a where dia > hoy - 7),
    'd30', (select count(distinct user_id) from a),
    'por_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'n', coalesce(c, 0)) order by d), '[]') from
                 (select g::date d, (select count(distinct user_id) from a where a.dia = g::date) c from generate_series(hoy - 29, hoy, interval '1 day') g) s),
    'por_hora', (select coalesce(jsonb_agg(jsonb_build_object('hora', h, 'vistas', coalesce(v, 0), 'usuarios', coalesce(u, 0)) order by h), '[]') from
                 (select g h, (select sum(n) from a where a.hora = g) v, (select count(distinct user_id) from a where a.hora = g) u from generate_series(0, 23) g) s),
    'por_semana', (select coalesce(jsonb_agg(jsonb_build_object('dow', g, 'usuarios', coalesce(u, 0), 'vistas', coalesce(v, 0)) order by g), '[]') from
                 (select g, (select count(distinct (user_id, dia)) from a where extract(dow from a.dia) = g) u, (select sum(n) from a where extract(dow from a.dia) = g) v from generate_series(0, 6) g) s),
    'secciones', (select coalesce(jsonb_agg(x order by (x->>'vistas')::int desc), '[]') from (select jsonb_build_object('seccion', seccion, 'vistas', sum(n)::int, 'usuarios', count(distinct user_id)) x from a group by seccion) s),
    'top_usuarios', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('id', user_id, 'nombre', coalesce(nullif(btrim(p.nombre), ''), split_part(p.email, '@', 1)), 'dias', count(distinct a.dia), 'vistas', sum(a.n)::int) x
                 from a join public.perfiles p on p.id = a.user_id group by user_id, p.nombre, p.email order by count(distinct a.dia) desc, sum(a.n) desc limit 10) s),
    'registros_dia', (select coalesce(jsonb_agg(jsonb_build_object('dia', d, 'n', coalesce(c, 0)) order by d), '[]') from
                 (select g::date d, (select count(*) from pf where (pf.created_at at time zone 'America/Asuncion')::date = g::date) c from generate_series(hoy - 29, hoy, interval '1 day') g) s),
    'registros_hoy', (select count(*) from pf where (created_at at time zone 'America/Asuncion')::date = hoy),
    'registros_30', (select count(*) from pf where created_at > now() - interval '30 days'),
    'tipos', (select jsonb_build_object('total', count(*), 'vip', count(*) filter (where t = 'vip'), 'prueba', count(*) filter (where t = 'prueba'), 'alumno', count(*) filter (where t = 'alumno'), 'nuevo', count(*) filter (where t = 'nuevo')) from tipo),
    'por_vencer_7', (select count(*) from pf where plan::text <> 'gratis' and prueba_hasta is null and vence between hoy and hoy + 7),
    'vencidos_30', (select count(*) from pf where vence < hoy and vence >= hoy - 30 and prueba_hasta is null and (plan::text <> 'gratis' or es_alumno)),
    'nuevos_vip_30', (select count(*) from pf where vip_desde > now() - interval '30 days'),
    'vip_sin_actividad_14', (select count(*) from tipo t where t.t = 'vip' and not exists (select 1 from public.actividad x where x.user_id = t.id and x.dia > hoy - 14)),
    'lecciones_30', (select count(*) from public.progreso g join pf on pf.id = g.user_id where g.completada_at > now() - interval '30 days'),
    'alumnos_estudian_30', (select count(distinct g.user_id) from public.progreso g join pf on pf.id = g.user_id where g.completada_at > now() - interval '30 days'),
    'top_cursos', (select coalesce(jsonb_agg(x), '[]') from (select jsonb_build_object('curso', c.nombre, 'lecciones', count(*)::int) x from public.progreso g join public.lecciones l on l.id = g.leccion_id join public.cursos c on c.id = l.curso_id join pf on pf.id = g.user_id
                 where g.completada_at > now() - interval '30 days' group by c.nombre order by count(*) desc limit 6) s),
    'examenes_30', (select jsonb_build_object('intentos', count(*), 'aprobados', count(*) filter (where aprobado)) from public.examen_intentos where created_at > now() - interval '30 days'),
    'certificados_30', (select count(*) from public.certificados where emitido_at > now() - interval '30 days'),
    'publicaciones_30', (select count(*) from public.publicaciones where created_at > now() - interval '30 days'),
    'respuestas_30', (select count(*) from public.comentarios where created_at > now() - interval '30 days'),
    'dudas_30', (select count(*) from public.lecciones_comentarios where parent_id is null and created_at > now() - interval '30 days'),
    'dudas_sin_responder', (select count(*) from public.lecciones_comentarios q where q.parent_id is null and not exists (select 1 from public.lecciones_comentarios r where r.parent_id = q.id)),
    'visitas_pendientes', (select count(*) from public.visitas where estado = 'pendiente'),
    'liquid_pendientes', (select count(*) from public.liquid_cuentas where estado = 'pendiente'),
    'liquid_aprobadas', (select count(*) from public.liquid_cuentas where estado = 'aprobado')
  ) into r;
  return r;
end $$;
grant execute on function public.metricas_accesos() to authenticated;
