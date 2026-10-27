-- 0018 · Journal: capital inicial de cada persona (base para calcular los porcentajes). Idempotente.
create table if not exists public.journal_config (
  user_id uuid primary key references public.perfiles(id) on delete cascade,
  capital_inicial numeric not null default 0 check (capital_inicial >= 0)
);
alter table public.journal_config enable row level security;
drop policy if exists "journal config propia" on public.journal_config;
create policy "journal config propia" on public.journal_config for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
