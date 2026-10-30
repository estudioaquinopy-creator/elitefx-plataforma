-- 0036 · Fotos de perfil visibles en la comunidad. Idempotente. Correr después de 0035.
-- Los alumnos no pueden leer los perfiles de otros (RLS), así que esta función entrega SOLO el enlace de la foto de las personas pedidas,
-- y únicamente a quien tiene acceso a la comunidad.
create or replace function public.avatares_comunidad(p_ids uuid[]) returns table(id uuid, avatar_url text)
language sql stable security definer set search_path = public as $$
  select p.id, p.avatar_url from public.perfiles p
  where p.id = any(p_ids) and p.avatar_url is not null and public.tiene_acceso('comunidad');
$$;
grant execute on function public.avatares_comunidad(uuid[]) to authenticated;
