-- ELITE FX · Comunidad completa: imágenes, likes y respuestas.
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

alter table public.publicaciones add column if not exists imagen_url text;
alter table public.publicaciones alter column titulo set default '';

-- Imágenes de la comunidad (bucket público; suben quienes pueden participar).
insert into storage.buckets (id, name, public) values ('comunidad', 'comunidad', true)
on conflict (id) do nothing;
create policy "miembros suben imagenes comunidad" on storage.objects for insert to authenticated
  with check (bucket_id = 'comunidad' and public.tiene_acceso('comunidad'));

-- Me gusta
create table public.likes (
  post_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;
create policy "ver likes" on public.likes for select to authenticated using (true);
create policy "dar like" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_acceso('comunidad'));
create policy "quitar mi like" on public.likes for delete to authenticated using (user_id = auth.uid());

-- Respuestas
create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  autor text not null default '',
  cuerpo text not null,
  created_at timestamptz not null default now()
);
create index on public.comentarios (post_id, created_at);
alter table public.comentarios enable row level security;
create policy "ver comentarios" on public.comentarios for select to authenticated using (true);
create policy "comentar" on public.comentarios for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_acceso('comunidad'));
create policy "borrar comentario propio o admin" on public.comentarios for delete to authenticated
  using (user_id = auth.uid() or public.es_admin());
