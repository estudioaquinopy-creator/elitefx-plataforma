-- 0030 · Journals anclados: cada administrador fija los journals de alumnos que sigue de cerca. Idempotente. Correr después de 0029.
create table if not exists public.journals_anclados (
  admin_id uuid not null references public.perfiles(id) on delete cascade,
  alumno_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (admin_id, alumno_id)
);
alter table public.journals_anclados enable row level security;
drop policy if exists "anclados propios del admin" on public.journals_anclados;
create policy "anclados propios del admin" on public.journals_anclados for all to authenticated
  using (admin_id = auth.uid() and public.es_admin())
  with check (admin_id = auth.uid() and public.es_admin());
