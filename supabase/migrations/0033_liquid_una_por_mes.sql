-- 0033 · Cuenta de Liquid: solo se puede registrar UNA cuenta por mes (para que nadie cree cuentas de trading nuevas todo el tiempo y sume puntos). Idempotente. Correr después de 0032.
-- Antes había una sola fila por persona; ahora hay una por mes (mes = AAAA-MM, hora de Paraguay). Los puntos de cada cuenta se cuentan en su mes.

alter table public.liquid_cuentas add column if not exists id uuid not null default gen_random_uuid();
alter table public.liquid_cuentas add column if not exists mes text;
update public.liquid_cuentas set mes = to_char(enviado_at at time zone 'America/Asuncion', 'YYYY-MM') where mes is null;
alter table public.liquid_cuentas alter column mes set not null;
alter table public.liquid_cuentas alter column mes set default to_char(now() at time zone 'America/Asuncion', 'YYYY-MM');

do $$ begin
  if exists (select 1 from pg_constraint where conrelid = 'public.liquid_cuentas'::regclass and conname = 'liquid_cuentas_pkey' and pg_get_constraintdef(oid) like '%(user_id)%') then
    alter table public.liquid_cuentas drop constraint liquid_cuentas_pkey;
    alter table public.liquid_cuentas add primary key (id);
  end if;
end $$;
create unique index if not exists liquid_cuentas_user_mes_uq on public.liquid_cuentas (user_id, mes);

drop policy if exists "liquid enviar" on public.liquid_cuentas;
create policy "liquid enviar" on public.liquid_cuentas for insert to authenticated
  with check (user_id = auth.uid() and estado = 'pendiente' and revisado_at is null and reward = 0 and reward_at is null
              and mes = to_char(now() at time zone 'America/Asuncion', 'YYYY-MM'));
drop policy if exists "liquid corregir" on public.liquid_cuentas;
create policy "liquid corregir" on public.liquid_cuentas for update to authenticated
  using (user_id = auth.uid() and estado <> 'aprobado' and mes = to_char(now() at time zone 'America/Asuncion', 'YYYY-MM'))
  with check (user_id = auth.uid() and estado = 'pendiente' and revisado_at is null and reward = 0 and reward_at is null
              and mes = to_char(now() at time zone 'America/Asuncion', 'YYYY-MM'));
