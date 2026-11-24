-- 0079 · BORRA todas las preguntas y respuestas que se hicieron debajo de las lecciones y los avisos que generaron. NO SE PUEDE DESHACER.
-- Correr SOLO desde el 25/11/2026 (cuando esa sección ya no se muestra; ver lib/dudasLeccion.ts). Antes de esa fecha se niega a ejecutarse.
-- La tabla lecciones_comentarios se conserva (vacía) para que no falle ninguna función que la nombre. Idempotente.
-- Incluye lo de la 0078 (columna publicaciones.leccion_id): si no corriste la 0078, correr SOLO esta basta.

alter table public.publicaciones add column if not exists leccion_id uuid references public.lecciones(id) on delete set null;
create index if not exists publicaciones_leccion_idx on public.publicaciones (leccion_id) where leccion_id is not null;

do $$ begin
  if now() < timestamptz '2026-11-25 00:00:00-03' then
    raise exception 'Todavía no: esta migración se corre desde el 25/11/2026, cuando las preguntas de las lecciones ya no se muestran.';
  end if;
  if to_regclass('public.lecciones_comentarios') is not null then
    delete from public.lecciones_comentarios;
  end if;
  if to_regclass('public.notificaciones') is not null then
    delete from public.notificaciones where enlace ~ '#(dudas|d-)';
  end if;
end $$;

notify pgrst, 'reload schema';
