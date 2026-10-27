-- 0012 · Exámenes solo entre cursos de la ruta y cursos libres para el plan gratuito.
-- Idempotente: se puede ejecutar más de una vez.

-- 1) Cursos visibles para el plan gratuito: Primeros pasos, Curso básico, Tutoriales y Scanner Elite.
update public.cursos set gratis = (
     nombre ilike 'primeros pasos%'
  or nombre ilike 'curso b%sico%'
  or nombre ilike 'tutoriales%'
  or nombre ilike '%scanner%'
);

-- 2) Primeros pasos no tiene examen.
insert into public.examen_config (curso_id, activo)
  select id, false from public.cursos where nombre ilike 'primeros pasos%'
  on conflict (curso_id) do update set activo = false;

-- 3) Examen activo en básico, intermedio y avanzado (solo si ya tienen preguntas cargadas en el banco).
insert into public.examen_config (curso_id, activo)
  select c.id, true from public.cursos c
  where (c.nombre ilike 'curso b%sico%' or c.nombre ilike 'curso intermedio%' or c.nombre ilike 'curso avanzado%')
    and exists (select 1 from public.examen_banco b where b.curso_id = c.id)
  on conflict (curso_id) do update set activo = true;
