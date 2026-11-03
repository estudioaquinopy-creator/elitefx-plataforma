-- 0046 · Los meses del ranking se CIERRAN de verdad: al llegar el cierre (último viernes 23:59, Paraguay) el resultado se guarda y ya no cambia,
-- aunque después alguien cambie de membresía o se cambien las reglas de puntos. Idempotente. Correr después de 0045.
--  · ranking_mes_calc(mes): el cálculo (antes ranking_mes). Corrige quién participa: quien era VIP al empezar el período sigue contando aunque su VIP venza después
--    (pasa a "gratuito alumno" conservando `vence`). Los meses anteriores a noviembre de 2026 usan las reglas de Liquid de entonces (5 + 5).
--  · ranking_mes(mes): si el mes ya cerró, devuelve el resultado guardado (lo guarda la primera vez que se pide); si no, calcula en vivo. Los ajustes manuales de puntos del administrador siguen aplicándose también a meses cerrados.
--  · Al final se muestra una VISTA PREVIA de octubre de 2026 (sin guardarlo todavía): deben salir José Paredes 77, Mathias Vera 72, Ricardo Espinosa 67.
--    El resultado de octubre se guarda la primera vez que alguien abre el ranking. Si la vista previa no coincide, avísame antes de abrir el ranking.

create table if not exists public.ranking_meses_cerrados (
  mes text primary key,
  cerrado_at timestamptz not null default now()
);
create table if not exists public.ranking_cierres (
  mes text not null,
  user_id uuid not null,
  nombre text not null,
  puntos int not null,
  adj_guardado int not null default 0,   -- ajustes manuales ya incluidos en `puntos` al guardar
  resultados int not null default 0, preguntas int not null default 0, respuestas int not null default 0,
  utiles int not null default 0, likes int not null default 0, certificados int not null default 0, referidos int not null default 0,
  primary key (mes, user_id)
);
alter table public.ranking_meses_cerrados enable row level security;
alter table public.ranking_cierres enable row level security;

create or replace function public.ranking_mes_calc(p_mes text)
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
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, 1, 'like'
    from (select l2.post_id, l2.user_id, l2.created_at, row_number() over (partition by l2.post_id order by l2.created_at) as rn from public.likes l2) l
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

revoke all on function public.ranking_mes_calc(text) from public, authenticated;

-- Guarda el resultado de un mes ya cerrado (una sola vez).
create or replace function public.ranking_cerrar(p_mes text) returns void
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform pg_advisory_xact_lock(hashtext('ranking_cierre' || p_mes));
  if exists (select 1 from public.ranking_meses_cerrados m where m.mes = p_mes) then return; end if;
  insert into public.ranking_cierres (mes, user_id, nombre, puntos, adj_guardado, resultados, preguntas, respuestas, utiles, likes, certificados, referidos)
  select p_mes, r.user_id, r.nombre, r.puntos,
         coalesce((select sum(a.puntos)::int from public.ranking_ajustes a where a.mes = p_mes and a.user_id = r.user_id), 0),
         r.resultados, r.preguntas, r.respuestas, r.utiles, r.likes, r.certificados, r.referidos
  from public.ranking_mes_calc(p_mes) r
  on conflict (mes, user_id) do nothing;
  insert into public.ranking_meses_cerrados (mes) values (p_mes) on conflict (mes) do nothing;
end $$;
revoke all on function public.ranking_cerrar(text) from public, authenticated;

-- Ranking de un mes: guardado si ya cerró; en vivo si todavía está abierto.
create or replace function public.ranking_mes(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int, referidos int)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido.'; end if;
  if now() >= (public.ranking_cierre(p_mes) + 1)::timestamp at time zone 'America/Asuncion' then
    perform public.ranking_cerrar(p_mes);
    return query
    select c.user_id, c.nombre,
           (c.puntos - c.adj_guardado + coalesce((select sum(a.puntos)::int from public.ranking_ajustes a where a.mes = p_mes and a.user_id = c.user_id), 0))::int,
           c.resultados, c.preguntas, c.respuestas, c.utiles, c.likes, c.certificados, c.referidos
    from public.ranking_cierres c
    where c.mes = p_mes
      and (c.puntos - c.adj_guardado + coalesce((select sum(a.puntos)::int from public.ranking_ajustes a where a.mes = p_mes and a.user_id = c.user_id), 0)) > 0
    order by 3 desc, 2;
  else
    return query select * from public.ranking_mes_calc(p_mes);
  end if;
end $$;
grant execute on function public.ranking_mes(text) to authenticated;

-- VISTA PREVIA (no guarda nada): el podio de octubre de 2026 debe ser José Paredes 77, Mathias Vera 72, Ricardo Espinosa 67.
select r.nombre, r.puntos from public.ranking_mes_calc('2026-10') r order by r.puntos desc, r.nombre limit 6;
