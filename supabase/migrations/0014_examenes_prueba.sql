-- 0014 · Preguntas de prueba para los exámenes del Curso intermedio y del Curso avanzado (20 cada uno).
-- Idempotente: no repite preguntas que ya existen. Puedes borrarlas o reemplazarlas desde Cursos → Examen.
-- Activa el examen de ambos cursos (10 preguntas al azar, 7 para aprobar).

-- Curso intermedio
insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es un nivel de soporte?$q$, $q$["Un precio al que el broker bloquea las operaciones", "Una zona donde el precio suele frenar su caída y rebotar", "El máximo histórico de un activo", "Una zona donde el precio siempre rompe hacia abajo"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es un nivel de soporte?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Cómo se define una tendencia alcista?$q$, $q$["Por máximos y mínimos cada vez más bajos", "Por un rango lateral prolongado", "Por máximos y mínimos cada vez más altos", "Por velas de color verde únicamente"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Cómo se define una tendencia alcista?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es una ruptura falsa (fakeout)?$q$, $q$["Cuando el precio rompe un nivel y rápidamente regresa al rango", "Una ruptura confirmada con mucho volumen", "Un error de la plataforma de trading", "Una orden que no se ejecuta"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es una ruptura falsa (fakeout)?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Un ratio riesgo-beneficio de 1:3 significa que…$q$, $q$["Arriesgas 3 para ganar 1", "Arriesgas 1 para intentar ganar 3", "Ganas 3 de cada 4 operaciones", "Operas con 3 lotes por cada operación"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Un ratio riesgo-beneficio de 1:3 significa que…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Con un ratio 1:2 y un 40% de operaciones ganadoras, el resultado a largo plazo es…$q$, $q$["Negativo", "Exactamente cero", "Imposible de calcular", "Positivo"]$q$::jsonb, 3
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Con un ratio 1:2 y un 40% de operaciones ganadoras, el resultado a largo plazo es…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Para qué sirve principalmente el stop loss?$q$, $q$["Para aumentar la ganancia de la operación", "Para limitar la pérdida máxima de la operación", "Para evitar pagar el spread", "Para abrir otra operación automáticamente"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Para qué sirve principalmente el stop loss?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Cuántas unidades de la divisa base representa un lote estándar?$q$, $q$["1.000", "10.000", "100.000", "1.000.000"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Cuántas unidades de la divisa base representa un lote estándar?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$En EURUSD, ¿cuánto vale aproximadamente un pip con un lote estándar?$q$, $q$["10 USD", "1 USD", "100 USD", "0,10 USD"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$En EURUSD, ¿cuánto vale aproximadamente un pip con un lote estándar?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué porcentaje del capital se recomienda arriesgar por operación?$q$, $q$["Entre 10% y 20%", "Entre 1% y 2%", "El 50%", "Todo el capital disponible"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué porcentaje del capital se recomienda arriesgar por operación?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Cuando un soporte importante se rompe, con frecuencia pasa a funcionar como…$q$, $q$["Soporte más fuerte", "Media móvil", "Resistencia", "Un nivel sin importancia"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Cuando un soporte importante se rompe, con frecuencia pasa a funcionar como…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Para qué se usa una media móvil?$q$, $q$["Para suavizar el precio y ayudar a identificar la tendencia", "Para predecir con exactitud el próximo máximo", "Para calcular el spread", "Para medir el swap"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Para qué se usa una media móvil?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$En el RSI, una lectura por encima de 70 suele interpretarse como…$q$, $q$["Sobreventa", "Zona de sobrecompra", "Falta de volatilidad", "Señal de compra segura"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$En el RSI, una lectura por encima de 70 suele interpretarse como…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Un martillo (hammer) que aparece tras una caída sugiere…$q$, $q$["Continuación bajista segura", "Que el mercado está cerrado", "Que el spread aumentó", "Un posible rechazo de los precios bajos y reversión alcista"]$q$::jsonb, 3
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Un martillo (hammer) que aparece tras una caída sugiere…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es una vela envolvente alcista?$q$, $q$["Una vela alcista cuyo cuerpo envuelve el cuerpo de la vela bajista anterior", "Una vela sin cuerpo", "Dos velas bajistas seguidas", "Una vela con mecha superior muy larga"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es una vela envolvente alcista?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Para qué sirve analizar un timeframe mayor antes de operar?$q$, $q$["Para entrar más rápido", "Para conocer el contexto y la tendencia general", "Para evitar usar stop loss", "Para reducir el spread"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Para qué sirve analizar un timeframe mayor antes de operar?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Cuándo suele haber mayor volatilidad en pares como EURUSD o GBPUSD?$q$, $q$["Durante el cierre del fin de semana", "En la sesión de Asia únicamente", "Al solaparse las sesiones de Londres y Nueva York", "Nunca cambia a lo largo del día"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Cuándo suele haber mayor volatilidad en pares como EURUSD o GBPUSD?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Una mecha superior muy larga en una vela indica…$q$, $q$["Rechazo de precios altos y presión vendedora", "Fuerte compra sostenida", "Que no hubo operaciones", "Un error de datos"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Una mecha superior muy larga en una vela indica…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Por qué conviene tener cuidado al operar durante noticias de alto impacto?$q$, $q$["Porque el mercado se cierra", "Porque no se pueden usar stops", "Porque aumentan la volatilidad, el spread y el slippage", "Porque el swap se duplica"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Por qué conviene tener cuidado al operar durante noticias de alto impacto?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Una orden pendiente Buy Limit sirve para…$q$, $q$["Comprar a mercado ahora mismo", "Comprar a un precio inferior al actual", "Vender a un precio inferior al actual", "Cerrar todas las operaciones abiertas"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Una orden pendiente Buy Limit sirve para…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es el sobreoperar (overtrading)?$q$, $q$["Operar solo con setups de alta probabilidad", "Operar con lotes mínimos", "Esperar semanas sin operar", "Operar en exceso, por impulso y sin una señal válida"]$q$::jsonb, 3
  from public.cursos c
  where c.nombre ilike 'curso intermedio%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es el sobreoperar (overtrading)?$q$);

-- Curso avanzado
insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué significa tener una expectativa matemática positiva?$q$, $q$["Que todas las operaciones terminan en ganancia", "Que, a largo plazo, el promedio esperado por operación es mayor que cero", "Que se opera con el mayor lote posible", "Que la estrategia nunca tiene rachas perdedoras"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué significa tener una expectativa matemática positiva?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es el drawdown?$q$, $q$["La ganancia máxima de un mes", "El spread promedio del broker", "La caída del capital desde un máximo hasta un mínimo posterior", "El costo de mantener una posición abierta"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es el drawdown?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Si una cuenta pierde el 50%, ¿cuánto necesita ganar para volver al capital inicial?$q$, $q$["50%", "75%", "25%", "100%"]$q$::jsonb, 3
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Si una cuenta pierde el 50%, ¿cuánto necesita ganar para volver al capital inicial?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Operar EURUSD y GBPUSD en la misma dirección al mismo tiempo, sabiendo que están muy correlacionados, equivale a…$q$, $q$["Duplicar la exposición al mismo riesgo", "Diversificar el riesgo por completo", "Reducir el riesgo a la mitad", "Eliminar el riesgo del dólar"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Operar EURUSD y GBPUSD en la misma dirección al mismo tiempo, sabiendo que están muy correlacionados, equivale a…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué busca el análisis multi-timeframe?$q$, $q$["Abrir muchas operaciones a la vez", "Usar solo el gráfico de 1 minuto", "Alinear la señal del timeframe menor con el contexto del mayor", "Ignorar la tendencia"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué busca el análisis multi-timeframe?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Las zonas donde se acumulan stops (sobre máximos o bajo mínimos evidentes) suelen llamarse…$q$, $q$["Zonas de swap", "Zonas de liquidez", "Zonas de margen", "Zonas de comisión"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Las zonas donde se acumulan stops (sobre máximos o bajo mínimos evidentes) suelen llamarse…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es una barrida de liquidez (liquidity sweep)?$q$, $q$["Cuando el precio supera un máximo o mínimo previo para tomar órdenes y luego revierte", "Una orden de compra de gran tamaño ejecutada de golpe", "El cierre automático de la plataforma", "Una caída del spread a cero"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es una barrida de liquidez (liquidity sweep)?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Una divergencia alcista entre precio y RSI ocurre cuando el precio hace un mínimo más bajo y el RSI…$q$, $q$["Hace un máximo más alto", "No se mueve en absoluto", "Hace un mínimo más bajo", "Hace un mínimo más alto"]$q$::jsonb, 3
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Una divergencia alcista entre precio y RSI ocurre cuando el precio hace un mínimo más bajo y el RSI…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué mide el indicador ATR?$q$, $q$["La tendencia futura", "La volatilidad promedio (rango) del precio", "El volumen comprador", "El número de operaciones abiertas"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué mide el indicador ATR?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Cómo puede usarse el ATR en la gestión del riesgo?$q$, $q$["Para elegir el broker", "Para saber cuándo abre cada sesión", "Para dimensionar el stop loss según la volatilidad actual", "Para calcular el swap"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Cómo puede usarse el ATR en la gestión del riesgo?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$En un footprint (por ejemplo en ATAS), el delta es…$q$, $q$["La diferencia entre el volumen de compras y ventas agresivas", "El precio de apertura de la vela", "El spread medio del día", "La suma de comisiones pagadas"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$En un footprint (por ejemplo en ATAS), el delta es…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Un volumen alto acompañado de rechazo en un nivel clave sugiere…$q$, $q$["Que el nivel dejó de ser relevante", "Que no hay participantes en el mercado", "Que el broker está cerrado", "Participación fuerte defendiendo ese nivel"]$q$::jsonb, 3
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Un volumen alto acompañado de rechazo en un nivel clave sugiere…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué ocurre cuando el nivel de margen cae por debajo del nivel de Stop Out del broker?$q$, $q$["Se duplica el apalancamiento", "El broker puede cerrar posiciones automáticamente", "Se anula el swap", "Se aumenta el balance"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué ocurre cuando el nivel de margen cae por debajo del nivel de Stop Out del broker?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$El FOMO en trading es…$q$, $q$["Una estrategia de cobertura", "Un tipo de orden pendiente", "El miedo a perderse un movimiento, que lleva a entrar tarde o sin plan", "Un indicador de volumen"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$El FOMO en trading es…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es el revenge trading?$q$, $q$["Operar para recuperar de forma impulsiva una pérdida reciente", "Seguir el plan sin emociones", "Cerrar todas las operaciones el viernes", "Operar solo en demo"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es el revenge trading?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Para qué sirve llevar un journal de trading?$q$, $q$["Para presumir resultados", "Para evitar pagar impuestos", "Para sustituir el análisis técnico", "Para registrar y analizar las operaciones y detectar patrones que mejorar"]$q$::jsonb, 3
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Para qué sirve llevar un journal de trading?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Cuenta de 10.000 USD, riesgo del 1% y stop de 50 pips en EURUSD (pip ≈ 10 USD por lote). ¿Qué tamaño de posición corresponde?$q$, $q$["1,0 lote", "0,2 lotes", "0,02 lotes", "2,0 lotes"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Cuenta de 10.000 USD, riesgo del 1% y stop de 50 pips en EURUSD (pip ≈ 10 USD por lote). ¿Qué tamaño de posición corresponde?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$Mover el stop loss a breakeven tiene como objetivo…$q$, $q$["Aumentar el riesgo de la operación", "Cerrar la operación de inmediato", "Proteger el capital cuando la operación avanzó a favor", "Eliminar el take profit"]$q$::jsonb, 2
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$Mover el stop loss a breakeven tiene como objetivo…$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Qué es el slippage?$q$, $q$["La diferencia entre el precio esperado y el precio real de ejecución", "La comisión mensual del broker", "El tiempo de apertura de una sesión", "El volumen mínimo permitido"]$q$::jsonb, 0
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Qué es el slippage?$q$);

insert into public.examen_banco (curso_id, texto, opciones, correcta)
  select c.id, $q$¿Cuál es el principal valor de un backtest?$q$, $q$["Garantizar ganancias futuras", "Evaluar una estrategia con datos históricos antes de usarla en real", "Reemplazar la gestión del riesgo", "Eliminar la necesidad de un journal"]$q$::jsonb, 1
  from public.cursos c
  where c.nombre ilike 'curso avanzado%'
    and not exists (select 1 from public.examen_banco b where b.curso_id = c.id and b.texto = $q$¿Cuál es el principal valor de un backtest?$q$);

insert into public.examen_config (curso_id, activo)
  select id, true from public.cursos where nombre ilike 'curso intermedio%' or nombre ilike 'curso avanzado%'
  on conflict (curso_id) do update set activo = true;
