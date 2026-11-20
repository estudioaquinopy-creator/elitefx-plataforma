-- 0071 · Ranking: entre las personas del Top 10 NO se suman puntos entre sí (respuestas, "útil" y me gusta). Idempotente. Correr después de 0070.
-- Regla: primero se calcula el ranking normal (con la penalización del Top 3 ya aplicada) y se toman las 10 primeras personas; luego se vuelve a calcular
-- sin contar, entre esas 10, las respuestas, las marcas de "útil" ni los me gusta que se den unas a otras. Con el resto de la comunidad todo cuenta igual.
-- Sirve para el mes en curso (se calcula en vivo) y para los meses que se cierren de ahora en adelante; los meses ya cerrados quedan guardados como estaban.
-- El conjunto del Top 10 se define con los puntos ANTES de quitar esas interacciones (así no se vuelve circular).

-- 1) El cálculo de puntos (copia de ranking_mes_base de la migración 0063) con la lista de personas excluidas entre sí.
create or replace function public.ranking_mes_base_x(p_mes text, p_excl uuid[])
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int, referidos int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare t0 timestamptz; t1 timestamptz; pc int; pr int; prv int; tope int; pfoto int; pliq int; pliqr int;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido.'; end if;
  t0 := (public.ranking_cierre(to_char((p_mes || '-01')::date - interval '1 month', 'YYYY-MM')) + 1)::timestamp at time zone 'America/Asuncion';
  t1 := (public.ranking_cierre(p_mes) + 1)::timestamp at time zone 'America/Asuncion';
  pc := public.ajuste_num('ranking_pts_certificado', 10);
  pr := public.ajuste_num('ranking_pts_ref', 5);
  prv := public.ajuste_num('ranking_pts_ref_vip', 10);
  tope := public.ajuste_num('ranking_ref_tope', 10);
  pfoto := public.ajuste_num('ranking_pts_foto', 5);
  pliq := public.ajuste_num('ranking_pts_liquid', 5);
  pliqr := public.ajuste_num('ranking_pts_liquid_real', 5);
  -- Reglas de Liquid de los meses anteriores a noviembre de 2026: 5 puntos por la cuenta y 5 por operar en real. Desde noviembre: los ajustes actuales (20 y 0).
  if p_mes < '2026-11' then pliq := 5; pliqr := 5; end if;
  return query
  with el as (
    select pf.id as uid, coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nom
    from public.perfiles pf
    where pf.rol <> 'admin' and pf.prueba_hasta is null
      and ((pf.plan <> 'gratis' and (pf.vence is null or pf.vence >= (t0 at time zone 'America/Asuncion')::date))
           or (pf.es_alumno and pf.vence is not null and pf.vence >= (t0 at time zone 'America/Asuncion')::date))
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
          and not (c.user_id = any(p_excl) and p.user_id = any(p_excl))
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
        and not (c.user_id = any(p_excl) and p.user_id = any(p_excl))
    ) u where u.ru = 1 and u.t >= t0 and u.t < t1
    union all
    select ce.user_id, (ce.emitido_at at time zone 'America/Asuncion')::date, pc, 'certificado'
    from public.certificados ce where ce.emitido_at >= t0 and ce.emitido_at < t1
    union all
    select r.user_id, (r.t at time zone 'America/Asuncion')::date, pr, 'ref'
    from (
      select x.referido_por as user_id, x.t, row_number() over (partition by x.referido_por order by x.t) as rn
      from (
        select pf.referido_por, (select min(g.completada_at) from public.progreso g where g.user_id = pf.id) as t
        from public.perfiles pf where pf.referido_por is not null
      ) x where x.t >= t0 and x.t < t1
    ) r where r.rn <= tope
    union all
    select pf.referido_por, (pf.vip_desde at time zone 'America/Asuncion')::date, prv, 'refvip'
    from public.perfiles pf
    where pf.referido_por is not null and pf.plan <> 'gratis' and pf.vip_desde >= t0 and pf.vip_desde < t1
    union all
    select pf.id, (pf.avatar_desde at time zone 'America/Asuncion')::date, pfoto, 'foto'
    from public.perfiles pf where pf.avatar_desde >= t0 and pf.avatar_desde < t1
    union all
    select li.user_id, (li.revisado_at at time zone 'America/Asuncion')::date, pliq, 'liquid'
    from public.liquid_cuentas li where li.estado = 'aprobado' and li.revisado_at >= t0 and li.revisado_at < t1
    union all
    select li.user_id, (li.reward_at at time zone 'America/Asuncion')::date, pliqr, 'liquidreal'
    from public.liquid_cuentas li where li.estado = 'aprobado' and li.reward_at >= t0 and li.reward_at < t1
    union all
    select sp.user_id, sp.dia, sp.pts, 'chat'
    from public.sala_puntos sp where sp.created_at >= t0 and sp.created_at < t1
    union all
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, 1, 'like'
    from (select l2.post_id, l2.user_id, l2.created_at, row_number() over (partition by l2.post_id order by l2.created_at) as rn from public.likes l2 join public.publicaciones p2 on p2.id = l2.post_id
          where not (l2.user_id = any(p_excl) and p2.user_id = any(p_excl))) l
    join public.publicaciones p on p.id = l.post_id
    where l.rn <= 10 and l.user_id <> p.user_id and p.canal in ('preguntas', 'resultados') and l.created_at >= t0 and l.created_at < t1
  ),
  dia as (
    select e.uid, e.d,
      least(coalesce(sum(e.pts) filter (where e.tipo not in ('util', 'certificado', 'ref', 'refvip', 'foto', 'liquid', 'liquidreal')), 0), 12) + coalesce(sum(e.pts) filter (where e.tipo in ('util', 'certificado', 'ref', 'refvip', 'foto', 'liquid', 'liquidreal')), 0) as pts
    from ev e group by e.uid, e.d
  ),
  tot as (select d.uid, sum(d.pts)::int as pts from dia d group by d.uid),
  cnt as (
    select e.uid,
      (count(*) filter (where e.tipo = 'resultados'))::int as r, (count(*) filter (where e.tipo = 'preguntas'))::int as q,
      (count(*) filter (where e.tipo = 'respuesta'))::int as a, (count(*) filter (where e.tipo = 'util'))::int as u,
      (count(*) filter (where e.tipo = 'like'))::int as l, (count(*) filter (where e.tipo = 'certificado'))::int as ce, (count(*) filter (where e.tipo = 'ref'))::int as rf
    from ev e group by e.uid
  ),
  adj as (select a.user_id as uid, sum(a.puntos)::int as pts from public.ranking_ajustes a where a.mes = p_mes group by a.user_id)
  select el.uid, el.nom, (coalesce(tot.pts, 0) + coalesce(adj.pts, 0))::int,
         coalesce(cnt.r, 0), coalesce(cnt.q, 0), coalesce(cnt.a, 0), coalesce(cnt.u, 0), coalesce(cnt.l, 0), coalesce(cnt.ce, 0), coalesce(cnt.rf, 0)
  from el
  left join tot on tot.uid = el.uid
  left join cnt on cnt.uid = el.uid
  left join adj on adj.uid = el.uid
  where coalesce(tot.pts, 0) + coalesce(adj.pts, 0) > 0
  order by 3 desc, 2;
end $$;
revoke all on function public.ranking_mes_base_x(text, uuid[]) from public, authenticated;

-- 2) ranking_mes_base sigue existiendo (sin exclusiones), por compatibilidad.
create or replace function public.ranking_mes_base(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int, referidos int)
language sql volatile security definer set search_path = public as $$
  select * from public.ranking_mes_base_x(p_mes, '{}'::uuid[]);
$$;
revoke all on function public.ranking_mes_base(text) from public, authenticated;

-- 3) ranking_mes_calc: penalización del Top 3 (0067) + regla del Top 10.
create or replace function public.ranking_mes_calc(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int, referidos int)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare pct int := least(100, greatest(0, public.ajuste_num('ranking_penal_top3', 20))); ex uuid[];
begin
  ex := coalesce(array(
    with pen as (select z.user_id as uid from public.ranking_penalizados(p_mes) z)
    select y.uid from (
      select x.user_id as uid, x.nombre as nom,
             (case when exists (select 1 from pen where pen.uid = x.user_id) then (x.puntos * (100 - pct)) / 100 else x.puntos end)::int as pts
      from public.ranking_mes_base_x(p_mes, '{}'::uuid[]) x
    ) y where y.pts > 0 order by y.pts desc, y.nom limit 10
  ), '{}'::uuid[]);
  return query
  with pen as (select z.user_id as uid from public.ranking_penalizados(p_mes) z),
  b as (
    select x.user_id as uid, x.nombre as nom,
           (case when exists (select 1 from pen where pen.uid = x.user_id) then (x.puntos * (100 - pct)) / 100 else x.puntos end)::int as pts,
           x.resultados as r, x.preguntas as q, x.respuestas as a, x.utiles as u, x.likes as l, x.certificados as c, x.referidos as rf
    from public.ranking_mes_base_x(p_mes, ex) x
  )
  select b.uid, b.nom, b.pts, b.r, b.q, b.a, b.u, b.l, b.c, b.rf from b where b.pts > 0 order by 3 desc, 2;
end $$;
revoke all on function public.ranking_mes_calc(text) from public, authenticated;

notify pgrst, 'reload schema';
