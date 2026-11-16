-- 0067 · Ranking: penalización del Top 3 del mes anterior + ranking anual y sorteo. Idempotente. Correr después de 0066.
-- Ajustes nuevos (tabla ajustes, editables desde la página del ranking): ranking_penal_top3 (% de puntos que se descuenta, por defecto 20; 0 = sin penalización),
-- sorteo_pts_boleto (puntos del año por cada boleto, por defecto 50), sorteo_min_meses (meses mínimos con puntos para participar, por defecto 6), sorteo_premio (texto).

-- 1) La función original de cálculo pasa a llamarse ranking_mes_base (se hace una sola vez);
--    ranking_mes_calc ahora es un envoltorio que aplica la penalización. Si en el futuro cambian las reglas de puntos, se edita ranking_mes_base.
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'ranking_mes_base') then
    alter function public.ranking_mes_calc(text) rename to ranking_mes_base;
  end if;
end $$;
revoke all on function public.ranking_mes_base(text) from public, authenticated;

-- Quienes terminaron en el Top 3 del mes anterior (solo desde diciembre de 2026, con el ranking de noviembre).
create or replace function public.ranking_penalizados(p_mes text) returns table(user_id uuid)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare prev text;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' or p_mes < '2026-12' then return; end if;
  if public.ajuste_num('ranking_penal_top3', 20) <= 0 then return; end if;
  prev := to_char((p_mes || '-01')::date - interval '1 month', 'YYYY-MM');
  return query
  select x.user_id from (
    select r.user_id, row_number() over (order by r.puntos desc, r.nombre) as rn from public.ranking_mes(prev) r
  ) x where x.rn <= 3;
end $$;
grant execute on function public.ranking_penalizados(text) to authenticated;

create or replace function public.ranking_mes_calc(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int, referidos int)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare pct int := least(100, greatest(0, public.ajuste_num('ranking_penal_top3', 20)));
begin
  return query
  with pen as (select z.user_id as uid from public.ranking_penalizados(p_mes) z),
  b as (
    select x.user_id as uid, x.nombre as nom,
           (case when exists (select 1 from pen where pen.uid = x.user_id) then (x.puntos * (100 - pct)) / 100 else x.puntos end)::int as pts,
           x.resultados as r, x.preguntas as q, x.respuestas as a, x.utiles as u, x.likes as l, x.certificados as c, x.referidos as rf
    from public.ranking_mes_base(p_mes) x
  )
  select b.uid, b.nom, b.pts, b.r, b.q, b.a, b.u, b.l, b.c, b.rf from b where b.pts > 0 order by 3 desc, 2;
end $$;
revoke all on function public.ranking_mes_calc(text) from public, authenticated;

-- 2) Ranking anual: suma de los puntos de los meses del año (con la penalización ya aplicada).
create or replace function public.ranking_anual(p_anio int)
returns table(user_id uuid, nombre text, puntos int, meses int, boletos int, elegible boolean)
language plpgsql volatile security definer set search_path = public as $$
#variable_conflict use_column
declare
  pb int := greatest(1, public.ajuste_num('sorteo_pts_boleto', 50));
  mm int := greatest(1, public.ajuste_num('sorteo_min_meses', 6));
  hoy date := (now() at time zone 'America/Asuncion')::date;
begin
  if p_anio < 2026 or p_anio > 2100 then raise exception 'Año no válido.'; end if;
  return query
  with m as (
    select to_char(make_date(p_anio, g.n, 1), 'YYYY-MM') as mes from generate_series(1, 12) g(n)
    where make_date(p_anio, g.n, 1) <= hoy + 31
  ),
  r as (select m.mes, x.user_id as uid, x.nombre as nom, x.puntos as pts from m, public.ranking_mes(m.mes) x)
  select r.uid, max(r.nom), sum(r.pts)::int, (count(*) filter (where r.pts > 0))::int,
         (sum(r.pts) / pb)::int, (count(*) filter (where r.pts > 0)) >= mm
  from r group by r.uid order by 3 desc, 2;
end $$;
grant execute on function public.ranking_anual(int) to authenticated;

-- 3) Sorteo anual (un solo sorteo por año; solo lo realiza un administrador). Cada boleto = sorteo_pts_boleto puntos del año.
create table if not exists public.sorteos (
  id uuid primary key default gen_random_uuid(),
  anio int not null unique,
  premio text not null,
  user_id uuid references public.perfiles(id) on delete set null,
  nombre text not null,
  puntos int not null,
  boletos int not null,
  total_boletos int not null,
  participantes int not null,
  realizado_at timestamptz not null default now(),
  admin_id uuid
);
alter table public.sorteos enable row level security;
drop policy if exists "sorteos visibles" on public.sorteos;
create policy "sorteos visibles" on public.sorteos for select to authenticated using (true);

create or replace function public.sorteo_realizar(p_anio int, p_premio text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare tot int; n int; pick int; acum int := 0; g record; res jsonb;
begin
  if not public.es_admin() then raise exception 'no autorizado'; end if;
  perform pg_advisory_xact_lock(hashtext('sorteo' || p_anio::text));
  if exists (select 1 from public.sorteos where anio = p_anio) then raise exception 'Ya se realizó el sorteo de %.', p_anio; end if;
  select coalesce(sum(a.boletos), 0), count(*) into tot, n from public.ranking_anual(p_anio) a where a.elegible and a.boletos > 0;
  if tot = 0 then raise exception 'No hay participantes con boletos todavía.'; end if;
  pick := 1 + floor(random() * tot)::int;
  for g in select a.user_id, a.nombre, a.puntos, a.boletos from public.ranking_anual(p_anio) a where a.elegible and a.boletos > 0 order by a.user_id loop
    acum := acum + g.boletos;
    if acum >= pick then
      insert into public.sorteos (anio, premio, user_id, nombre, puntos, boletos, total_boletos, participantes, admin_id)
      values (p_anio, left(coalesce(nullif(btrim(p_premio), ''), 'Notebook para trading'), 120), g.user_id, g.nombre, g.puntos, g.boletos, tot, n, auth.uid());
      res := jsonb_build_object('user_id', g.user_id, 'nombre', g.nombre, 'boletos', g.boletos, 'total', tot, 'participantes', n);
      exit;
    end if;
  end loop;
  return res;
end $$;
grant execute on function public.sorteo_realizar(int, text) to authenticated;

notify pgrst, 'reload schema';
