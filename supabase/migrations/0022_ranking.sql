-- 0022 · Ranking mensual de la comunidad (solo miembros VIP; premio en USDT que defines tú). Idempotente.

-- Respuestas marcadas como útiles (por quien preguntó o por el administrador).
alter table public.comentarios add column if not exists util boolean not null default false;

create or replace function public.marcar_comentario_util(p_id uuid, p_valor boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_dueno uuid; v_autor uuid; v_post uuid; v_n int;
begin
  select p.user_id, c.user_id, c.post_id into v_dueno, v_autor, v_post
    from public.comentarios c join public.publicaciones p on p.id = c.post_id where c.id = p_id;
  if not found then raise exception 'Respuesta no encontrada.'; end if;
  if not (public.es_admin() or v_dueno = auth.uid()) then raise exception 'Solo quien hizo la pregunta o el administrador puede marcarla como útil.'; end if;
  if v_autor = v_dueno and not public.es_admin() then raise exception 'No puedes marcar tu propia respuesta.'; end if;
  if p_valor then
    select count(*) into v_n from public.comentarios where post_id = v_post and util and id <> p_id;
    if v_n >= 2 then raise exception 'Cada publicación puede tener como máximo 2 respuestas útiles.'; end if;
  end if;
  update public.comentarios set util = p_valor where id = p_id;
end $$;
grant execute on function public.marcar_comentario_util(uuid, boolean) to authenticated;

-- Ajustes manuales de puntos del administrador (suma o resta, con motivo).
create table if not exists public.ranking_ajustes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  mes text not null,
  user_id uuid not null references public.perfiles(id) on delete cascade,
  puntos int not null,
  motivo text not null default '',
  admin_id uuid references public.perfiles(id) on delete set null
);
alter table public.ranking_ajustes enable row level security;
drop policy if exists "ver ajustes ranking" on public.ranking_ajustes;
create policy "ver ajustes ranking" on public.ranking_ajustes for select to authenticated using (public.es_admin() or user_id = auth.uid());
drop policy if exists "admin ajusta ranking" on public.ranking_ajustes;
create policy "admin ajusta ranking" on public.ranking_ajustes for all to authenticated using (public.es_admin()) with check (public.es_admin());

-- Ranking de un mes (formato AAAA-MM, horario de Paraguay).
-- Puntos: resultado publicado 3 (+1 si lleva imagen) · pregunta 2 · respuesta de 20+ caracteres 1 · respuesta marcada útil 5 · me gusta recibido 1 (máx. 10 por publicación).
-- Tope de 12 puntos por día (sin contar las respuestas útiles). Participan solo miembros VIP; el administrador no entra al ranking.
-- Se ignoran publicaciones muy cortas, respuestas a la propia publicación y me gusta propios.
create or replace function public.ranking_mes(p_mes text)
returns table(user_id uuid, nombre text, puntos int, resultados int, preguntas int, respuestas int, utiles int, likes int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare t0 timestamptz; t1 timestamptz;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Mes no válido.'; end if;
  t0 := ((p_mes || '-01')::date)::timestamp at time zone 'America/Asuncion';
  t1 := ((p_mes || '-01')::date + interval '1 month')::timestamp at time zone 'America/Asuncion';
  return query
  with el as (
    select pf.id as uid, coalesce(nullif(btrim(pf.nombre), ''), split_part(pf.email, '@', 1)) as nom
    from public.perfiles pf where pf.plan <> 'gratis' and pf.rol <> 'admin'
  ),
  ev as (
    select p.user_id as uid, (p.created_at at time zone 'America/Asuncion')::date as d,
           case when p.canal = 'resultados' then 3 + (case when p.imagen_url is not null then 1 else 0 end) else 2 end as pts,
           p.canal::text as tipo
    from public.publicaciones p
    where p.canal in ('preguntas', 'resultados') and p.created_at >= t0 and p.created_at < t1
      and (length(btrim(p.cuerpo)) + length(btrim(p.titulo)) >= 15 or p.imagen_url is not null)
    union all
    select c.user_id, (c.created_at at time zone 'America/Asuncion')::date, 1, 'respuesta'
    from public.comentarios c join public.publicaciones p on p.id = c.post_id
    where c.created_at >= t0 and c.created_at < t1 and length(btrim(c.cuerpo)) >= 20 and c.user_id <> p.user_id
    union all
    select c.user_id, (c.created_at at time zone 'America/Asuncion')::date, 5, 'util'
    from public.comentarios c join public.publicaciones p on p.id = c.post_id
    where c.util and c.created_at >= t0 and c.created_at < t1 and c.user_id <> p.user_id
    union all
    select p.user_id, (l.created_at at time zone 'America/Asuncion')::date, 1, 'like'
    from (select l2.post_id, l2.user_id, l2.created_at, row_number() over (partition by l2.post_id order by l2.created_at) as rn from public.likes l2) l
    join public.publicaciones p on p.id = l.post_id
    where l.rn <= 10 and l.user_id <> p.user_id and p.canal in ('preguntas', 'resultados') and l.created_at >= t0 and l.created_at < t1
  ),
  dia as (
    select e.uid, e.d,
      least(coalesce(sum(e.pts) filter (where e.tipo <> 'util'), 0), 12) + coalesce(sum(e.pts) filter (where e.tipo = 'util'), 0) as pts
    from ev e group by e.uid, e.d
  ),
  tot as (select d.uid, sum(d.pts)::int as pts from dia d group by d.uid),
  cnt as (
    select e.uid,
      (count(*) filter (where e.tipo = 'resultados'))::int as r, (count(*) filter (where e.tipo = 'preguntas'))::int as q,
      (count(*) filter (where e.tipo = 'respuesta'))::int as a, (count(*) filter (where e.tipo = 'util'))::int as u,
      (count(*) filter (where e.tipo = 'like'))::int as l
    from ev e group by e.uid
  ),
  adj as (select a.user_id as uid, sum(a.puntos)::int as pts from public.ranking_ajustes a where a.mes = p_mes group by a.user_id)
  select el.uid, el.nom, (coalesce(tot.pts, 0) + coalesce(adj.pts, 0))::int,
         coalesce(cnt.r, 0), coalesce(cnt.q, 0), coalesce(cnt.a, 0), coalesce(cnt.u, 0), coalesce(cnt.l, 0)
  from el
  left join tot on tot.uid = el.uid
  left join cnt on cnt.uid = el.uid
  left join adj on adj.uid = el.uid
  where coalesce(tot.pts, 0) + coalesce(adj.pts, 0) > 0
  order by 3 desc, 2;
end $$;
grant execute on function public.ranking_mes(text) to authenticated;
