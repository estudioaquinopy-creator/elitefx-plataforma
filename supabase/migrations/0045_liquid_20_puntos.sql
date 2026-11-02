-- 0045 · Liquid: 20 puntos para los VIP y sin calendario de regalo para los gratuitos. Idempotente. Correr después de 0044.
-- · Estar en el CSV de Liquid significa que la cuenta existe, depositó y probablemente ya operó: al aprobarse suma 20 puntos (una vez, en el mes de la aprobación).
-- · Se desactiva el regalo de 7 + 7 días de calendario para miembros gratuitos (trigger liquid_bono_auto). Lo ya otorgado vence solo en su fecha.
insert into public.ajustes (clave, valor) values ('ranking_pts_liquid', '20')
  on conflict (clave) do update set valor = excluded.valor;
insert into public.ajustes (clave, valor) values ('ranking_pts_liquid_real', '0')
  on conflict (clave) do update set valor = excluded.valor;
drop trigger if exists liquid_bono_auto on public.liquid_cuentas;
