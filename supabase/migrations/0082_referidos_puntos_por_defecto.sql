-- 0082 · Referidos: fija en la base de datos los puntos que la pantalla ya muestra (10 al activarse, +30 al pasar a VIP, máx. 10 por mes). Idempotente.
-- Motivo: si los ajustes no existen, la pantalla muestra 10 / 30 / 10 pero las funciones del ranking usan 5 / 10 / 10 por defecto.
-- A diferencia de la 0051, NO pisa un valor que ya esté guardado (si alguien lo cambió desde la página del ranking, se respeta).
insert into public.ajustes (clave, valor) values ('ranking_pts_ref', '10') on conflict (clave) do nothing;
insert into public.ajustes (clave, valor) values ('ranking_pts_ref_vip', '30') on conflict (clave) do nothing;
insert into public.ajustes (clave, valor) values ('ranking_ref_tope', '10') on conflict (clave) do nothing;
-- Para ver qué hay guardado:  select clave, valor from public.ajustes where clave in ('ranking_pts_ref', 'ranking_pts_ref_vip', 'ranking_ref_tope');
