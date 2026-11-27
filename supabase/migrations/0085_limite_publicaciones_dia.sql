-- Límite anti-spam: máximo 2 publicaciones por persona por día (día de Paraguay), sumando todas las etiquetas.
-- Responder y dar me gusta no tienen límite. Los administradores y las cargas con clave de servicio no se limitan.
-- La aplicación ya lo comprueba antes (lib/limitePublicaciones.ts); este disparador lo garantiza también en la base de datos.
-- Si cambias el 2, cámbialo también en MAX_PUBLICACIONES_DIA de lib/limitePublicaciones.ts.
create or replace function public.publicaciones_limite_dia() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null or public.es_admin() then
    return new;
  end if;
  select count(*) into n from public.publicaciones p
   where p.user_id = new.user_id
     and (p.created_at at time zone 'America/Asuncion')::date = (now() at time zone 'America/Asuncion')::date;
  if n >= 2 then
    raise exception 'Ya hiciste tus 2 publicaciones de hoy. Puedes seguir respondiendo y dando me gusta; mañana podrás publicar de nuevo.';
  end if;
  return new;
end $$;

drop trigger if exists publicaciones_limite_dia on public.publicaciones;
create trigger publicaciones_limite_dia before insert on public.publicaciones
  for each row execute function public.publicaciones_limite_dia();
