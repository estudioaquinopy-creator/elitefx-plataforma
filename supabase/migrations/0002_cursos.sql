-- ELITE FX · Etapa 2: cursos, lecciones y progreso.
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text not null default '',
  grupo text not null default 'ruta' check (grupo in ('ruta', 'extra')),
  orden int not null default 0,
  gratis boolean not null default false,      -- visible para el plan gratuito
  portada_url text,
  created_at timestamptz not null default now()
);

create table public.lecciones (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos(id) on delete cascade,
  orden int not null default 0,
  titulo text not null,
  descripcion text not null default '',
  youtube_url text not null default '',
  materiales jsonb not null default '[]'::jsonb,  -- [{"tipo":"pdf"|"link","titulo":"...","url":"..."}]
  created_at timestamptz not null default now()
);
create index on public.lecciones (curso_id, orden);

create table public.progreso (
  user_id uuid not null references public.perfiles(id) on delete cascade,
  leccion_id uuid not null references public.lecciones(id) on delete cascade,
  completada_at timestamptz not null default now(),
  primary key (user_id, leccion_id)
);

-- ¿Puede el usuario actual ver el contenido de este curso?
-- Administrador: todo. Curso gratuito: todos. Miembros (Live Trading / Scanner): todo.
-- Plan gratuito con acceso puntual concedido en "accesos" (sección 'cursos'): todo.
create or replace function public.puede_ver_curso(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.es_admin()
    or exists (select 1 from public.cursos c where c.id = p_curso and c.gratis)
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.plan <> 'gratis')
    or exists (select 1 from public.accesos a where a.user_id = auth.uid() and a.seccion = 'cursos' and a.concedido);
$$;

alter table public.cursos enable row level security;
alter table public.lecciones enable row level security;
alter table public.progreso enable row level security;

-- Todos los usuarios con sesión ven la lista de cursos (los bloqueados se muestran con candado).
create policy "ver cursos" on public.cursos for select to authenticated using (true);
create policy "admin gestiona cursos" on public.cursos for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Las lecciones solo las ve quien tiene acceso al curso.
create policy "ver lecciones con acceso" on public.lecciones for select to authenticated
  using (public.puede_ver_curso(curso_id));
create policy "admin gestiona lecciones" on public.lecciones for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy "ver progreso propio o admin" on public.progreso for select to authenticated
  using (user_id = auth.uid() or public.es_admin());
create policy "marcar progreso propio" on public.progreso for insert to authenticated
  with check (user_id = auth.uid());
create policy "desmarcar progreso propio" on public.progreso for delete to authenticated
  using (user_id = auth.uid());

-- Cursos iniciales (sin lecciones: las cargas desde el panel de administrador).
insert into public.cursos (nombre, descripcion, grupo, orden, gratis) values
  ('Primeros pasos', 'Todo lo que necesitas para empezar con ELITE FX.', 'ruta', 1, true),
  ('Curso básico', 'Las bases del trading, paso a paso.', 'ruta', 2, true),
  ('Curso intermedio', 'Profundiza tu operativa.', 'ruta', 3, false),
  ('Curso avanzado', 'Estrategias y gestión avanzada.', 'ruta', 4, false),
  ('Scanner Elite', 'Aprende a usar el Scanner Elite.', 'extra', 5, false),
  ('Tutoriales', 'Guías prácticas de las herramientas.', 'extra', 6, false),
  ('Data de nivel 2', 'Contenido de datos de nivel 2.', 'extra', 7, false);
