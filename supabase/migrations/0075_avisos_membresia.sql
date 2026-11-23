-- 0075 · Registro de avisos por WhatsApp a quienes tienen la membresía vencida o por vencer. Idempotente. Correr después de 0074.
-- Cada vez que un administrador toca "Avisar por WhatsApp" se guarda quién avisó, a quién, cuándo y qué vencimiento tenía.
-- Si después la persona renueva (cambia su fecha de vencimiento), el aviso deja de contar y vuelve a aparecer como "sin avisar" la próxima vez que venza.

create table if not exists public.avisos_membresia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  admin_id uuid,
  admin_nombre text not null default '',
  estado text not null default '',
  vence date,
  created_at timestamptz not null default now()
);
create index if not exists avisos_membresia_user_idx on public.avisos_membresia (user_id, created_at desc);
alter table public.avisos_membresia enable row level security;

drop policy if exists "admins ven avisos de membresia" on public.avisos_membresia;
create policy "admins ven avisos de membresia" on public.avisos_membresia for select to authenticated using (public.es_admin());
drop policy if exists "admins registran avisos de membresia" on public.avisos_membresia;
create policy "admins registran avisos de membresia" on public.avisos_membresia for insert to authenticated with check (public.es_admin() and admin_id = auth.uid());

notify pgrst, 'reload schema';
