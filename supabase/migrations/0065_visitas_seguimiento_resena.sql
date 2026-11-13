-- 0065 · Visitas: el equipo marca si la visita fue atendida o no asistió, deja notas internas y seguimiento; la persona deja una reseña. Idempotente. Correr después de 0064.
--  · visitas.resultado ('atendida' | 'no_asistio'): lo ve la persona; solo lo cambia un administrador.
--  · visitas_seguimiento: nota INTERNA y marca "seguimiento pendiente" (tabla aparte, solo administradores: la persona nunca la puede leer).
--  · Reseña de la persona (1 a 5 estrellas + comentario) con la función visitas_resenar (solo su propia visita ya atendida).

alter table public.visitas add column if not exists resultado text;
alter table public.visitas add column if not exists resultado_at timestamptz;
alter table public.visitas add column if not exists resultado_por uuid references public.perfiles(id) on delete set null;
alter table public.visitas add column if not exists resena_estrellas int;
alter table public.visitas add column if not exists resena_texto text not null default '';
alter table public.visitas add column if not exists resena_at timestamptz;
alter table public.visitas drop constraint if exists visitas_resultado_check;
alter table public.visitas add constraint visitas_resultado_check check (resultado is null or resultado in ('atendida', 'no_asistio'));
alter table public.visitas drop constraint if exists visitas_resena_check;
alter table public.visitas add constraint visitas_resena_check check (resena_estrellas is null or resena_estrellas between 1 and 5);

create table if not exists public.visitas_seguimiento (
  visita_id uuid primary key references public.visitas(id) on delete cascade,
  nota text not null default '',
  pendiente boolean not null default false,
  updated_by uuid references public.perfiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.visitas_seguimiento enable row level security;
drop policy if exists "visitas seguimiento admin" on public.visitas_seguimiento;
create policy "visitas seguimiento admin" on public.visitas_seguimiento for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- La persona no puede tocar el resultado ni la reseña por su cuenta (la política de cancelar solo deja pasar a "cancelada").
create or replace function public.visitas_resenar(p_id uuid, p_estrellas int, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_estrellas is null or p_estrellas < 1 or p_estrellas > 5 then raise exception 'Elige de 1 a 5 estrellas.'; end if;
  update public.visitas set resena_estrellas = p_estrellas, resena_texto = left(btrim(coalesce(p_texto, '')), 500), resena_at = now()
    where id = p_id and user_id = auth.uid() and resultado = 'atendida';
  if not found then raise exception 'Solo puedes reseñar una visita en la que fuiste atendido.'; end if;
end $$;
grant execute on function public.visitas_resenar(uuid, int, text) to authenticated;

notify pgrst, 'reload schema';
