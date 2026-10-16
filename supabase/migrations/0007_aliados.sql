-- ELITE FX · Aliados editables (brokers, tarjetas, empresas de fondeo...).
-- Pégalo completo en Supabase > SQL Editor > New query > Run.

create table public.aliados (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'Broker',          -- Broker, Tarjeta, Fondeo, Otro
  titulo text not null,
  descripcion text not null default '',
  url text not null default '',
  boton text not null default 'Abrir cuenta',
  tutorial_url text not null default '',        -- enlace de YouTube con el tutorial para crear la cuenta
  orden int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.aliados enable row level security;
create policy "ver aliados" on public.aliados for select to authenticated using (true);
create policy "admin gestiona aliados" on public.aliados for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- Pasa lo que ya tenías cargado en Aliados a la nueva tabla.
insert into public.aliados (tipo, titulo, descripcion, url, orden)
values (
  'Broker', 'Liquid Brokers',
  'Liquid Brokers es el nombre comercial de Liquid Markets Pty Ltd, un bróker de CFD con sede en Australia. Ofrece más de 300 instrumentos (forex, índices, materias primas, acciones y criptomonedas) y opera con MetaTrader 5 y plataformas propias.',
  coalesce((select valor from public.ajustes where clave = 'aliados_broker_url'), ''), 1);

insert into public.aliados (tipo, titulo, descripcion, url, tutorial_url, orden)
select 'Tarjeta', 'Tarjeta recomendada para usar criptos',
  coalesce((select valor from public.ajustes where clave = 'aliados_tarjeta_desc'), ''),
  coalesce((select valor from public.ajustes where clave = 'aliados_tarjeta_url'), ''),
  coalesce((select valor from public.ajustes where clave = 'aliados_video'), ''), 2;
