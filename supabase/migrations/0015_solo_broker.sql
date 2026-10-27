-- 0015 · La sección "Aliados" pasa a ser "Broker recomendado": se elimina la tarjeta recomendada.
-- Idempotente.
delete from public.aliados where tipo = 'Tarjeta';
