-- Referidos: solo suma puntos cuando el referido pasa a VIP (30 puntos por cada uno).
-- Antes: 5 al activarse (completar la primera lección) + 10 al pasar a VIP. Ahora: 0 + 30.
-- Se guardan como ajustes (se pueden volver a cambiar desde la página del ranking). Idempotente.
insert into public.ajustes (clave, valor) values ('ranking_pts_ref', '0')
  on conflict (clave) do update set valor = excluded.valor;
insert into public.ajustes (clave, valor) values ('ranking_pts_ref_vip', '30')
  on conflict (clave) do update set valor = excluded.valor;
