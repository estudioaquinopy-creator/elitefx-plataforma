-- 0062 · Sala de trading: cada persona puede eliminar su mensaje durante el primer minuto y editarlo hasta 5 minutos después de enviarlo. Idempotente. Correr después de 0061.

alter table public.sala_mensajes add column if not exists editado_at timestamptz;

-- Borrar: el administrador siempre; cada persona solo lo suyo y dentro del primer minuto.
drop policy if exists "sala borrar" on public.sala_mensajes;
create policy "sala borrar" on public.sala_mensajes for delete to authenticated
  using (public.es_admin() or (user_id = auth.uid() and created_at > now() - interval '1 minute'));

-- Editar: solo lo propio y dentro de los 5 minutos (el trigger deja cambiar únicamente el texto).
drop policy if exists "sala editar" on public.sala_mensajes;
create policy "sala editar" on public.sala_mensajes for update to authenticated
  using (user_id = auth.uid() and created_at > now() - interval '5 minutes')
  with check (user_id = auth.uid());

create or replace function public.sala_editar() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Cuando se borra el mensaje al que otro respondía, la base solo vacía la referencia: se deja pasar.
  if new.responde_a is null and old.responde_a is not null and new.texto = old.texto then return new; end if;
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.autor_nombre is distinct from old.autor_nombre
     or new.autor_avatar is distinct from old.autor_avatar or new.autor_admin is distinct from old.autor_admin
     or new.imagen_url is distinct from old.imagen_url or new.imagen_path is distinct from old.imagen_path
     or new.created_at is distinct from old.created_at or new.responde_a is distinct from old.responde_a
     or new.resp_nombre is distinct from old.resp_nombre or new.resp_texto is distinct from old.resp_texto then
    raise exception 'Solo se puede editar el texto del mensaje.';
  end if;
  if now() - old.created_at > interval '5 minutes' then
    raise exception 'Ya pasaron más de 5 minutos: este mensaje ya no se puede editar.';
  end if;
  if exists (select 1 from public.sala_bloqueos b where b.user_id = old.user_id and (b.hasta is null or b.hasta > now())) then
    raise exception 'Un administrador te bloqueó en la sala de trading.';
  end if;
  new.texto := left(btrim(new.texto), 500);
  if new.texto = '' and old.imagen_url is null then
    raise exception 'El mensaje no puede quedar vacío.';
  end if;
  new.editado_at := now();
  return new;
end $$;
drop trigger if exists sala_editar_tr on public.sala_mensajes;
create trigger sala_editar_tr before update on public.sala_mensajes for each row execute function public.sala_editar();

-- Quien borra su propio mensaje también puede borrar su imagen (solo en su carpeta).
drop policy if exists "borrar imagen sala propia" on storage.objects;
create policy "borrar imagen sala propia" on storage.objects for delete to authenticated
  using (bucket_id = 'sala' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
