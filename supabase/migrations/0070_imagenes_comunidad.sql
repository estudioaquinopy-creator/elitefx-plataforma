-- ELITE FX · Comunidad: hasta 3 imágenes por publicación y respuestas con imagen. (Se puede correr varias veces sin error.)
-- Pégalo completo en Supabase > SQL Editor > New query > Run.
-- La primera imagen sigue en `imagen_url` (así el ranking no cambia); la 2.ª y la 3.ª van en `imagenes_extra`.

alter table public.publicaciones add column if not exists imagenes_extra text[] not null default '{}';
alter table public.comentarios add column if not exists imagen_url text;
alter table public.comentarios add column if not exists imagenes_extra text[] not null default '{}';

-- Las imágenes de una publicación no se pueden cambiar al editarla (reemplaza la función de la migración 0050 conservando todas sus reglas).
create or replace function public.publicaciones_editar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := old.user_id;
  new.autor := old.autor;
  new.canal := old.canal;
  new.imagen_url := old.imagen_url;
  new.imagenes_extra := old.imagenes_extra;
  new.created_at := old.created_at;
  if new.titulo is distinct from old.titulo or new.cuerpo is distinct from old.cuerpo then
    new.editado_at := now();
  else
    new.editado_at := old.editado_at;
  end if;
  if not public.es_admin() then
    new.fijada_at := old.fijada_at;
  elsif new.fijada_at is not null and old.fijada_at is null
        and (select count(*) from public.publicaciones where fijada_at is not null) >= 3 then
    raise exception 'Solo se pueden fijar 3 publicaciones. Quita una antes.';
  end if;
  return new;
end $$;
