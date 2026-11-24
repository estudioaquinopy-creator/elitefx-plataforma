-- 0078 · Las dudas de las lecciones pasan a la Comunidad. Idempotente. Correr después de 0077.
-- 1) Una publicación puede estar "sobre una lección" (etiqueta que enlaza a la lección). Si se borra la lección, la publicación sigue.
-- 2) BORRA TODAS las preguntas y respuestas que se hicieron debajo de las lecciones (tabla lecciones_comentarios) y los avisos que generaron
--    ("Respondieron tu pregunta", menciones dentro de una lección). ESTO NO SE PUEDE DESHACER.
--    La tabla se conserva (vacía) para que no falle ninguna función que la nombre; nadie puede escribir en ella desde la plataforma.

alter table public.publicaciones add column if not exists leccion_id uuid references public.lecciones(id) on delete set null;
create index if not exists publicaciones_leccion_idx on public.publicaciones (leccion_id) where leccion_id is not null;

do $$ begin
  if to_regclass('public.lecciones_comentarios') is not null then
    delete from public.lecciones_comentarios;
  end if;
  if to_regclass('public.notificaciones') is not null then
    delete from public.notificaciones where enlace ~ '#(dudas|d-)';
  end if;
end $$;

notify pgrst, 'reload schema';
