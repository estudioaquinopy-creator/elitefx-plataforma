-- 0027 · Sistema de referidos (solo VIP). Idempotente. Correr después de 0026.
-- Cada VIP tiene un código (EFX-XXXXXX) y un enlace /registro?ref=CÓDIGO. Quien se registra con él entra como miembro gratuito y queda como referido.
-- Puntos para el ranking mensual del referente (no cuentan para el tope diario de 12):
--   · referido ACTIVO (completó al menos una lección): ranking_pts_ref (por defecto 5), máx. ranking_ref_tope por mes (por defecto 10); cuenta en el mes en que se activó.
--   · referido que pasa a VIP: ranking_pts_ref_vip (por defecto 10 más, o sea 15 en total), sin tope; cuenta en el mes en que pasó a VIP.
-- Solo vale desde la fecha del ajuste "referidos_desde" (por defecto 2026-11-09, hora de Paraguay): antes, el código se ignora.
-- Se ignora el referido si comparte teléfono con el referente o con otra cuenta ya existente.

alter table public.perfiles add column if not exists codigo_ref text;
alter table public.perfiles add column if not exists referido_por uuid references public.perfiles(id) on delete set null;
alter table public.perfiles add column if not exists vip_desde timestamptz;
create unique index if not exists perfiles_codigo_ref_uq on public.perfiles(codigo_ref) where codigo_ref is not null;
create index if not exists perfiles_referido_por_ix on public.perfiles(referido_por) where referido_por is not null;
-- Quienes ya eran VIP antes de esta migración.
update public.perfiles set vip_desde = created_at where plan <> 'gratis' and vip_desde is null;

-- Registra la fecha en que alguien pasa a VIP por primera vez.
create or replace function public.marcar_vip_desde() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.plan <> 'gratis' and new.vip_desde is null then
    if tg_op = 'INSERT' then
      new.vip_desde := now();
    elsif old.plan = 'gratis' then
      new.vip_desde := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists al_cambiar_plan on public.perfiles;
create trigger al_cambiar_plan before insert or update of plan on public.perfiles
  for each row execute function public.marcar_vip_desde();

-- Número guardado en "ajustes" (0 a 999) o el valor por defecto.
create or replace function public.ajuste_num(p_clave text, p_def int) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select case when a.valor ~ '^\s*\d{1,3}\s*$' then btrim(a.valor)::int end from public.ajustes a where a.clave = p_clave), p_def)
$$;

-- Al crearse un usuario se crea su perfil (siempre gratuito) y, si trae un código de referido válido, se anota quién lo refirió.
-- El referido NUNCA bloquea el registro: cualquier problema se ignora.
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare cod text; ref uuid; tel text; desde timestamptz; tn text;
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
  return new;
end $$;

-- Código de referido de la persona que mira (se crea la primera vez). Solo VIP (y administradores para probar).
create or replace function public.mi_codigo_referido() returns text
language plpgsql security definer set search_path = public as $$
declare c text; n int := 0; ok boolean;
begin
  if auth.uid() is null then return null; end if;
  select p.codigo_ref, (p.plan <> 'gratis' or p.rol = 'admin') into c, ok from public.perfiles p where p.id = auth.uid();
  if not coalesce(ok, false) then return null; end if;
  if c is not null then return c; end if;
  loop
    c := 'EFX-' || upper(substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 6));
    begin
      update public.perfiles set codigo_ref = c where id = auth.uid() and codigo_ref is null;
      select p.codigo_ref into c from public.perfiles p where p.id = auth.uid();
      return c;
    exception when unique_violation then
      n := n + 1;
      if n > 10 then raise; end if;
    end;
  end loop;
end $$;
grant execute on function public.mi_codigo_referido() to authenticated;

-- Mis referidos: solo nombre y primera letra del apellido, fecha de registro y estado (sin correo ni teléfono).
create or replace function public.mis_referidos() returns table(nombre text, registrado timestamptz, activo boolean, vip boolean)
language sql stable security definer set search_path = public as $$
  select btrim(split_part(btrim(p.nombre), ' ', 1) || ' ' || coalesce(left(nullif(split_part(btrim(p.nombre), ' ', 2), ''), 1) || '.', '')),
         p.created_at,
         exists (select 1 from public.progreso g where g.user_id = p.id),
         p.plan <> 'gratis'
  from public.perfiles p where p.referido_por = auth.uid() order by p.created_at desc
$$;
grant execute on function public.mis_referidos() to authenticated;

drop function if exists public.ranking_mes(text);
create or replace function public.ranking_mes(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int, certificados int, referidos int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare t0 timestamptz; t1 timestamptz; pc int; pr int; prv int; tope int;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido.'; end if;
  t0 := (public.ranking_cierre(to_char((p_mes || '-01')::date - interval '1 month', 'YYYY-MM')) + 1)::timestamp at time zone 'America/Asuncion';
  t1 := (public.ranking_cierre(p_mes) + 1)::timestamp at time zone 'America/Asuncion';
  pc := public.ajuste_num('ranking_pts_certificado', 10);
  pr := public.ajuste_num('ranking_pts_ref', 5);
  prv := public.ajuste_num('ranking_pts_ref_vip', 10);
  tope := public.ajuste_num('ranking_ref_tope', 10);
  return query
  with el as (
    select pf.id as uid, coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nom
    from public.perfiles pf where pf.plan <> 'gratis' and pf.rol <> 'admin'
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
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, 1, 'like'
    from (select l2.post_id, l2.user_id, l2.created_at, row_number() over (partition by l2.post_id order by l2.created_at) as rn from public.likes l2) l
    join public.publicaciones p on p.id = l.post_id
    where l.rn <= 10 and l.user_id <> p.user_id and p.canal in ('preguntas', 'resultados') and l.created_at >= t0 and l.created_at < t1
  ),
  dia as (
    select e.uid, e.d,
      least(coalesce(sum(e.pts) filter (where e.tipo not in ('util', 'certificado', 'ref', 'refvip')), 0), 12) + coalesce(sum(e.pts) filter (where e.tipo in ('util', 'certificado', 'ref', 'refvip')), 0) as pts
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
