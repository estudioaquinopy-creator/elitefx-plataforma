-- 0059 · Journal con varias cuentas (cada persona crea las suyas: FTMO, capital propio, demo…). Idempotente. Correr después de 0058.
-- Cada cuenta tiene su nombre, su capital inicial y sus propias operaciones; al eliminar una cuenta se borran sus operaciones.

create table if not exists public.journal_cuentas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 40),
  capital_inicial numeric not null default 0 check (capital_inicial >= 0),
  created_at timestamptz not null default now()
);
create index if not exists journal_cuentas_user on public.journal_cuentas (user_id, created_at);
alter table public.journal_cuentas enable row level security;
drop policy if exists "journal cuentas propias" on public.journal_cuentas;
create policy "journal cuentas propias" on public.journal_cuentas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "journal cuentas ver admin" on public.journal_cuentas;
create policy "journal cuentas ver admin" on public.journal_cuentas for select to authenticated using (public.es_admin());

alter table public.operaciones add column if not exists cuenta_id uuid references public.journal_cuentas(id) on delete cascade;
create index if not exists operaciones_cuenta on public.operaciones (cuenta_id, fecha desc);

-- Lo que ya tenía cada persona pasa a una cuenta "Principal" (con su capital inicial actual).
insert into public.journal_cuentas (user_id, nombre, capital_inicial)
select u.user_id, 'Principal', coalesce(c.capital_inicial, 0)
from (select distinct user_id from public.operaciones union select user_id from public.journal_config) u
left join public.journal_config c on c.user_id = u.user_id
where not exists (select 1 from public.journal_cuentas x where x.user_id = u.user_id);
update public.operaciones o
set cuenta_id = (select x.id from public.journal_cuentas x where x.user_id = o.user_id order by x.created_at limit 1)
where o.cuenta_id is null;

-- El ticket ahora es único por cuenta (dos cuentas pueden repetir el mismo número de operación).
drop index if exists public.operaciones_user_ticket;
create unique index if not exists operaciones_cuenta_ticket on public.operaciones (cuenta_id, ticket);

-- Una operación solo puede ir a una cuenta de la misma persona.
create or replace function public.operaciones_cuenta_ok() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cuenta_id is not null and not exists (select 1 from public.journal_cuentas c where c.id = new.cuenta_id and c.user_id = new.user_id) then
    raise exception 'La cuenta del journal no es válida.';
  end if;
  return new;
end $$;
drop trigger if exists operaciones_cuenta_tr on public.operaciones;
create trigger operaciones_cuenta_tr before insert or update of cuenta_id on public.operaciones for each row execute function public.operaciones_cuenta_ok();

notify pgrst, 'reload schema';
