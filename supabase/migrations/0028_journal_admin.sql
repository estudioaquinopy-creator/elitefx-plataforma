-- 0028 · El administrador puede VER (solo lectura) el journal de los alumnos, para el seguimiento en mentorías. Idempotente.
-- Escribir, editar o borrar sigue siendo solo de cada persona (las políticas "journal propio" no cambian).
drop policy if exists "journal ver admin" on public.operaciones;
create policy "journal ver admin" on public.operaciones for select to authenticated
  using (public.es_admin());

drop policy if exists "journal config ver admin" on public.journal_config;
create policy "journal config ver admin" on public.journal_config for select to authenticated
  using (public.es_admin());
