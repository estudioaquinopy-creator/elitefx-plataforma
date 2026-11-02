-- 0041 · Tres tipos de acceso (sin contar al administrador): gratuito nuevo, gratuito alumno y VIP. Idempotente. Correr después de 0040.
--  · Gratuito nuevo: nunca fue alumno. Solo cursos marcados "visible para el plan gratuito", tutoriales y ver el ranking.
--  · Gratuito alumno (`es_alumno`): fue VIP y venció. Todos los cursos y tutoriales; sin calendario, comunidad, journal, noticias, visitas ni referidos.
--  · VIP: acceso total mientras su vencimiento esté vigente. Al vencer pasa SOLO a gratuito alumno (plan gratuito + es_alumno).

alter table public.perfiles add column if not exists es_alumno boolean not null default false;

-- Quien ya es o fue VIP real (no prueba) cuenta como alumno.
update public.perfiles set es_alumno = true where es_alumno = false and prueba_hasta is null and (plan <> 'gratis' or vip_desde is not null);

-- Los alumnos no pueden cambiar este campo: solo editan nombre, telefono, avatar_url y notif_leidas_at (ya limitado por permisos de columna).

-- Al pasar a VIP (no prueba) la persona queda marcada como alumno para siempre.
create or replace function public.marcar_vip_desde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan <> 'gratis' and new.prueba_hasta is null then
    new.es_alumno := true;
    if new.vip_desde is null then
      if tg_op = 'INSERT' then
        new.vip_desde := now();
      elsif old.plan = 'gratis' then
        new.vip_desde := now();
      end if;
    end if;
  end if;
  return new;
end $$;

-- Cierra pruebas vencidas (vuelven a gratuito nuevo) y membresías VIP vencidas (pasan a gratuito alumno).
create or replace function public.cerrar_pruebas_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare n int; m int;
begin
  update public.perfiles set plan = 'gratis', vence = null, prueba_hasta = null
  where prueba_hasta is not null and prueba_hasta <= now() and rol <> 'admin';
  get diagnostics n = row_count;
  update public.perfiles set plan = 'gratis', es_alumno = true
  where plan <> 'gratis' and rol <> 'admin' and prueba_hasta is null
    and vence is not null and vence < (now() at time zone 'America/Asuncion')::date;
  get diagnostics m = row_count;
  return n + m;
end $$;
grant execute on function public.cerrar_pruebas_vencidas() to authenticated;

-- Cursos: el gratuito alumno ve todos.
create or replace function public.puede_ver_curso(p_curso uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    public.es_admin()
    or exists (select 1 from public.cursos c where c.id = p_curso and c.gratis)
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and (p.plan <> 'gratis' or p.es_alumno))
    or exists (select 1 from public.accesos a where a.user_id = auth.uid() and a.seccion = 'cursos' and a.concedido);
$$;

-- Secciones: cursos y tutoriales con cualquier VIP o alumno; el resto exige VIP vigente (más accesos puntuales del administrador).
create or replace function public.tiene_acceso(sec text) returns boolean
language sql stable security definer set search_path = public as $$
  select (case when sec in ('cursos', 'tutoriales')
              then (public.es_miembro() or exists (select 1 from public.perfiles where id = auth.uid() and es_alumno))
              else public.vip_vigente() end)
    or exists (select 1 from public.accesos a where a.user_id = auth.uid() and a.seccion = sec and a.concedido);
$$;
