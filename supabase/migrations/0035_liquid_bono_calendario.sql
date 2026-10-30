-- 0035 · Beneficio para miembros GRATUITOS con cuenta de Liquid (sin pasar por el ranking). Idempotente. Correr después de 0034.
--   · cuenta de trading confirmada → 7 días de calendario VIP
--   · cuenta que opera en real (reward > 0 en el CSV) → 7 días más
-- Cada beneficio se da una sola vez por persona. Es solo CALENDARIO: el plan sigue siendo gratuito (no entra al ranking ni a Comunidad, Journal o Noticias).

alter table public.perfiles add column if not exists calendario_bono_hasta date;
alter table public.perfiles add column if not exists bono_cuenta_at timestamptz;
alter table public.perfiles add column if not exists bono_real_at timestamptz;

-- El calendario también se abre mientras dure el bono.
create or replace function public.puede_calendario() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.plan <> 'gratis'
               and p.vence is not null and p.vence >= (now() at time zone 'America/Asuncion')::date)
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.plan = 'gratis'
               and p.calendario_bono_hasta is not null and p.calendario_bono_hasta >= (now() at time zone 'America/Asuncion')::date)
    or exists (select 1 from public.accesos a where a.user_id = auth.uid() and a.seccion = 'calendario' and a.concedido);
$$;

create or replace function public.liquid_bono_calendario(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  hoy date := (now() at time zone 'America/Asuncion')::date;
  pl text; bc timestamptz; br timestamptz; hasta date; tiene_cuenta boolean; tiene_real boolean;
begin
  select p.plan::text, p.bono_cuenta_at, p.bono_real_at, p.calendario_bono_hasta into pl, bc, br, hasta from public.perfiles p where p.id = p_user;
  if not found or pl <> 'gratis' then return; end if;
  select coalesce(bool_or(c.estado = 'aprobado'), false), coalesce(bool_or(c.estado = 'aprobado' and c.reward_at is not null), false)
    into tiene_cuenta, tiene_real from public.liquid_cuentas c where c.user_id = p_user;
  if tiene_cuenta and bc is null then
    hasta := greatest(coalesce(hasta, hoy), hoy) + 7;
    update public.perfiles set bono_cuenta_at = now(), calendario_bono_hasta = hasta where id = p_user;
  end if;
  if tiene_real and br is null then
    hasta := greatest(coalesce(hasta, hoy), hoy) + 7;
    update public.perfiles set bono_real_at = now(), calendario_bono_hasta = hasta where id = p_user;
  end if;
end $$;
revoke all on function public.liquid_bono_calendario(uuid) from public, authenticated;

create or replace function public.liquid_bono_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.liquid_bono_calendario(new.user_id);
  return null;
end $$;
drop trigger if exists liquid_bono_auto on public.liquid_cuentas;
create trigger liquid_bono_auto after insert or update of estado, reward_at on public.liquid_cuentas
  for each row execute function public.liquid_bono_trigger();

-- Quienes ya tenían cuenta aprobada (y siguen siendo gratuitos) reciben su beneficio ahora.
select public.liquid_bono_calendario(x.user_id) from (select distinct user_id from public.liquid_cuentas where estado = 'aprobado') x;
