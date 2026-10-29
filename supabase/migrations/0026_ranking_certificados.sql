-- 0026 · Ranking: cada certificado obtenido suma puntos (por defecto 10; se cambia en Ajustes → clave ranking_pts_certificado desde la página del ranking). Idempotente. Correr después de 0025.
-- Los puntos de certificado no cuentan para el tope diario de 12 (como las respuestas útiles) y se suman en el mes en que se aprobó el examen.
-- Además: crea los certificados de quienes ya habían aprobado exámenes antes de la 0025 (no suman puntos de meses pasados).

insert into public.certificados (user_id, curso_id, codigo, emitido_at)
select x.user_id, x.curso_id, 'EFX-' || upper(substr(md5(random()::text || clock_timestamp()::text || x.user_id::text || x.curso_id::text), 1, 8)), x.f
from (
  select i.user_id, i.curso_id, min(i.created_at) as f
  from public.examen_intentos i join public.cursos cu on cu.id = i.curso_id
  where i.aprobado and translate(lower(cu.nombre), 'áéíóú', 'aeiou') ~ '^curso\s+(basico|intermedio|avanzado)'
  group by i.user_id, i.curso_id
) x
on conflict do nothing;

drop function if exists public.ranking_mes(text);
create or replace function public.ranking_mes(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare t0 timestamptz; t1 timestamptz; pc int;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido.'; end if;
  t0 := (public.ranking_cierre(to_char((p_mes || '-01')::date - interval '1 month', 'YYYY-MM')) + 1)::timestamp at time zone 'America/Asuncion';
  t1 := (public.ranking_cierre(p_mes) + 1)::timestamp at time zone 'America/Asuncion';
  select case when a.valor ~ '^\s*\d{1,3}\s*$' then btrim(a.valor)::int else 10 end into pc from (select 1) z left join public.ajustes a on a.clave = 'ranking_pts_certificado';
  pc := coalesce(pc, 10);
  return query
  with el as (
    select pf.id as uid, coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nom
    from public.perfiles pf where pf.plan <> 'gratis' and pf.rol <> 'admin'
  ),
  ev as (
    select q.uid, q.d, q.pts, q.tipo from (
      select p.user_id as uid, (p.created_at at time zone 'America/Asuncion')::date as d,
             case when p.canal = 'resultados' then 3 + (case when p.imagen_url is not null then 1 else 0 end) else 2 end as pts,
             p.canal::text as tipo,
             row_number() over (partition by p.user_id, (p.created_at at time zone 'America/Asuncion')::date, p.canal order by p.created_at) as rn
      from public.publicaciones p
      where p.canal in ('preguntas', 'resultados') and p.created_at >= t0 and p.created_at < t1
        and (length(btrim(p.cuerpo)) + length(btrim(p.titulo)) >= 15 or p.imagen_url is not null)
    ) q where q.rn <= 2
    union all
    select y.user_id, y.d, 1, 'respuesta'
    from (
      select x.user_id, x.d, row_number() over (partition by x.user_id, x.d order by x.t) as rd
      from (
        select c.user_id, (c.created_at at time zone 'America/Asuncion')::date as d, c.created_at as t,
               row_number() over (partition by c.user_id, c.post_id order by c.created_at) as rp
        from public.comentarios c join public.publicaciones p on p.id = c.post_id
        where length(btrim(c.cuerpo)) >= 20 and c.user_id <> p.user_id
      ) x
      where x.rp = 1 and x.t >= t0 and x.t < t1
    ) y where y.rd <= 5
    union all
    select u.user_id, u.d, 5, 'util'
    from (
      select c.user_id, (c.created_at at time zone 'America/Asuncion')::date as d, c.created_at as t,
             row_number() over (partition by c.user_id, c.post_id order by c.created_at) as ru
      from public.comentarios c join public.publicaciones p on p.id = c.post_id
      where c.util and c.user_id <> p.user_id
    ) u where u.ru = 1 and u.t >= t0 and u.t < t1
    union all
    select ce.user_id, (ce.emitido_at at time zone 'America/Asuncion')::date, pc, 'certificado'
    from public.certificados ce where ce.emitido_at >= t0 and ce.emitido_at < t1
    union all
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, 1, 'like'
    from (select l2.post_id, l2.user_id, l2.created_at, row_number() over (partition by l2.post_id order by l2.created_at) as rn from public.likes l2) l
    join public.publicaciones p on p.id = l.post_id
    where l.rn <= 10 and l.user_id <> p.user_id and p.canal in ('preguntas', 'resultados') and l.created_at >= t0 and l.created_at < t1
  ),
  dia as (
    select e.uid, e.d,
      least(coalesce(sum(e.pts) filter (where e.tipo not in ('util', 'certificado')), 0), 12) + coalesce(sum(e.pts) filter (where e.tipo in ('util', 'certificado')), 0) as pts
    from ev e group by e.uid, e.d
  ),
  tot as (select d.uid, sum(d.pts)::int as pts from dia d group by d.uid),
  cnt as (
    select e.uid,
      (count(*) filter (where e.tipo = 'resultados'))::int as r, (count(*) filter (where e.tipo = 'preguntas'))::int as q,
      (count(*) filter (where e.tipo = 'respuesta'))::int as a, (count(*) filter (where e.tipo = 'util'))::int as u,
      (count(*) filter (where e.tipo = 'like'))::int as l, (count(*) filter (where e.tipo = 'certificado'))::int as ce
    from ev e group by e.uid
  ),
  adj as (select a.user_id as uid, sum(a.puntos)::int as pts from public.ranking_ajustes a where a.mes = p_mes group by a.user_id)
  select el.uid, el.nom, (coalesce(tot.pts, 0) + coalesce(adj.pts, 0))::int,
         coalesce(cnt.r, 0), coalesce(cnt.q, 0), coalesce(cnt.a, 0), coalesce(cnt.u, 0), coalesce(cnt.l, 0), coalesce(cnt.ce, 0)
  from el
  left join tot on tot.uid = el.uid
  left join cnt on cnt.uid = el.uid
  left join adj on adj.uid = el.uid
  where coalesce(tot.pts, 0) + coalesce(adj.pts, 0) > 0
  order by 3 desc, 2;
end $$;
grant execute on function public.ranking_mes(text) to authenticated;
