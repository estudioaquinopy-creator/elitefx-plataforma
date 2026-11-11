-- 0064 · Examen: después de rendirlo, la persona ve en qué se equivocó (su respuesta y la correcta). Idempotente. Correr después de 0063.
-- Se guarda en el intento (`revision`) solo lo de las preguntas que le tocaron en ese intento; el banco completo y sus respuestas siguen sin salir de la base.

alter table public.examen_intentos add column if not exists revision jsonb;

create or replace function public.calificar_examen(p_curso uuid, p_resp jsonb)
returns table(aciertos int, total int, minimo int, aprobado boolean)
language plpgsql security definer set search_path = public as $$
declare cfg record; pool int; tot int; ok int; nk int; ultimo timestamptz; rev jsonb;
begin
  if not public.puede_ver_curso(p_curso) then raise exception 'No tienes acceso a este curso.'; end if;
  select * into cfg from public.examen_config c where c.curso_id = p_curso and c.activo;
  if not found then raise exception 'Este curso no tiene examen.'; end if;
  if not public.es_admin() then
    select max(i.created_at) into ultimo from public.examen_intentos i where i.user_id = auth.uid() and i.curso_id = p_curso and not i.aprobado;
    if ultimo is not null and ultimo > now() - interval '10 minutes' then
      raise exception 'Espera unos minutos antes de volver a intentar el examen y repasa el curso.';
    end if;
  end if;
  select count(*) into pool from public.examen_banco b where b.curso_id = p_curso;
  tot := least(cfg.preguntas, pool);
  select count(*) into nk from jsonb_object_keys(p_resp);
  if nk > tot then raise exception 'Respuestas no válidas.'; end if;
  select count(*) into ok from public.examen_banco b
    where b.curso_id = p_curso and (p_resp ->> b.id::text) is not null and (p_resp ->> b.id::text)::int = b.correcta;
  -- Revisión: solo las preguntas de este intento (e = lo que marcó, -1 si la dejó sin responder; c = la correcta).
  select jsonb_agg(jsonb_build_object('t', b.texto, 'o', b.opciones, 'e', (p_resp ->> b.id::text)::int, 'c', b.correcta) order by b.created_at)
    into rev from public.examen_banco b where b.curso_id = p_curso and (p_resp ->> b.id::text) is not null;
  insert into public.examen_intentos (user_id, curso_id, aciertos, total, aprobado, revision)
    values (auth.uid(), p_curso, ok, tot, ok >= cfg.minimo, rev);
  return query select ok, tot, cfg.minimo, (ok >= cfg.minimo);
end $$;
grant execute on function public.calificar_examen(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
