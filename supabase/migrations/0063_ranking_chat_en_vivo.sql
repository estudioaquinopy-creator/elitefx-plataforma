-- 0063 · Puntos por participar en el Chat en vivo. Idempotente. Correr después de 0062.
-- Los mensajes del chat se borran a las 24 h, así que los puntos se guardan aparte (tabla sala_puntos) en el momento de enviar o recibir la reacción.
--  · Mensaje de 20 o más caracteres: 1 punto (máx. 3 al día; sin repetidos; al menos 2 minutos desde tu mensaje anterior).
--  · Un mensaje tuyo recibe una reacción de otra persona: 1 punto (máx. 2 al día).
--  · Compartir una imagen: 1 punto (máx. 1 al día).
--  · Tope del chat: 5 puntos por día; además cuenta dentro del tope diario general de 12 del ranking.
--  · Ajustes editables (ajustes): ranking_pts_chat (1) y ranking_chat_tope_dia (5).
--  · Solo participan quienes ya participan en el ranking (VIP del período; el administrador y la prueba VIP no).

create table if not exists public.sala_puntos (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  dia date not null,
  tipo text not null check (tipo in ('msg', 'reac', 'img')),
  pts int not null,
  clave text,               -- msg: huella del texto (evita repetidos) · reac: id del mensaje
  created_at timestamptz not null default now()
);
create index if not exists sala_puntos_user_dia on public.sala_puntos (user_id, dia);
create unique index if not exists sala_puntos_reac_unica on public.sala_puntos (user_id, tipo, clave) where tipo = 'reac';
alter table public.sala_puntos enable row level security;  -- sin políticas: solo las funciones de la base de datos escriben y leen

create or replace function public.sala_dar_puntos(p_user uuid, p_tipo text, p_clave text) returns void
language plpgsql security definer set search_path = public as $$
declare dia_ date := (now() at time zone 'America/Asuncion')::date; pts_ int; tope int; maxtipo int; n_tipo int; total int;
begin
  pts_ := public.ajuste_num('ranking_pts_chat', 1);
  tope := public.ajuste_num('ranking_chat_tope_dia', 5);
  maxtipo := case p_tipo when 'msg' then 3 when 'reac' then 2 else 1 end;
  if pts_ <= 0 then return; end if;
  select count(*), coalesce(sum(pts) filter (where true), 0) into n_tipo, total from public.sala_puntos where user_id = p_user and dia = dia_ and tipo = p_tipo;
  if n_tipo >= maxtipo then return; end if;
  select coalesce(sum(pts), 0) into total from public.sala_puntos where user_id = p_user and dia = dia_;
  if total + pts_ > tope then return; end if;
  if p_tipo = 'msg' and exists (select 1 from public.sala_puntos where user_id = p_user and dia = dia_ and tipo = 'msg' and clave = p_clave) then return; end if;
  insert into public.sala_puntos (user_id, dia, tipo, pts, clave) values (p_user, dia_, p_tipo, pts_, p_clave) on conflict do nothing;
end $$;
revoke all on function public.sala_dar_puntos(uuid, text, text) from public, authenticated;

-- Al enviar un mensaje: puntos por texto y por imagen. Nunca bloquea el envío.
create or replace function public.sala_puntos_mensaje() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    if new.autor_admin then return new; end if;
    if char_length(btrim(new.texto)) >= 20
       and not exists (select 1 from public.sala_mensajes m where m.user_id = new.user_id and m.id <> new.id
                       and m.created_at > new.created_at - interval '2 minutes' and m.created_at <= new.created_at) then
      perform public.sala_dar_puntos(new.user_id, 'msg', md5(lower(btrim(new.texto))));
    end if;
    if new.imagen_url is not null then
      perform public.sala_dar_puntos(new.user_id, 'img', null);
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists sala_puntos_mensaje_tr on public.sala_mensajes;
create trigger sala_puntos_mensaje_tr after insert on public.sala_mensajes for each row execute function public.sala_puntos_mensaje();

-- Al recibir una reacción de otra persona: 1 punto por mensaje reaccionado para su autor.
create or replace function public.sala_puntos_reaccion() returns trigger language plpgsql security definer set search_path = public as $$
declare autor uuid; es_adm boolean;
begin
  begin
    select m.user_id, m.autor_admin into autor, es_adm from public.sala_mensajes m where m.id = new.mensaje_id;
    if autor is not null and autor <> new.user_id and not coalesce(es_adm, false) then
      perform public.sala_dar_puntos(autor, 'reac', new.mensaje_id::text);
    end if;
  exception when others then null;
  end;
  return new;
end $$;
drop trigger if exists sala_puntos_reaccion_tr on public.sala_reacciones;
create trigger sala_puntos_reaccion_tr after insert on public.sala_reacciones for each row execute function public.sala_puntos_reaccion();

-- Ranking: suma los puntos del chat (dentro del tope diario general de 12).
create or replace function public.ranking_mes_calc(p_mes text)
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
  -- Reglas de Liquid de los meses anteriores a noviembre de 2026: 5 puntos por la cuenta y 5 por operar en real. Desde noviembre: los ajustes actuales (20 y 0).
  if p_mes < '2026-11' then pliq := 5; pliqr := 5; end if;
  return query
  with el as (
    select pf.id as uid, coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nom
    from public.perfiles pf
    where pf.rol <> 'admin' and pf.prueba_hasta is null
      and ((pf.plan <> 'gratis' and (pf.vence is null or pf.vence >= (t0 at time zone 'America/Asuncion')::date))
           or (pf.es_alumno and pf.vence is not null and pf.vence >= (t0 at time zone 'America/Asuncion')::date))
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
    select sp.user_id, sp.dia, sp.pts, 'chat'
    from public.sala_puntos sp where sp.created_at >= t0 and sp.created_at < t1
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


revoke all on function public.ranking_mes_calc(text) from public, authenticated;
notify pgrst, 'reload schema';
