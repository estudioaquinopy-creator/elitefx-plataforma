-- 0039 · Prueba VIP por enlace de invitación (24 horas de vigencia, tope de personas, 5 días de VIP). Idempotente. Correr después de 0038.
-- El administrador crea la invitación en Accesos → Invitaciones de prueba. Quien se REGISTRA (persona nueva) con el enlace recibe VIP por los días indicados y luego vuelve a gratuito.
-- Durante la prueba: acceso a cursos, calendario, comunidad, journal y noticias; NO participa en el ranking ni puede agendar visitas.

alter table public.perfiles add column if not exists prueba_hasta timestamptz;

create table if not exists public.invitaciones_prueba (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  dias int not null default 5 check (dias between 1 and 30),
  cupo int not null default 100 check (cupo between 1 and 1000),
  expira_at timestamptz not null,
  activa boolean not null default true,
  nota text not null default '',
  creado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.pruebas_canjeadas (
  user_id uuid primary key references public.perfiles(id) on delete cascade,
  invitacion_id uuid not null references public.invitaciones_prueba(id) on delete cascade,
  canjeado_at timestamptz not null default now(),
  hasta timestamptz
);
alter table public.invitaciones_prueba enable row level security;
alter table public.pruebas_canjeadas enable row level security;
drop policy if exists "invitaciones admin" on public.invitaciones_prueba;
create policy "invitaciones admin" on public.invitaciones_prueba for all to authenticated using (public.es_admin()) with check (public.es_admin());
drop policy if exists "canjes admin" on public.pruebas_canjeadas;
create policy "canjes admin" on public.pruebas_canjeadas for select to authenticated using (public.es_admin());

-- Para la página de registro: dice si el enlace sirve y cuántos días da (no expone nada más).
create or replace function public.prueba_info(p_codigo text) returns table(valida boolean, dias int)
language sql stable security definer set search_path = public as $$
  select true, i.dias from public.invitaciones_prueba i
  where i.codigo = upper(btrim(p_codigo)) and i.activa and now() < i.expira_at
    and (select count(*) from public.pruebas_canjeadas c where c.invitacion_id = i.id) < i.cupo;
$$;
grant execute on function public.prueba_info(text) to anon, authenticated;

-- Quien tiene una prueba vencida vuelve a gratuito. La app lo llama al entrar; el administrador también al abrir Accesos.
create or replace function public.cerrar_pruebas_vencidas() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.perfiles set plan = 'gratis', vence = null, prueba_hasta = null
  where prueba_hasta is not null and prueba_hasta <= now() and rol <> 'admin';
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.cerrar_pruebas_vencidas() to authenticated;

-- Si el administrador cambia el plan o el vencimiento de alguien en prueba (por ejemplo, porque pagó), deja de ser prueba.
create or replace function public.limpiar_prueba() returns trigger language plpgsql as $$
begin
  if old.prueba_hasta is not null and new.prueba_hasta is not distinct from old.prueba_hasta
     and (new.plan is distinct from old.plan or new.vence is distinct from old.vence) then
    new.prueba_hasta := null;
  end if;
  return new;
end $$;
drop trigger if exists limpiar_prueba_tr on public.perfiles;
create trigger limpiar_prueba_tr before update of plan, vence on public.perfiles for each row execute function public.limpiar_prueba();

-- Una prueba vencida ya no cuenta como miembro ni como calendario vigente, aunque la fila aún no se haya devuelto a gratuito.
create or replace function public.es_miembro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid()
    and (rol = 'admin' or (plan <> 'gratis' and (prueba_hasta is null or prueba_hasta > now()))));
$$;
create or replace function public.puede_calendario() returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.plan <> 'gratis'
               and (p.prueba_hasta is null or p.prueba_hasta > now())
               and p.vence is not null and p.vence >= (now() at time zone 'America/Asuncion')::date)
    or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.plan = 'gratis'
               and p.calendario_bono_hasta is not null and p.calendario_bono_hasta >= (now() at time zone 'America/Asuncion')::date)
    or exists (select 1 from public.accesos a where a.user_id = auth.uid() and a.seccion = 'calendario' and a.concedido);
$$;

-- La prueba NO cuenta como "pasó a VIP" (no da bonus a quien lo refirió).
create or replace function public.marcar_vip_desde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan <> 'gratis' and new.vip_desde is null and new.prueba_hasta is null then
    if tg_op = 'INSERT' then
      new.vip_desde := now();
    elsif old.plan = 'gratis' then
      new.vip_desde := now();
    end if;
  end if;
  return new;
end $$;

-- Registro: perfil gratuito, referido (0027) y prueba VIP por invitación.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare cod text; ref uuid; tel text; desde timestamptz; tn text; pc text; inv public.invitaciones_prueba%rowtype; usados int; fin timestamptz;
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
        where p.codigo_ref = cod and p.plan <> 'gratis' and p.rol <> 'admin' and p.id <> new.id
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
  return new;
end $$;

-- Las visitas a la oficina no están incluidas en la prueba.
create or replace function public.visitas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare hoy date := (now() at time zone 'America/Asuncion')::date; vip boolean; cupo int := greatest(1, public.ajuste_num('visitas_cupo', 3));
begin
  select ((plan <> 'gratis' and prueba_hasta is null) or rol = 'admin') into vip from public.perfiles where id = new.user_id;
  if not coalesce(vip, false) then raise exception 'Las visitas son solo para miembros VIP (no están incluidas en la prueba gratuita).'; end if;
  if new.fecha <= hoy then raise exception 'Elige una fecha a partir de mañana.'; end if;
  if new.fecha > hoy + 56 then raise exception 'Solo se puede agendar con hasta 8 semanas de anticipación.'; end if;
  if exists (select 1 from public.visitas v where v.user_id = new.user_id and v.estado in ('pendiente', 'aprobada') and v.fecha >= hoy) then
    raise exception 'Ya tienes una visita pendiente o aprobada. Cancélala si quieres pedir otra.';
  end if;
  if (select count(*) from public.visitas v where v.fecha = new.fecha and v.hora = new.hora and v.estado = 'aprobada') >= cupo then
    raise exception 'Ese horario ya está completo. Elige otro.';
  end if;
  new.tema := left(btrim(new.tema), 60);
  new.detalle := left(btrim(new.detalle), 600);
  return new;
end $$;

-- El ranking no incluye a quienes están en prueba.
drop function if exists public.ranking_mes(text);
create or replace function public.ranking_mes(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int, referidos int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare t0 timestamptz; t1 timestamptz; pc int; pr int; prv int; tope int; pfoto int; pliq int; pliqr int;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido.'; end if;
  t0 := (public.ranking_cierre(to_char((p_mes || '-01')::date - interval '1 month', 'YYYY-MM')) + 1)::timestamp at time zone 'America/Asuncion';
  t1 := (public.ranking_cierre(p_mes) + 1)::timestamp at time zone 'America/Asuncion';
  pc := public.ajuste_num('ranking_pts_certificado', 10);
  pr := public.ajuste_num('ranking_pts_ref', 5);
  prv := public.ajuste_num('ranking_pts_ref_vip', 10);
  tope := public.ajuste_num('ranking_ref_tope', 10);
  pfoto := public.ajuste_num('ranking_pts_foto', 5);
  pliq := public.ajuste_num('ranking_pts_liquid', 5);
  pliqr := public.ajuste_num('ranking_pts_liquid_real', 5);
  return query
  with el as (
    select pf.id as uid, coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nom
    from public.perfiles pf where pf.plan <> 'gratis' and pf.rol <> 'admin' and pf.prueba_hasta is null
  ),
  ev as (
    select q.uid, q.d, q.pts, q.tipo from (
      select p.user_id as uid, (p.created_at at time zone 'America/Asuncion')::date as d,
             case when p.canal = 'resultados' then 3 + (case when p.imagen_url is not null then 1 else 0 end) else 2 end as pts,
             p.canal::text as tipo,
             row_number() over (partition by p.user_id, (p.created_at at time zone 'America/Asuncion')::date, p.canal order by p.created_at) as rn
      from public.publicaciones p
      where p.canal in ('preguntas', 'resultados') and p.created_at >= t0 and p.created_at < t1
        and (length(btrim(p.cuerpo)) + length(btrim(p.titulo)) >= 15 or p.imagen_url is not null)
    ) q where q.rn <= 2
    union all
    select y.user_id, y.d, 1, 'respuesta'
    from (
      select x.user_id, x.d, row_number() over (partition by x.user_id, x.d order by x.t) as rd
      from (
        select c.user_id, (c.created_at at time zone 'America/Asuncion')::date as d, c.created_at as t,
               row_number() over (partition by c.user_id, c.post_id order by c.created_at) as rp
        from public.comentarios c join public.publicaciones p on p.id = c.post_id
        where length(btrim(c.cuerpo)) >= 20 and c.user_id <> p.user_id
      ) x
      where x.rp = 1 and x.t >= t0 and x.t < t1
    ) y where y.rd <= 5
    union all
    select u.user_id, u.d, 5, 'util'
    from (
      select c.user_id, (c.created_at at time zone 'America/Asuncion')::date as d, c.created_at as t,
             row_number() over (partition by c.user_id, c.post_id order by c.created_at) as ru
      from public.comentarios c join public.publicaciones p on p.id = c.post_id
      where c.util and c.user_id <> p.user_id
    ) u where u.ru = 1 and u.t >= t0 and u.t < t1
    union all
    select ce.user_id, (ce.emitido_at at time zone 'America/Asuncion')::date, pc, 'certificado'
    from public.certificados ce where ce.emitido_at >= t0 and ce.emitido_at < t1
    union all
    select r.user_id, (r.t at time zone 'America/Asuncion')::date, pr, 'ref'
    from (
      select x.referido_por as user_id, x.t, row_number() over (partition by x.referido_por order by x.t) as rn
      from (
        select pf.referido_por, (select min(g.completada_at) from public.progreso g where g.user_id = pf.id) as t
        from public.perfiles pf where pf.referido_por is not null
      ) x where x.t >= t0 and x.t < t1
    ) r where r.rn <= tope
    union all
    select pf.referido_por, (pf.vip_desde at time zone 'America/Asuncion')::date, prv, 'refvip'
    from public.perfiles pf
    where pf.referido_por is not null and pf.plan <> 'gratis' and pf.vip_desde >= t0 and pf.vip_desde < t1
    union all
    select pf.id, (pf.avatar_desde at time zone 'America/Asuncion')::date, pfoto, 'foto'
    from public.perfiles pf where pf.avatar_desde >= t0 and pf.avatar_desde < t1
    union all
    select li.user_id, (li.revisado_at at time zone 'America/Asuncion')::date, pliq, 'liquid'
    from public.liquid_cuentas li where li.estado = 'aprobado' and li.revisado_at >= t0 and li.revisado_at < t1
    union all
    select li.user_id, (li.reward_at at time zone 'America/Asuncion')::date, pliqr, 'liquidreal'
    from public.liquid_cuentas li where li.estado = 'aprobado' and li.reward_at >= t0 and li.reward_at < t1
    union all
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, 1, 'like'
    from (select l2.post_id, l2.user_id, l2.created_at, row_number() over (partition by l2.post_id order by l2.created_at) as rn from public.likes l2) l
    join public.publicaciones p on p.id = l.post_id
    where l.rn <= 10 and l.user_id <> p.user_id and p.canal in ('preguntas', 'resultados') and l.created_at >= t0 and l.created_at < t1
  ),
  dia as (
    select e.uid, e.d,
      least(coalesce(sum(e.pts) filter (where e.tipo not in ('util', 'certificado', 'ref', 'refvip', 'foto', 'liquid', 'liquidreal')), 0), 12) + coalesce(sum(e.pts) filter (where e.tipo in ('util', 'certificado', 'ref', 'refvip', 'foto', 'liquid', 'liquidreal')), 0) as pts
    from ev e group by e.uid, e.d
  ),
  tot as (select d.uid, sum(d.pts)::int as pts from dia d group by d.uid),
  cnt as (
    select e.uid,
      (count(*) filter (where e.tipo = 'resultados'))::int as r, (count(*) filter (where e.tipo = 'preguntas'))::int as q,
      (count(*) filter (where e.tipo = 'respuesta'))::int as a, (count(*) filter (where e.tipo = 'util'))::int as u,
      (count(*) filter (where e.tipo = 'like'))::int as l, (count(*) filter (where e.tipo = 'certificado'))::int as ce, (count(*) filter (where e.tipo = 'ref'))::int as rf
    from ev e group by e.uid
  ),
  adj as (select a.user_id as uid, sum(a.puntos)::int as pts from public.ranking_ajustes a where a.mes = p_mes group by a.user_id)
  select el.uid, el.nom, (coalesce(tot.pts, 0) + coalesce(adj.pts, 0))::int,
         coalesce(cnt.r, 0), coalesce(cnt.q, 0), coalesce(cnt.a, 0), coalesce(cnt.u, 0), coalesce(cnt.l, 0), coalesce(cnt.ce, 0), coalesce(cnt.rf, 0)
  from el
  left join tot on tot.uid = el.uid
  left join cnt on cnt.uid = el.uid
  left join adj on adj.uid = el.uid
  where coalesce(tot.pts, 0) + coalesce(adj.pts, 0) > 0
  order by 3 desc, 2;
end $$;
grant execute on function public.ranking_mes(text) to authenticated;
