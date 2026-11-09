-- 0055 · Detalle de los referidos de una persona (solo el dueño). Idempotente. Correr después de 0054.
create or replace function public.referidos_detalle(p_referente uuid)
returns table(id uuid, nombre text, email text, telefono text, registrado timestamptz, primera_leccion timestamptz, lecciones int, plan text, vence date, vip_desde timestamptz, es_alumno boolean, en_prueba boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_admin() or lower(coalesce(auth.jwt() ->> 'email', '')) <> 'estudioaquinopy@gmail.com' then
    raise exception 'no autorizado';
  end if;
  return query
  select p.id, coalesce(nullif(btrim(p.nombre), ''), split_part(p.email, '@', 1)), p.email, p.telefono, p.created_at,
         (select min(g.completada_at) from public.progreso g where g.user_id = p.id),
         (select count(*)::int from public.progreso g where g.user_id = p.id),
         p.plan, p.vence::date, p.vip_desde, p.es_alumno, (p.prueba_hasta is not null and p.prueba_hasta > now())
  from public.perfiles p
  where p.referido_por = p_referente
  order by p.created_at desc;
end $$;
grant execute on function public.referidos_detalle(uuid) to authenticated;
