-- 0015 · La sección "Aliados" pasa a ser "Broker recomendado": se elimina la tarjeta recomendada.
-- Idempotente.
delete from public.aliados where tipo = 'Tarjeta';

-- Enlace de "Abrir cuenta" del broker recomendado.
update public.aliados set url = 'https://my.liquidbrokers.com/auth/register?partner_code=6813172', boton = 'Abrir cuenta'
  where tipo = 'Broker';
