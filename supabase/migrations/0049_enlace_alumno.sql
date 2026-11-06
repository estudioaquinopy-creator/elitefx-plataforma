-- Dos enlaces de registro gratuito:
--  · /registro                      → gratuito nuevo (ya funcionaba)
--  · /registro?alumno=CÓDIGO        → gratuito alumno (ex alumnos que no renovaron). El código lo genera/cambia el admin en Accesos.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare cod text; ref uuid; tel text; desde timestamptz; tn text; pc text; ca text; inv public.invitaciones_prueba%rowtype; usados int; fin timestamptz;
begin
  tel := nullif(new.raw_user_meta_data->>'telefono', '');
  insert into public.perfiles (id, email, nombre, telefono)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'nombre', ''), tel);
  begin
    cod := upper(btrim(coalesce(new.raw_user_meta_data->>'codigo_ref', '')));
    if cod <> '' then
      select ((coalesce(nullif(btrim((select a.valor from public.ajustes a where a.clave = 'referidos_desde')), ''), '2026-11-09'))::date)::timestamp at time zone 'America/Asuncion' into desde;
      if now() >= desde then
        tn := regexp_replace(coalesce(tel, ''), '\D', '', 'g');
        select p.id into ref from public.perfiles p
        where p.codigo_ref = cod and p.plan <> 'gratis' and p.rol <> 'admin' and p.id <> new.id and p.prueba_hasta is null and (p.vence is null or p.vence >= (now() at time zone 'America/Asuncion')::date)
          and (tn = '' or regexp_replace(coalesce(p.telefono, ''), '\D', '', 'g') <> tn)
          and (tn = '' or not exists (select 1 from public.perfiles o where o.id <> new.id and o.id <> p.id and regexp_replace(coalesce(o.telefono, ''), '\D', '', 'g') = tn));
        if ref is not null then update public.perfiles set referido_por = ref where id = new.id; end if;
      end if;
    end if;
  exception when others then null;
  end;
  -- Prueba VIP: si se registró con un enlace de invitación válido (vigente, con cupo) y es una persona nueva (el teléfono no está en otra cuenta).
  begin
    pc := upper(btrim(coalesce(new.raw_user_meta_data->>'codigo_prueba', '')));
    if pc <> '' then
      select * into inv from public.invitaciones_prueba where codigo = pc and activa and now() < expira_at;
      if found then
        perform pg_advisory_xact_lock(hashtext('prueba' || inv.id::text));
        select count(*) into usados from public.pruebas_canjeadas where invitacion_id = inv.id;
        tn := regexp_replace(coalesce(tel, ''), '\D', '', 'g');
        if usados < inv.cupo and (tn = '' or not exists (select 1 from public.perfiles o where o.id <> new.id and regexp_replace(coalesce(o.telefono, ''), '\D', '', 'g') = tn)) then
          fin := now() + make_interval(days => inv.dias);
          insert into public.pruebas_canjeadas (user_id, invitacion_id, hasta) values (new.id, inv.id, fin);
          update public.perfiles set plan = 'live_trading', vence = (fin at time zone 'America/Asuncion')::date, prueba_hasta = fin where id = new.id;
        end if;
      end if;
    end if;
  exception when others then null;
  end;
  -- Enlace de registro para ex alumnos (/registro?alumno=CÓDIGO): queda como gratuito alumno (ajuste registro_alumno_codigo; vacío = desactivado).
  begin
    ca := upper(btrim(coalesce(new.raw_user_meta_data->>'codigo_alumno', '')));
    if ca <> '' and ca = upper(btrim(coalesce((select a.valor from public.ajustes a where a.clave = 'registro_alumno_codigo'), ''))) then
      update public.perfiles set es_alumno = true where id = new.id and plan = 'gratis';
    end if;
  exception when others then null;
  end;
  return new;
end $$;


-- La página de registro pregunta si el código del enlace sigue vigente (no revela el código).
create or replace function public.alumno_enlace_valido(p_codigo text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(upper(btrim(p_codigo)) <> '' and upper(btrim(p_codigo)) = upper(btrim((select a.valor from public.ajustes a where a.clave = 'registro_alumno_codigo'))), false);
$$;
grant execute on function public.alumno_enlace_valido(text) to anon, authenticated;
