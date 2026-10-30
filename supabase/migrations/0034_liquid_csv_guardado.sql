-- 0034 · Los datos de cada CSV de Liquid se GUARDAN (cuenta + mayor reward visto) para comparar también con cuentas registradas antes o después. Idempotente. Correr después de 0033.
-- · Cada CSV que subes suma cuentas a la base guardada (no la reemplaza); el reward guardado es el mayor visto: si alguna vez fue mayor a 0, la cuenta ya operó en real.
-- · Al subir un CSV se comparan TODAS las cuentas pendientes y aprobadas contra la base guardada.
-- · Cuando una persona registra su cuenta, si ya está en la base guardada se confirma al instante (sin esperar el siguiente CSV).

create table if not exists public.liquid_csv (
  cuenta text primary key,                 -- en minúsculas y sin espacios
  original text not null,
  numero text,                             -- primer número de 6 o más cifras (p. ej. 2617822 en ECN_2617822_1)
  reward numeric not null default 0,       -- mayor reward visto en cualquier CSV
  primera_vez timestamptz not null default now(),
  visto_at timestamptz not null default now()
);
create index if not exists liquid_csv_numero_ix on public.liquid_csv (numero) where numero is not null;
alter table public.liquid_csv enable row level security;
drop policy if exists "liquid csv admin" on public.liquid_csv;
create policy "liquid csv admin" on public.liquid_csv for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Compara las cuentas de liquid_cuentas (pendientes y aprobadas) con la base guardada: aprueba las pendientes que están y marca las que operan en real.
create or replace function public.liquid_aplicar_interno(p_id uuid) returns table(aprobadas int, reales int)
language plpgsql security definer set search_path = public as $$
declare a int := 0; r int := 0;
begin
  with m as (
    select c.id, max(k.reward) as rw, bool_or(c.estado = 'pendiente') as era_pendiente, bool_or(c.reward_at is null) as sin_real
    from public.liquid_cuentas c
    join public.liquid_csv k on k.cuenta = lower(regexp_replace(c.cuenta, '\s', '', 'g'))
                             or (c.cuenta ~ '^[0-9]{6,}$' and k.numero = c.cuenta)
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

-- El administrador carga un CSV: p_datos = [{"c": "ECN_2617822_1", "r": 12.5}, ...]
create or replace function public.liquid_cargar_csv(p_datos jsonb) returns table(aprobadas int, reales int, total int)
language plpgsql security definer set search_path = public as $$
declare a int; r int; t int;
begin
  if not public.es_admin() then raise exception 'Solo el administrador puede hacer esto.'; end if;
  insert into public.liquid_csv (cuenta, original, numero, reward)
  select s.cuenta, s.original, substring(s.cuenta from '[0-9]{6,}'), s.reward
  from (
    select lower(regexp_replace(e->>'c', '\s', '', 'g')) as cuenta, max(btrim(e->>'c')) as original,
           max(coalesce(nullif(e->>'r', '')::numeric, 0)) as reward
    from jsonb_array_elements(p_datos) e
    group by 1
  ) s
  where s.cuenta <> '' and length(s.cuenta) <= 60
  on conflict (cuenta) do update set reward = greatest(public.liquid_csv.reward, excluded.reward), original = excluded.original, visto_at = now();
  select * into a, r from public.liquid_aplicar_interno(null);
  select count(*) into t from public.liquid_csv;
  return query select a, r, t;
end $$;
grant execute on function public.liquid_cargar_csv(jsonb) to authenticated;

-- Al registrar (o corregir) una cuenta, se compara al instante con la base guardada.
create or replace function public.liquid_al_enviar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.liquid_aplicar_interno(new.id);
  return null;
end $$;
drop trigger if exists liquid_enviar_auto on public.liquid_cuentas;
create trigger liquid_enviar_auto after insert or update of cuenta on public.liquid_cuentas
  for each row execute function public.liquid_al_enviar();
