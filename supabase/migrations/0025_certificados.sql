-- 0025 · Certificados por nivel (Curso básico, intermedio y avanzado). Idempotente.
-- Se emite al aprobar el examen del curso. Cada certificado tiene un código único que se puede verificar en /verificar.

create table if not exists public.certificados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  curso_id uuid not null references public.cursos(id) on delete cascade,
  codigo text not null unique,
  emitido_at timestamptz not null default now(),
  unique (user_id, curso_id)
);
alter table public.certificados enable row level security;
drop policy if exists "ver mis certificados" on public.certificados;
create policy "ver mis certificados" on public.certificados for select to authenticated using (user_id = auth.uid() or public.es_admin());
drop policy if exists "admin borra certificados" on public.certificados;
create policy "admin borra certificados" on public.certificados for delete to authenticated using (public.es_admin());
-- Nadie inserta directamente: solo la función emitir_certificado (que comprueba el examen aprobado).

-- Emite (o devuelve) el certificado de la persona para un curso. Solo si aprobó el examen de ese curso.
create or replace function public.emitir_certificado(p_curso uuid)
returns text language plpgsql security definer set search_path = public as $$
declare cod text; fecha timestamptz;
begin
  if auth.uid() is null then raise exception 'Sin sesión.'; end if;
  select c.codigo into cod from public.certificados c where c.user_id = auth.uid() and c.curso_id = p_curso;
  if cod is not null then return cod; end if;
  select min(i.created_at) into fecha from public.examen_intentos i where i.user_id = auth.uid() and i.curso_id = p_curso and i.aprobado;
  if fecha is null then raise exception 'Aún no aprobaste el examen de este curso.'; end if;
  loop
    cod := 'EFX-' || upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 8));
    begin
      insert into public.certificados (user_id, curso_id, codigo, emitido_at) values (auth.uid(), p_curso, cod, fecha);
      return cod;
    exception when unique_violation then
      select c.codigo into cod from public.certificados c where c.user_id = auth.uid() and c.curso_id = p_curso;
      if cod is not null then return cod; end if; -- ya existía para esa persona y curso
    end;
  end loop;
end $$;
grant execute on function public.emitir_certificado(uuid) to authenticated;

-- Verificación pública: dado un código devuelve a nombre de quién está, el curso y la fecha. No expone correo ni otros datos.
create or replace function public.verificar_certificado(p_codigo text)
returns table(nombre text, curso text, emitido date)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(btrim(p.nombre), ''), split_part(p.email, '@', 1)), cu.nombre, (c.emitido_at at time zone 'America/Asuncion')::date
  from public.certificados c
  join public.perfiles p on p.id = c.user_id
  join public.cursos cu on cu.id = c.curso_id
  where c.codigo = upper(btrim(p_codigo))
$$;
grant execute on function public.verificar_certificado(text) to anon, authenticated;
