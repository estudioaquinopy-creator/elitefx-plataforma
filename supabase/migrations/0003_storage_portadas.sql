-- ELITE FX · Etapa 2b: almacenamiento de imágenes de portada.
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

insert into storage.buckets (id, name, public)
values ('portadas', 'portadas', true)
on conflict (id) do nothing;

-- Cualquiera puede ver las portadas (el bucket es público); solo el administrador sube, cambia o borra.
create policy "admin sube portadas" on storage.objects for insert to authenticated
  with check (bucket_id = 'portadas' and public.es_admin());
create policy "admin cambia portadas" on storage.objects for update to authenticated
  using (bucket_id = 'portadas' and public.es_admin());
create policy "admin borra portadas" on storage.objects for delete to authenticated
  using (bucket_id = 'portadas' and public.es_admin());
