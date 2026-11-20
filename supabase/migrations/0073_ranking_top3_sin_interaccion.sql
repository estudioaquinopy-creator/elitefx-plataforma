-- Regla de interacciones: ahora rige solo entre las 3 primeras personas (antes 5, y antes 10).
-- Idempotente: reemplaza solo ranking_mes_calc.

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
    ) y where y.pts > 0 order by y.pts desc, y.nom limit 3
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
