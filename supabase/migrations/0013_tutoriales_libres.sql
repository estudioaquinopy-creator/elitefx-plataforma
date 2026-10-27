-- 0013 · La biblioteca de Tutoriales es libre para todos los usuarios con sesión (incluido el plan gratuito).
-- Idempotente.
drop policy if exists "ver tutoriales" on public.tutoriales;
create policy "ver tutoriales" on public.tutoriales for select to authenticated using (true);
