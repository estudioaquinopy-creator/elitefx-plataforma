-- 0077 · Se quita el Chat en vivo: el ranking deja de sumar sus puntos (mensajes, reacciones e imágenes). Idempotente. Correr después de 0076.
-- Reemplaza ranking_mes_base_x (la copia de la 0074 sin el chat) y ranking_detalle (la de la 0076 sin el chat). ranking_mes_base y ranking_mes_calc no cambian.
-- Efecto: el ranking del mes abierto se recalcula sin puntos de chat (puede cambiar el podio). Los meses ya cerrados quedan guardados como estaban.
-- NO borra datos: las tablas sala_mensajes, sala_reacciones, sala_bloqueos y sala_puntos y el bucket "sala" siguen en la base (ver el bloque opcional del final).

create or replace function public.ranking_mes_base_x(p_mes text, p_excl uuid[], p_mitad uuid[] default '{}'::uuid[])
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
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, (case when l.user_id = any(p_mitad) and p.user_id = any(p_mitad) then 0.5 else 1 end), 'like'
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
  tot as (select d.uid, floor(sum(d.pts))::int as pts from dia d group by d.uid),
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
revoke all on function public.ranking_mes_base_x(text, uuid[], uuid[]) from public, authenticated;

create or replace function public.ranking_detalle(p_mes text, p_user uuid)
returns table(tipo text, dia date, cuando timestamptz, pts numeric, post_id uuid, com_id uuid, otro text)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  t0 timestamptz; t1 timestamptz; pc int; pr int; prv int; tope int; pfoto int; pliq int; pliqr int;
  pct int := least(100, greatest(0, public.ajuste_num('ranking_penal_top3', 20)));
  t10 uuid[]; ex uuid[]; esp boolean;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede ver esto.'; end if;
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
  if p_mes < '2026-11' then pliq := 5; pliqr := 5; end if;

  -- ¿Participa en el ranking de ese mes? (mismas condiciones que ranking_mes_base_x)
  if not exists (
    select 1 from public.perfiles pf
    where pf.id = p_user and pf.rol <> 'admin' and pf.prueba_hasta is null
      and ((pf.plan <> 'gratis' and (pf.vence is null or pf.vence >= (t0 at time zone 'America/Asuncion')::date))
           or (pf.es_alumno and pf.vence is not null and pf.vence >= (t0 at time zone 'America/Asuncion')::date))
  ) then return; end if;

  -- Top 10 y Top 3 del mes, igual que en ranking_mes_calc.
  t10 := coalesce(array(
    with pen as (select z.user_id as uid from public.ranking_penalizados(p_mes) z)
    select y.uid from (
      select x.user_id as uid, x.nombre as nom,
             (case when exists (select 1 from pen where pen.uid = x.user_id) then (x.puntos * (100 - pct)) / 100 else x.puntos end)::int as pts
      from public.ranking_mes_base_x(p_mes, '{}'::uuid[], '{}'::uuid[]) x
    ) y where y.pts > 0 order by y.pts desc, y.nom limit 10
  ), '{}'::uuid[]);
  ex := coalesce(t10[1:3], '{}'::uuid[]);
  esp := exists (select 1 from public.ranking_penalizados(p_mes) z where z.user_id = p_user);

  return query
  with ev as (
    select q.uid, q.d, q.t, q.pts::numeric as pts, q.tp, q.pid, null::uuid as cid, null::text as ot from (
      select p.user_id as uid, (p.created_at at time zone 'America/Asuncion')::date as d, p.created_at as t,
             case when p.canal = 'resultados' then 3 + (case when p.imagen_url is not null then 1 else 0 end) else 2 end as pts,
             p.canal::text as tp, p.id as pid,
             row_number() over (partition by p.user_id, (p.created_at at time zone 'America/Asuncion')::date, p.canal order by p.created_at) as rn
      from public.publicaciones p
      where p.user_id = p_user and p.canal in ('preguntas', 'resultados') and p.created_at >= t0 and p.created_at < t1
        and (length(btrim(p.cuerpo)) + length(btrim(p.titulo)) >= 15 or p.imagen_url is not null)
    ) q where q.rn <= 2
    union all
    select y.user_id, y.d, y.t, 1::numeric, 'respuesta'::text, y.post_id, y.com_id, null::text
    from (
      select x.user_id, x.d, x.t, x.post_id, x.com_id, row_number() over (partition by x.user_id, x.d order by x.t) as rd
      from (
        select c.user_id, (c.created_at at time zone 'America/Asuncion')::date as d, c.created_at as t, c.post_id, c.id as com_id,
               row_number() over (partition by c.user_id, c.post_id order by c.created_at) as rp
        from public.comentarios c join public.publicaciones p on p.id = c.post_id
        where c.user_id = p_user and length(btrim(c.cuerpo)) >= 20 and c.user_id <> p.user_id
          and not (c.user_id = any(ex) and p.user_id = any(ex))
      ) x
      where x.rp = 1 and x.t >= t0 and x.t < t1
    ) y where y.rd <= 5
    union all
    select u.user_id, u.d, u.t, 5::numeric, 'util'::text, u.post_id, u.com_id, null::text
    from (
      select c.user_id, (c.created_at at time zone 'America/Asuncion')::date as d, c.created_at as t, c.post_id, c.id as com_id,
             row_number() over (partition by c.user_id, c.post_id order by c.created_at) as ru
      from public.comentarios c join public.publicaciones p on p.id = c.post_id
      where c.user_id = p_user and c.util and c.user_id <> p.user_id
        and not (c.user_id = any(ex) and p.user_id = any(ex))
    ) u where u.ru = 1 and u.t >= t0 and u.t < t1
    union all
    select ce.user_id, (ce.emitido_at at time zone 'America/Asuncion')::date, ce.emitido_at, pc::numeric, 'certificado'::text, null::uuid, null::uuid, cu.nombre
    from public.certificados ce join public.cursos cu on cu.id = ce.curso_id
    where ce.user_id = p_user and ce.emitido_at >= t0 and ce.emitido_at < t1
    union all
    select r.user_id, (r.t at time zone 'America/Asuncion')::date, r.t, pr::numeric, 'ref'::text, null::uuid, null::uuid, r.nom
    from (
      select x.referido_por as user_id, x.t, x.nom, row_number() over (partition by x.referido_por order by x.t) as rn
      from (
        select pf.referido_por, (select min(g.completada_at) from public.progreso g where g.user_id = pf.id) as t,
               coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nom
        from public.perfiles pf where pf.referido_por = p_user
      ) x where x.t >= t0 and x.t < t1
    ) r where r.rn <= tope
    union all
    select pf.referido_por, (pf.vip_desde at time zone 'America/Asuncion')::date, pf.vip_desde, prv::numeric, 'refvip'::text, null::uuid, null::uuid,
           coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1))
    from public.perfiles pf
    where pf.referido_por = p_user and pf.plan <> 'gratis' and pf.vip_desde >= t0 and pf.vip_desde < t1
    union all
    select pf.id, (pf.avatar_desde at time zone 'America/Asuncion')::date, pf.avatar_desde, pfoto::numeric, 'foto'::text, null::uuid, null::uuid, null::text
    from public.perfiles pf where pf.id = p_user and pf.avatar_desde >= t0 and pf.avatar_desde < t1
    union all
    select li.user_id, (li.revisado_at at time zone 'America/Asuncion')::date, li.revisado_at, pliq::numeric, 'liquid'::text, null::uuid, null::uuid, li.cuenta
    from public.liquid_cuentas li where li.user_id = p_user and li.estado = 'aprobado' and li.revisado_at >= t0 and li.revisado_at < t1
    union all
    select li.user_id, (li.reward_at at time zone 'America/Asuncion')::date, li.reward_at, pliqr::numeric, 'liquidreal'::text, null::uuid, null::uuid, li.cuenta
    from public.liquid_cuentas li where li.user_id = p_user and li.estado = 'aprobado' and li.reward_at >= t0 and li.reward_at < t1
    union all
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, l.created_at,
           (case when l.user_id = any(t10) and p.user_id = any(t10) then 0.5 else 1 end)::numeric, 'like'::text, l.post_id, null::uuid, l.nom
    from (
      select l2.post_id, l2.user_id, l2.created_at, coalesce(nullif(btrim(pl.nombre), ''), split_part(pl.email, '@', 1)) as nom,
             row_number() over (partition by l2.post_id order by l2.created_at) as rn
      from public.likes l2 join public.publicaciones p2 on p2.id = l2.post_id left join public.perfiles pl on pl.id = l2.user_id
      where p2.user_id = p_user and not (l2.user_id = any(ex) and p2.user_id = any(ex))
    ) l
    join public.publicaciones p on p.id = l.post_id
    where l.rn <= 10 and l.user_id <> p.user_id and p.canal in ('preguntas', 'resultados') and l.created_at >= t0 and l.created_at < t1
  ),
  -- Tope de 12 puntos al día para lo que tiene tope (todo menos útiles, certificados, referidos, foto y Liquid): se cuenta en orden cronológico.
  capt as (
    select e.*,
      case when e.tp in ('util', 'certificado', 'ref', 'refvip', 'foto', 'liquid', 'liquidreal') then e.pts
           else greatest(0::numeric, least(e.pts, 12 - coalesce(sum(case when e.tp in ('util', 'certificado', 'ref', 'refvip', 'foto', 'liquid', 'liquidreal') then 0 else e.pts end)
                 over (partition by e.d order by e.t, e.tp, e.pid, e.cid, e.ot rows between unbounded preceding and 1 preceding), 0)))
      end as cuenta
    from ev e
  ),
  fin as (
    select c.tp, c.d, c.t, c.cuenta, c.pid, c.cid, c.ot from capt c where c.cuenta > 0
    union all
    select 'ajuste'::text, (a.created_at at time zone 'America/Asuncion')::date, a.created_at, a.puntos::numeric, null::uuid, null::uuid, a.motivo
    from public.ranking_ajustes a where a.mes = p_mes and a.user_id = p_user and a.puntos <> 0
  ),
  tt as (
    select coalesce(sum(f.cuenta) filter (where f.tp <> 'ajuste'), 0) as s, coalesce(sum(f.cuenta) filter (where f.tp = 'ajuste'), 0) as a from fin f
  ),
  bs as (select (floor(tt.s) + tt.a)::int as b, (floor(tt.s) - tt.s) as red from tt)
  select f.tp, f.d, f.t, f.cuenta, f.pid, f.cid, f.ot from fin f
  union all
  select 'redondeo'::text, null::date, null::timestamptz, bs.red, null::uuid, null::uuid, 'Redondeo hacia abajo'::text from bs where bs.red <> 0
  union all
  select 'penal'::text, null::date, null::timestamptz, (((bs.b * (100 - pct)) / 100) - bs.b)::numeric, null::uuid, null::uuid, ('Penalización del Top 3 del mes anterior (−' || pct || ' %)')::text
  from bs where esp and ((bs.b * (100 - pct)) / 100) - bs.b <> 0;
end $$;
revoke all on function public.ranking_detalle(text, uuid) from public;
grant execute on function public.ranking_detalle(text, uuid) to authenticated;

-- Deja de registrar puntos del chat (los disparadores de la 0063). No falla si ya no existen.
do $$ begin
  begin drop trigger if exists sala_puntos_mensaje_tr on public.sala_mensajes; exception when others then null; end;
  begin drop trigger if exists sala_puntos_reaccion_tr on public.sala_reacciones; exception when others then null; end;
end $$;

notify pgrst, 'reload schema';

-- OPCIONAL, SOLO SI QUIERES BORRAR POR COMPLETO LOS DATOS DEL CHAT (no se puede deshacer; no está activo):
-- drop table if exists public.sala_puntos, public.sala_reacciones, public.sala_bloqueos, public.sala_mensajes cascade;
-- y en Storage → bucket "sala": vaciarlo y eliminarlo.
