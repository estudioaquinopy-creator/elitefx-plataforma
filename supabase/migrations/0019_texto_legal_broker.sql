-- 0019 · Texto legal del Broker recomendado (comisión de afiliado y riesgo de operar).
-- Solo reemplaza el texto si todavía es el marcador de posición o está vacío; si ya lo editaste a mano, no lo toca. Idempotente.
insert into public.ajustes (clave, valor) values ('aliados_legal', '')
on conflict (clave) do nothing;

update public.ajustes
set valor = 'Divulgación de afiliado: ELITE FX puede recibir una comisión del broker si abres tu cuenta mediante el enlace de esta página, sin ningún costo adicional para ti. Esa relación comercial puede influir en que lo recomendemos; por eso te invitamos a comparar y decidir con tu propio criterio. ELITE FX no es un broker, no recibe ni administra tu dinero y no está autorizada para brindar asesoría financiera personalizada. Advertencia de riesgo: operar en los mercados financieros (divisas, metales, CFD y otros instrumentos apalancados) conlleva un alto nivel de riesgo y puede no ser adecuado para todas las personas. Puedes perder parte o la totalidad del capital que depositas, y es posible perder más de lo esperado por el efecto del apalancamiento. Los resultados pasados no garantizan resultados futuros. Los contenidos de ELITE FX son exclusivamente educativos y no constituyen una recomendación de inversión ni una promesa de ganancias. Opera solo con dinero que puedas permitirte perder y verifica las condiciones, costos y la regulación del broker antes de abrir tu cuenta.'
where clave = 'aliados_legal'
  and (valor is null or btrim(valor) = '' or valor like 'Divulgación: [texto legal%');
