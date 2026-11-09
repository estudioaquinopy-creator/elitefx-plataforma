-- 0054 · Métricas de referidos para el dueño (Marcos Aquino). Idempotente. Correr después de 0053.
-- Solo lo puede consultar un administrador cuyo correo sea el del dueño. Devuelve una fila por referente (VIP o admin con código) con sus conteos.
-- "Pasó a VIP" = el referido tiene vip_desde (alguna vez fue VIP real) o hoy no es gratuito. "Activo" = completó al menos una lección.
create or replace function public.referidos_metricas()
returns table(referente_id uuid, nombre text, codigo text, total int, activos int, vip int, ultimos30 int, ultimo timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'estudioaquinopy@gmail.com' then
    raise exception 'no autorizado';
  end if;
  return query
  select r.id, coalesce(nullif(btrim(r.nombre), ''), split_part(r.email, '@', 1)), r.codigo_ref,
         count(p.id)::int,
         count(*) filter (where exists (select 1 from public.progreso g where g.user_id = p.id))::int,
         count(*) filter (where p.vip_desde is not null or p.plan <> 'gratis')::int,
         count(*) filter (where p.created_at >= now() - interval '30 days')::int,
         max(p.created_at)
  from public.perfiles p join public.perfiles r on r.id = p.referido_por
  group by r.id, r.nombre, r.email, r.codigo_ref
  order by count(p.id) desc, max(p.created_at) desc;
end $$;
grant execute on function public.referidos_metricas() to authenticated;
