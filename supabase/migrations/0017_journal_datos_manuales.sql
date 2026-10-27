-- 0017 · Journal: más datos al anotar una operación a mano (sesión, estrategia, estado emocional, si siguió su plan).
-- Idempotente.
alter table public.operaciones
  add column if not exists sesion text,
  add column if not exists setup text,
  add column if not exists emocion text,
  add column if not exists respeto_plan boolean;
