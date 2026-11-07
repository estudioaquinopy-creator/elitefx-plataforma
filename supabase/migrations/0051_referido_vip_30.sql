-- Referidos: 10 puntos por cada referido (máx. 10 personas al mes) + 30 puntos más cuando ese referido pasa a VIP.
-- Antes: 5 al activarse + 10 al pasar a VIP. Se guardan como ajustes (se pueden volver a cambiar desde la página del ranking).
-- Idempotente: se puede correr más de una vez.
insert into public.ajustes (clave, valor) values ('ranking_pts_ref', '10')
  on conflict (clave) do update set valor = excluded.valor;
insert into public.ajustes (clave, valor) values ('ranking_pts_ref_vip', '30')
  on conflict (clave) do update set valor = excluded.valor;
insert into public.ajustes (clave, valor) values ('ranking_ref_tope', '10')
  on conflict (clave) do update set valor = excluded.valor;
