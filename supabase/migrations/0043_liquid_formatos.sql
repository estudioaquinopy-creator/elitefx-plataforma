-- 0043 · Liquid: reconocer más formatos de número de cuenta al comparar con el CSV. Idempotente. Correr después de 0042.
-- Antes solo coincidían: el texto idéntico, o un número de 6+ cifras escrito solo. Ahora también:
--  · "ECN-MT5107193", "MT5 107193", "mt5-107193" → 107193 (se ignora el prefijo MT4/MT5 y se usa el número).
--  · guion y guion bajo se tratan igual (ECN-2617822-1 = ECN_2617822_1).
-- Las cuentas con forma PREFIJO_NÚMERO_SUFIJO (p. ej. ECN_2617822_1) siguen exigiendo coincidencia exacta, para no confundir _1 con _2.

create or replace function public.liquid_numero(t text) returns text
language sql immutable as $$
  select substring(regexp_replace(lower(coalesce(t, '')), 'mt[45]', '', 'g') from '[0-9]{6,}');
$$;

create or replace function public.liquid_aplicar_interno(p_id uuid) returns table(aprobadas int, reales int)
language plpgsql security definer set search_path = public as $$
declare a int := 0; r int := 0;
begin
  with m as (
    select c.id, max(k.reward) as rw, bool_or(c.estado = 'pendiente') as era_pendiente, bool_or(c.reward_at is null) as sin_real
    from public.liquid_cuentas c
    join public.liquid_csv k on replace(k.cuenta, '-', '_') = replace(lower(regexp_replace(c.cuenta, '\s', '', 'g')), '-', '_')
                             or (c.cuenta !~* '^[a-z]+[_-][0-9]+[_-][0-9]+$' and k.numero is not null and k.numero = public.liquid_numero(c.cuenta))
    where c.estado in ('pendiente', 'aprobado') and (p_id is null or c.id = p_id)
    group by c.id
  ), up as (
    update public.liquid_cuentas c set
      estado = 'aprobado',
      revisado_at = case when c.estado = 'pendiente' then now() else c.revisado_at end,
      nota = case when c.estado = 'pendiente' then 'Aprobada automáticamente con el CSV' else c.nota end,
      reward = greatest(c.reward, m.rw),
      reward_at = case when c.reward_at is null and m.rw > 0 then now() else c.reward_at end
    from m
    where c.id = m.id
      and (c.estado = 'pendiente' or greatest(c.reward, m.rw) is distinct from c.reward or (m.rw > 0 and c.reward_at is null))
    returning m.era_pendiente as es_aprob, (m.rw > 0 and m.sin_real) as es_real
  )
  select count(*) filter (where es_aprob), count(*) filter (where es_real) into a, r from up;
  return query select a, r;
end $$;
revoke all on function public.liquid_aplicar_interno(uuid) from public, authenticated;

-- Aplica ya mismo a todas las cuentas pendientes con los CSV que están guardados.
select public.liquid_aplicar_interno(null);
