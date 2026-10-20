-- ELITE FX · Comunidad completa: imágenes, likes y respuestas. (Se puede correr varias veces sin error.)
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

alter table public.publicaciones add column if not exists imagen_url text;
alter table public.publicaciones alter column titulo set default '';

insert into storage.buckets (id, name, public) values ('comunidad', 'comunidad', true)
on conflict (id) do nothing;
drop policy if exists "miembros suben imagenes comunidad" on storage.objects;
create policy "miembros suben imagenes comunidad" on storage.objects for insert to authenticated
  with check (bucket_id = 'comunidad' and public.tiene_acceso('comunidad'));

create table if not exists public.likes (
  post_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.likes enable row level security;
drop policy if exists "ver likes" on public.likes;
create policy "ver likes" on public.likes for select to authenticated using (true);
drop policy if exists "dar like" on public.likes;
create policy "dar like" on public.likes for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_acceso('comunidad'));
drop policy if exists "quitar mi like" on public.likes;
create policy "quitar mi like" on public.likes for delete to authenticated using (user_id = auth.uid());

create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  autor text not null default '',
  cuerpo text not null,
  created_at timestamptz not null default now()
);
create index if not exists comentarios_post_idx on public.comentarios (post_id, created_at);
alter table public.comentarios enable row level security;
drop policy if exists "ver comentarios" on public.comentarios;
create policy "ver comentarios" on public.comentarios for select to authenticated using (true);
drop policy if exists "comentar" on public.comentarios;
create policy "comentar" on public.comentarios for insert to authenticated
  with check (user_id = auth.uid() and public.tiene_acceso('comunidad'));
drop policy if exists "borrar comentario propio o admin" on public.comentarios;
create policy "borrar comentario propio o admin" on public.comentarios for delete to authenticated
  using (user_id = auth.uid() or public.es_admin());
