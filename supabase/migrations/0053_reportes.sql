-- Reportar publicaciones o respuestas de la comunidad. Los administradores las revisan en /comunidad/reportes. Idempotente.
create table if not exists public.reportes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('publicacion','comentario')),
  post_id uuid not null,
  comentario_id uuid,
  reportado_por uuid not null references auth.users(id) on delete cascade,
  motivo text not null,
  detalle text,
  estado text not null default 'pendiente' check (estado in ('pendiente','revisado')),
  revisado_por uuid,
  revisado_at timestamptz,
  created_at timestamptz not null default now()
);
-- Una persona no puede reportar dos veces lo mismo.
create unique index if not exists reportes_unico on public.reportes (reportado_por, tipo, (coalesce(comentario_id, post_id)));
create index if not exists reportes_estado on public.reportes (estado, created_at desc);
alter table public.reportes enable row level security;

drop policy if exists "reportar contenido" on public.reportes;
create policy "reportar contenido" on public.reportes for insert to authenticated
  with check (reportado_por = auth.uid() and public.tiene_acceso('comunidad'));
drop policy if exists "ver reportes" on public.reportes;
create policy "ver reportes" on public.reportes for select to authenticated
  using (public.es_admin() or reportado_por = auth.uid());
drop policy if exists "revisar reportes" on public.reportes;
create policy "revisar reportes" on public.reportes for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
drop policy if exists "borrar reportes" on public.reportes;
create policy "borrar reportes" on public.reportes for delete to authenticated using (public.es_admin());

-- Anti-abuso: máximo 20 reportes por persona al día (los administradores no tienen límite).
create or replace function public.reportes_limite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.es_admin() and (select count(*) from public.reportes where reportado_por = new.reportado_por and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Llegaste al máximo de reportes por hoy.';
  end if;
  new.motivo := left(trim(new.motivo), 60);
  new.detalle := left(trim(coalesce(new.detalle, '')), 500);
  return new;
end $$;
drop trigger if exists reportes_limite on public.reportes;
create trigger reportes_limite before insert on public.reportes for each row execute function public.reportes_limite();
