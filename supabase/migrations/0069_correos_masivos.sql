-- Correos masivos del administrador (Accesos → Enviar correo). Solo se leen y escriben con la clave de servicio (RLS sin políticas).
create table if not exists public.correos_envios (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid references auth.users(id) on delete set null,
  creado_at timestamptz not null default now(),
  asunto text not null,
  mensaje text not null,
  audiencia text
);
create table if not exists public.correos_cola (
  id bigserial primary key,
  envio_id uuid not null references public.correos_envios(id) on delete cascade,
  email text not null,
  nombre text,
  estado text not null default 'pendiente' check (estado in ('pendiente','enviando','enviado','fallido')),
  enviado_at timestamptz,
  error text,
  unique (envio_id, email)
);
create index if not exists correos_cola_estado_idx on public.correos_cola (envio_id, estado);
create index if not exists correos_cola_enviado_idx on public.correos_cola (enviado_at) where estado = 'enviado';
create table if not exists public.correos_bajas (
  email text primary key,
  creado_at timestamptz not null default now()
);
alter table public.correos_envios enable row level security;
alter table public.correos_cola enable row level security;
alter table public.correos_bajas enable row level security;
