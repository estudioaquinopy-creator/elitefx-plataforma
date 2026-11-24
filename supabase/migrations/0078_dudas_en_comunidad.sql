-- 0078 · Dudas de las lecciones en la Comunidad (parte segura: NO borra nada). Idempotente. Correr después de 0077, ya.
-- Una publicación puede estar "sobre una lección" (etiqueta que enlaza a la lección). Si se borra la lección, la publicación sigue.
-- El cambio visible (quitar las preguntas debajo de las lecciones y mostrar "Preguntar en la comunidad") ocurre solo el 25/11/2026 (lib/dudasLeccion.ts).
-- El borrado de las preguntas antiguas está en la 0079, que se corre DESPUÉS del 25/11/2026.

alter table public.publicaciones add column if not exists leccion_id uuid references public.lecciones(id) on delete set null;
create index if not exists publicaciones_leccion_idx on public.publicaciones (leccion_id) where leccion_id is not null;

notify pgrst, 'reload schema';
