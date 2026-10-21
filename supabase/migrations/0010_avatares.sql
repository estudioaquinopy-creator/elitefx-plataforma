-- Foto de perfil: columna, bucket público "avatares" y políticas (cada persona solo toca su carpeta).
alter table public.perfiles add column if not exists avatar_url text;
grant update (avatar_url) on public.perfiles to authenticated;

insert into storage.buckets (id, name, public) values ('avatares', 'avatares', true)
on conflict (id) do nothing;

drop policy if exists "ver avatares" on storage.objects;
create policy "ver avatares" on storage.objects for select using (bucket_id = 'avatares');
drop policy if exists "subir mi avatar" on storage.objects;
create policy "subir mi avatar" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "cambiar mi avatar" on storage.objects;
create policy "cambiar mi avatar" on storage.objects for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "borrar mi avatar" on storage.objects;
create policy "borrar mi avatar" on storage.objects for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- Al registrarse también se guarda el teléfono que escribió la persona.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, telefono)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'nombre', ''), nullif(new.raw_user_meta_data->>'telefono', ''));
  return new;
end $$;
