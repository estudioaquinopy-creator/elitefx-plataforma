-- Examen al terminar un curso: banco de preguntas, configuración e intentos.
-- Las respuestas correctas nunca llegan al navegador del alumno: se califica dentro de la base de datos.

create table if not exists public.examen_config (
  curso_id uuid primary key references public.cursos(id) on delete cascade,
  activo boolean not null default true,
  preguntas int not null default 10 check (preguntas between 1 and 100),
  minimo int not null default 7 check (minimo >= 1)
);

create table if not exists public.examen_banco (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  texto text not null,
  opciones jsonb not null,
  correcta int not null check (correcta >= 0),
  created_at timestamptz not null default now()
);
create index if not exists examen_banco_curso on public.examen_banco(curso_id);

create table if not exists public.examen_intentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  aciertos int not null,
  total int not null,
  aprobado boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists examen_intentos_user on public.examen_intentos(user_id, curso_id);

alter table public.examen_config enable row level security;
alter table public.examen_banco enable row level security;
alter table public.examen_intentos enable row level security;

drop policy if exists "ver config examen" on public.examen_config;
create policy "ver config examen" on public.examen_config for select to authenticated using (true);
drop policy if exists "admin config examen" on public.examen_config;
create policy "admin config examen" on public.examen_config for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "admin banco examen" on public.examen_banco;
create policy "admin banco examen" on public.examen_banco for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "ver mis intentos" on public.examen_intentos;
create policy "ver mis intentos" on public.examen_intentos for select to authenticated using (user_id = auth.uid() or public.es_admin());
drop policy if exists "admin borra intentos" on public.examen_intentos;
create policy "admin borra intentos" on public.examen_intentos for delete to authenticated using (public.es_admin());

-- Preguntas al azar para rendir el examen (sin la respuesta correcta).
create or replace function public.examen_preguntas(p_curso uuid)
returns table(id uuid, texto text, opciones jsonb)
language plpgsql security definer set search_path = public as $$
declare n int; faltan int;
begin
  select c.preguntas into n from public.examen_config c where c.curso_id = p_curso and c.activo;
  if n is null then raise exception 'Este curso no tiene examen.'; end if;
  if not public.es_admin() then
    select count(*) into faltan from public.lecciones l
      where l.curso_id = p_curso
        and not exists (select 1 from public.progreso pr where pr.leccion_id = l.id and pr.user_id = auth.uid());
    if faltan > 0 then raise exception 'Completa todas las lecciones primero.'; end if;
  end if;
  return query select q.id, q.texto, q.opciones from public.examen_banco q where q.curso_id = p_curso order by random() limit n;
end $$;

-- Califica en el servidor y guarda el intento.
create or replace function public.calificar_examen(p_curso uuid, p_resp jsonb)
returns table(aciertos int, total int, minimo int, aprobado boolean)
language plpgsql security definer set search_path = public as $$
declare cfg record; pool int; tot int; ok int; nk int;
begin
  select * into cfg from public.examen_config c where c.curso_id = p_curso and c.activo;
  if not found then raise exception 'Este curso no tiene examen.'; end if;
  select count(*) into pool from public.examen_banco b where b.curso_id = p_curso;
  tot := least(cfg.preguntas, pool);
  select count(*) into nk from jsonb_object_keys(p_resp);
  if nk > tot then raise exception 'Respuestas no válidas.'; end if;
  select count(*) into ok from public.examen_banco b
    where b.curso_id = p_curso and (p_resp ->> b.id::text) is not null and (p_resp ->> b.id::text)::int = b.correcta;
  insert into public.examen_intentos (user_id, curso_id, aciertos, total, aprobado)
    values (auth.uid(), p_curso, ok, tot, ok >= cfg.minimo);
  return query select ok, tot, cfg.minimo, (ok >= cfg.minimo);
end $$;

grant execute on function public.examen_preguntas(uuid) to authenticated;
grant execute on function public.calificar_examen(uuid, jsonb) to authenticated;
