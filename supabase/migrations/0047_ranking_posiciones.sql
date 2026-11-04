-- 0047 · Ranking: flechitas de subida o bajada de puesto. Idempotente. Correr después de 0046.
-- Una vez al día (la primera vez que alguien abre el ranking en curso) se guarda el puesto de cada persona.
-- La flechita compara el puesto de hoy con el de la última foto de un día anterior.
create table if not exists public.ranking_posiciones (
  mes text not null,
  dia date not null,
  user_id uuid not null,
  puesto int not null,
  primary key (mes, dia, user_id)
);
alter table public.ranking_posiciones enable row level security;
drop policy if exists "ver posiciones del ranking" on public.ranking_posiciones;
create policy "ver posiciones del ranking" on public.ranking_posiciones for select to authenticated using (true);
-- Solo escribe el servidor (clave de servicio); no hay política de escritura para los usuarios.
