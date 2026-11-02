-- 0044 · Liquid: una sola regla de puntos. Idempotente. Correr después de 0043.
-- El CSV de Liquid solo trae cuentas con depósito u operaciones, así que estar en el CSV ya significa que la cuenta es real y activa.
-- Por eso al aprobarse la cuenta de Liquid de un miembro VIP se suman 10 puntos en el ranking (una vez, en el mes de la aprobación)
-- y desaparece el puntaje aparte "por operar en real" (queda en 0). Ambos valores siguen siendo editables en la tabla `ajustes`.
insert into public.ajustes (clave, valor) values ('ranking_pts_liquid', '10')
  on conflict (clave) do update set valor = excluded.valor;
insert into public.ajustes (clave, valor) values ('ranking_pts_liquid_real', '0')
  on conflict (clave) do update set valor = excluded.valor;
