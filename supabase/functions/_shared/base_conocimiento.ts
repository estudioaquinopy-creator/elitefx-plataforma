// =====================================================================
// BASE DE CONOCIMIENTO DEL ASISTENTE
// ---------------------------------------------------------------------
// Este archivo lo puede editar ELITE FX sin saber programar:
//   - Cambiar solo el texto entre las comillas invertidas  ` ... `
//   - No usar comillas invertidas dentro del texto.
//   - Después de editar, el desarrollador vuelve a desplegar las funciones.
//
// Las partes marcadas [COMPLETAR] las debe escribir ELITE FX con sus
// datos reales. Mientras digan [COMPLETAR], el asistente no inventa:
// da una orientación general y deriva al alumno al equipo.
// =====================================================================

// ---------------------------------------------------------------------
// 1. Datos de la academia y del broker aliado
// ---------------------------------------------------------------------
export const ACADEMIA_Y_BROKER = `
ACADEMIA
- ELITE FX es una academia de trading en Paraguay. Su contenido es educativo y no es recomendación de inversión.
- Cursos: básico, intermedio y avanzado. Al aprobar el examen de cada curso se obtiene un certificado.
- Contacto del equipo: el botón "Hablar con una persona del equipo" de este asistente. Para membresías, por WhatsApp al +595 987 174 242.

BROKERS ALIADOS
- ELITE FX trabaja con dos brokers, que se ven en la sección "Broker" de la plataforma (https://academia.elitefx.com.py/aliados):
  - Valor Markets: es el broker PRIORITARIO.
  - Liquid: es el broker RECOMENDADO.
- Se puede tener cuenta en los dos.

PRIMEROS PASOS CON EL BROKER (tal como figuran en la plataforma)
1. Abrir y verificar la cuenta con el enlace de ELITE FX.
2. Hacer el primer depósito.
3. Empezar a operar con la fórmula.

CÓMO CREAR LA CUENTA EN EL BROKER
- Entrar a la sección "Broker" de la plataforma y tocar el botón de abrir cuenta del broker elegido ("Abrir cuenta en Valor Markets" o "Abrir cuenta"). Hay que abrirla desde ese enlace de ELITE FX.
- Enlace de registro de Valor Markets: https://my.valormarkets.com/auth/register?partner_code=6357476
- En la sección "Broker" hay botones de video: "Cómo crear tu cuenta", "Cómo depositar" y "Cómo retirar" (también están en Cursos > Tutoriales, categoría "Broker"). Si un botón dice "próximamente", ese video todavía no está cargado.
- [COMPLETAR: qué documentos piden para verificar la identidad y cuánto tarda la verificación.]

CÓMO CARGAR DINERO (DEPOSITAR)
- Ver el botón de video "Cómo depositar" en la sección "Broker" (si dice "próximamente", todavía no está cargado).
- [COMPLETAR: métodos disponibles desde Paraguay, monto mínimo, comisiones, en cuánto tiempo se acredita y en qué moneda.]

CÓMO RETIRAR DINERO
- Ver el botón de video "Cómo retirar" en la sección "Broker" (si dice "próximamente", todavía no está cargado).
- [COMPLETAR: métodos, tiempos, comisiones y requisitos para retirar.]

CÓMO REGISTRAR LA CUENTA DE LIQUID EN ELITE FX (20 pts en el ranking)
- Es para quien abrió su cuenta de Liquid con el enlace de ELITE FX. Se hace en la sección "Broker" de la plataforma.
- Hay que escribir el NÚMERO DE LA CUENTA DE TRADING de Liquid (el que se ve dentro de la cuenta; no es el correo). Por ejemplo: 108451.
- Solo se puede registrar UNA cuenta de trading por mes.
- ELITE FX compara ese número con la lista de clientes de Liquid, que se actualiza cada día. La confirmación tarda en promedio unas 24 horas y queda en "Pendiente" hasta entonces.
- Si el número no se encuentra o se escribió mal, aparece "Rechazada" con una nota: se puede corregir y enviar de nuevo.
- Los 20 puntos se suman una sola vez, solo a miembros VIP, cuando se confirma que la cuenta hizo un depósito o ya opera en real.

PROBLEMAS FRECUENTES CON EL BROKER
- "Mi cuenta de Liquid sigue pendiente": la confirmación tarda unas 24 horas; si pasó más, usar "Hablar con una persona del equipo".
- [COMPLETAR: por ejemplo, "mi depósito no aparece", "me rechazaron el documento", "no puedo iniciar sesión en MetaTrader".]
`.trim();

// ---------------------------------------------------------------------
// 2. Conceptos de trading (educativos)
// ---------------------------------------------------------------------
export const CONCEPTOS_TRADING = `
SPREAD
Es la diferencia entre el precio de compra (ask) y el precio de venta (bid). Es el costo de abrir una operación.
Ejemplo: si el EUR/USD cotiza 1.0850 / 1.0852, el spread es de 2 pips. Apenas abres la operación, empiezas 2 pips en contra.
El spread suele ampliarse con poca liquidez, de madrugada o en noticias importantes.

LIQUIDEZ
Es la facilidad para comprar o vender un activo sin mover mucho su precio. Hay liquidez cuando hay muchos compradores y vendedores activos.
Ejemplo: el EUR/USD es muy líquido y suele tener spreads bajos. Un par exótico, menos líquido, suele tener spreads más altos.
Con poca liquidez hay spreads más amplios y más deslizamiento.

PIP
Es la unidad mínima habitual de movimiento de precio. En la mayoría de los pares es el cuarto decimal (0.0001). En los pares con yen es el segundo (0.01).
Ejemplo: si el EUR/USD pasa de 1.0850 a 1.0880, subió 30 pips.

LOTE
Es el tamaño de la operación. Lote estándar = 100.000 unidades, mini lote = 10.000, micro lote = 1.000.
Como referencia, en el EUR/USD con un lote estándar cada pip vale unos 10 USD; con un micro lote, unos 0,10 USD.

APALANCAMIENTO
Permite abrir operaciones más grandes que el dinero depositado. Multiplica tanto las ganancias como las PÉRDIDAS.
Ejemplo: con apalancamiento 1:100, con 100 USD se puede mover una posición de 10.000 USD. Un movimiento pequeño en contra puede consumir gran parte de la cuenta.

MARGEN
Es el dinero que el broker retiene como garantía mientras una operación está abierta. Si las pérdidas dejan el margen demasiado bajo, el broker puede avisar (margin call) o cerrar operaciones automáticamente (stop out).

STOP LOSS Y TAKE PROFIT
Stop loss: orden que cierra la operación automáticamente si el precio llega a un nivel de pérdida definido. Limita cuánto se puede perder.
Take profit: orden que cierra la operación al llegar a una ganancia definida.
Relación riesgo-beneficio: comparar lo que se arriesga con lo que se busca ganar. Ejemplo: arriesgar 20 pips para buscar 40 es una relación 1:2.

TIPOS DE ÓRDENES
- A mercado: se ejecuta al precio actual.
- Limitada (limit): para comprar más barato o vender más caro que el precio actual, esperando que el precio llegue.
- Stop: para comprar más caro o vender más barato que el precio actual, esperando una ruptura.

DESLIZAMIENTO (SLIPPAGE)
Es la diferencia entre el precio pedido y el precio al que realmente se ejecuta la orden. Es más común con noticias o con poca liquidez.

SWAP
Es un interés que se cobra o se paga por mantener una operación abierta de un día para otro. Depende del par y de la dirección de la operación.

VOLATILIDAD
Es cuánto y qué tan rápido se mueve el precio. Más volatilidad significa más oportunidades, pero también más riesgo.

SESIONES DEL MERCADO (hora de Paraguay, aproximada)
El mercado de divisas opera de lunes a viernes, las 24 horas, en tres sesiones principales: Asia, Londres y Nueva York.
La mayor liquidez suele darse cuando Londres y Nueva York están abiertas a la vez: más o menos de 10:00 a 13:00 de Paraguay entre noviembre y marzo, y de 9:00 a 12:00 el resto del año, porque Europa y Estados Unidos cambian al horario de verano.

CUENTA DEMO Y CUENTA REAL
Demo: dinero ficticio, ideal para practicar sin riesgo. Real: dinero propio, con resultados y emociones reales. Es recomendable practicar primero en demo.

GESTIÓN DEL RIESGO
Es decidir cuánto arriesgar en cada operación para que una racha de pérdidas no termine con la cuenta. Una práctica común es no arriesgar más de un pequeño porcentaje de la cuenta por operación (muchos usan 1 % o 2 %) y usar siempre stop loss.

ANÁLISIS TÉCNICO (bases)
- Soporte: zona donde el precio tiende a dejar de bajar. Resistencia: zona donde tiende a dejar de subir.
- Tendencia: dirección general del precio (alcista, bajista o lateral).
- Velas japonesas: muestran apertura, cierre, máximo y mínimo de cada período.

ANÁLISIS FUNDAMENTAL (bases)
Estudia noticias y datos económicos (tasas de interés, inflación, empleo) que mueven las monedas. Las noticias de alto impacto pueden generar movimientos bruscos y spreads amplios.

RIESGO
Operar en los mercados financieros implica riesgo de perder dinero. Nadie puede garantizar ganancias.
`.trim();

// ---------------------------------------------------------------------
// 3. Preguntas frecuentes de la plataforma
// ---------------------------------------------------------------------
export const PREGUNTAS_PLATAFORMA = `
¿Cómo gano puntos? Según el reglamento: publicando resultados y preguntas, respondiendo a otros, recibiendo me gusta y marcas de respuesta útil, con la foto de perfil, el registro de la cuenta del broker, los certificados y los referidos.
¿Cuándo cierra el mes del ranking? El último viernes de cada mes a las 23:59 (hora de Paraguay). Después el ranking del nuevo mes empieza de cero.
¿Por qué no sumé puntos? Las causas más comunes: se llegó al tope de 12 pts del día, la respuesta tenía menos de 20 caracteres, ya se había respondido esa publicación, era una respuesta en una publicación propia o la publicación se eliminó.
¿Puedo usar ChatGPT u otra IA para escribir? No. El reglamento prohíbe usar IA para escribir publicaciones y respuestas. Puede llevar a perder puntos o a la descalificación.
¿Cómo recupero mi contraseña? En la pantalla de ingreso, con el enlace "¿Olvidaste tu contraseña?" (https://academia.elitefx.com.py/recuperar).
¿Cómo invito a un referido? Solo los miembros VIP tienen código de referido. Está en la sección "Referidos" del menú, con el enlace de registro para compartir. Quien se registra con ese código queda como miembro gratuito y referido tuyo. Suma 10 puntos cuando se activa (completa su primera lección, máx. 10 al mes) y 30 puntos más si pasa a VIP.
¿Cómo rindo el examen de un curso? Solo tienen examen el Curso básico, el intermedio y el avanzado. Son 10 preguntas al azar y se aprueba con 7 correctas. Si no se aprueba, hay que esperar 10 minutos para volver a intentar. Al aprobar se desbloquea el curso siguiente y se emite el certificado (que suma 10 puntos en el ranking).
¿Cómo paso a VIP? Las membresías se adquieren escribiendo por WhatsApp al +595 987 174 242. En Inicio, el aviso "Obtén el acceso completo" muestra las opciones. No des precios: confirmarlos con el equipo.
`.trim();

/** Todo junto, para incluirlo en los manuales. */
export const BASE_CONOCIMIENTO = `
=== DATOS DE LA ACADEMIA Y DEL BROKER ===
${ACADEMIA_Y_BROKER}

=== CONCEPTOS DE TRADING (EDUCATIVO) ===
${CONCEPTOS_TRADING}

=== PREGUNTAS FRECUENTES DE LA PLATAFORMA ===
${PREGUNTAS_PLATAFORMA}
`.trim();
