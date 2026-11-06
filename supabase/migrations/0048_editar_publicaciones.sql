-- Las personas pueden editar el título y el texto de SUS publicaciones (queda la marca "editado").
alter table public.publicaciones add column if not exists editado_at timestamptz;

drop policy if exists "editar publicación propia" on public.publicaciones;
create policy "editar publicación propia" on public.publicaciones for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Solo se pueden cambiar título y texto: el canal, la imagen, el autor y la fecha (y con ello el ranking) no se tocan.
create or replace function public.publicaciones_editar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := old.user_id;
  new.autor := old.autor;
  new.canal := old.canal;
  new.imagen_url := old.imagen_url;
  new.created_at := old.created_at;
  if new.titulo is distinct from old.titulo or new.cuerpo is distinct from old.cuerpo then
    new.editado_at := now();
  else
    new.editado_at := old.editado_at;
  end if;
  return new;
end $$;

drop trigger if exists publicaciones_editar on public.publicaciones;
create trigger publicaciones_editar before update on public.publicaciones
  for each row execute function public.publicaciones_editar();
