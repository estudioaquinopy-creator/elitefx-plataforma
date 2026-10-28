-- 0021 · Seguridad: registro de acciones del administrador y examen más difícil de "adivinar". Idempotente.

-- 1) Registro de auditoría (solo los administradores lo ven y lo escriben).
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid references public.perfiles(id) on delete set null,
  admin_email text,
  accion text not null,
  objetivo text,
  detalle text not null default ''
);
create index if not exists auditoria_fecha on public.auditoria (created_at desc);
alter table public.auditoria enable row level security;
drop policy if exists "admin ve auditoria" on public.auditoria;
create policy "admin ve auditoria" on public.auditoria for select to authenticated using (public.es_admin());
drop policy if exists "admin registra auditoria" on public.auditoria;
create policy "admin registra auditoria" on public.auditoria for insert to authenticated with check (public.es_admin() and admin_id = auth.uid());

-- 2) Examen: exige acceso al curso y 10 minutos de espera entre intentos (los administradores no tienen espera).
create or replace function public.calificar_examen(p_curso uuid, p_resp jsonb)
returns table(aciertos int, total int, minimo int, aprobado boolean)
language plpgsql security definer set search_path = public as $$
declare cfg record; pool int; tot int; ok int; nk int; ultimo timestamptz;
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
  insert into public.examen_intentos (user_id, curso_id, aciertos, total, aprobado)
    values (auth.uid(), p_curso, ok, tot, ok >= cfg.minimo);
  return query select ok, tot, cfg.minimo, (ok >= cfg.minimo);
end $$;
grant execute on function public.calificar_examen(uuid, jsonb) to authenticated;
