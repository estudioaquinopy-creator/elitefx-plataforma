-- =====================================================================
-- ELITE FX · Asistente IA · Migración 1 de 1
-- ---------------------------------------------------------------------
-- Esta migración SOLO AGREGA. No modifica, renombra ni borra ninguna
-- tabla, columna, política, función o trigger existente.
-- Todo vive en un esquema propio llamado "ia".
-- Para deshacerlo por completo: supabase/deshacer_ia.sql
-- =====================================================================

create schema if not exists ia;

-- El esquema "ia" no se expone a la API pública.
-- Solo las Edge Functions (con la service role) leen y escriben aquí.
revoke all on schema ia from anon, authenticated;
grant usage on schema ia to service_role;

-- ---------------------------------------------------------------------
-- 1. Administradores que pueden ver el panel de IA
--    Se cargan a mano los user_id (de auth.users) de cada administrador.
-- ---------------------------------------------------------------------
create table if not exists ia.administradores (
  user_id    uuid primary key,
  nombre     text,
  creado_en  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Alertas del ranking (resultado de la auditoría nocturna)
-- ---------------------------------------------------------------------
create table if not exists ia.alertas_ranking (
  id                 bigint generated always as identity primary key,
  alumno_id          uuid not null,
  alumno_nombre      text,
  dia                date not null,
  puntos_registrados integer not null,
  puntos_calculados  integer not null,
  diferencia         integer generated always as (puntos_registrados - puntos_calculados) stored,
  motivo             text not null,           -- explicación de la IA, en lenguaje simple
  detalle            jsonb not null default '{}'::jsonb, -- cálculo paso a paso
  sospechas          jsonb not null default '[]'::jsonb, -- conductas a revisar
  estado             text not null default 'pendiente'
                     check (estado in ('pendiente', 'resuelta', 'descartada')),
  nota_admin         text,
  resuelta_por       uuid,
  resuelta_en        timestamptz,
  creado_en          timestamptz not null default now(),
  unique (alumno_id, dia)
);

-- ---------------------------------------------------------------------
-- 3. Revisión de textos (posible uso de IA)
-- ---------------------------------------------------------------------
create table if not exists ia.revisiones_textos (
  id             bigint generated always as identity primary key,
  origen_tabla   text not null,               -- 'publicacion' o 'respuesta'
  origen_id      text not null,               -- id del registro original (solo lectura)
  alumno_id      uuid not null,
  alumno_nombre  text,
  extracto       text not null,
  probabilidad   text not null check (probabilidad in ('baja', 'media', 'alta')),
  senales        jsonb not null default '[]'::jsonb,
  estado         text not null default 'pendiente'
                 check (estado in ('pendiente', 'valido', 'pedir_explicacion', 'descartada')),
  nota_admin     text,
  resuelta_por   uuid,
  resuelta_en    timestamptz,
  creado_en      timestamptz not null default now(),
  unique (origen_tabla, origen_id)
);

-- ---------------------------------------------------------------------
-- 4. Registro de soporte (conversaciones con el asistente)
-- ---------------------------------------------------------------------
create table if not exists ia.registro_soporte (
  id           bigint generated always as identity primary key,
  usuario_id   uuid not null,
  rol          text not null check (rol in ('admin', 'alumno')),
  pregunta     text not null,
  respuesta    text not null,
  derivado     boolean not null default false, -- el alumno pidió hablar con una persona
  creado_en    timestamptz not null default now()
);
create index if not exists registro_soporte_usuario_fecha
  on ia.registro_soporte (usuario_id, creado_en desc);

-- ---------------------------------------------------------------------
-- 5. Marca de avance de la revisión de textos
--    (para revisar solo lo nuevo en cada pasada)
-- ---------------------------------------------------------------------
create table if not exists ia.estado_tareas (
  tarea           text primary key,
  ultima_revision timestamptz not null
);

-- ---------------------------------------------------------------------
-- 6. Calendario del ranking: el mes cierra el último viernes a las 23:59
-- ---------------------------------------------------------------------
-- Último viernes del mes calendario de la fecha d.
create or replace function ia.ultimo_viernes(d date) returns date
language sql immutable as $$
  select (date_trunc('month', d) + interval '1 month - 1 day')::date
       - ((extract(dow from date_trunc('month', d) + interval '1 month - 1 day')::int - 5 + 7) % 7)
$$;

-- Primer día del mes de ranking al que pertenece la fecha d.
create or replace function ia.inicio_mes(d date) returns date
language sql immutable as $$
  select case
    when d > ia.ultimo_viernes(d) then ia.ultimo_viernes(d) + 1
    else ia.ultimo_viernes((date_trunc('month', d) - interval '1 day')::date) + 1
  end
$$;

-- Fecha de cierre del mes de ranking al que pertenece la fecha d.
create or replace function ia.cierre_mes(d date) returns date
language sql immutable as $$
  select case
    when d > ia.ultimo_viernes(d) then ia.ultimo_viernes((date_trunc('month', d) + interval '1 month')::date)
    else ia.ultimo_viernes(d)
  end
$$;

revoke all on function ia.ultimo_viernes(date), ia.inicio_mes(date), ia.cierre_mes(date) from public;

-- ---------------------------------------------------------------------
-- Seguridad: RLS activado sin políticas para anon/authenticated.
-- Nadie accede desde el navegador; solo la service role de las
-- Edge Functions, que controlan quién es admin y quién es alumno.
-- ---------------------------------------------------------------------
alter table ia.administradores   enable row level security;
alter table ia.alertas_ranking   enable row level security;
alter table ia.revisiones_textos enable row level security;
alter table ia.registro_soporte  enable row level security;
alter table ia.estado_tareas     enable row level security;

grant all on all tables in schema ia to service_role;
grant usage, select on all sequences in schema ia to service_role;
