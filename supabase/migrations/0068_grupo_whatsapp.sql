-- Aviso con el grupo de WhatsApp "Ruta del Trader" para gratuitos nuevos: se guarda cuándo tocó "Unirme al grupo".
alter table public.perfiles add column if not exists grupo_wa_at timestamptz;

create or replace function public.grupo_wa_marcar() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update public.perfiles set grupo_wa_at = now() where id = auth.uid() and grupo_wa_at is null;
end $$;
revoke all on function public.grupo_wa_marcar() from public;
grant execute on function public.grupo_wa_marcar() to authenticated;
