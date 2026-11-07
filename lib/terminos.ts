// Texto de los Términos y condiciones de ELITE FX. Si cambias el texto, cambia TERMINOS_VERSION:
// a todas las personas les volverá a aparecer el aviso para aceptar la versión nueva.
export const TERMINOS_VERSION = "2026-11-07";
export const TERMINOS_FECHA = "7 de noviembre de 2026";
export const TERMINOS_CONTACTO = { correo: "contacto@elitefx.com.py", whatsapp: "+595 987 174 242" };

// Texto con **negrita** simple. `tabla` = filas [titulo, detalle].
export type Seccion = { t: string; p?: string[]; items?: string[]; tabla?: [string, string][]; p2?: string[]; items2?: string[] };

export const SECCIONES: Seccion[] = [
  {
    t: "1. Aviso importante: material educativo, sin recomendación de inversión",
    p: ["Todo el contenido de ELITE FX (cursos, tutoriales, sesiones en vivo, comunidad, journal, noticias, ranking y cualquier otro material) es exclusivamente educativo e informativo. En ningún momento constituye una recomendación de inversión, asesoramiento financiero, legal, contable o impositivo, ni una oferta o invitación a comprar o vender ningún instrumento financiero."],
    items: [
      "Operar en mercados financieros (divisas, metales, criptomonedas y otros instrumentos apalancados) implica un alto riesgo y puede resultar en la pérdida parcial o total del capital invertido.",
      "Los resultados pasados, los ejemplos, las capturas, las operaciones mostradas por educadores o por otros miembros y los resultados del ranking no garantizan resultados futuros.",
      "ELITE FX no garantiza ganancias ni promete rentabilidad alguna. Cada persona es la única responsable de sus decisiones y de sus operaciones.",
      "Antes de operar con dinero real, la persona debe evaluar su situación financiera, su tolerancia al riesgo y, si lo necesita, consultar a un asesor profesional independiente y habilitado.",
      "Se recomienda practicar en cuenta demo y operar solo con capital que pueda permitirse perder.",
    ],
  },
  {
    t: "2. Aceptación de los términos",
    p: ["Al registrarse, iniciar sesión o usar la plataforma de ELITE FX (academia.elitefx.com.py), la persona declara que leyó y acepta estos términos y el aviso del apartado 1. Si no está de acuerdo, no debe usar la plataforma."],
    items: [
      "Debe tener al menos 18 años cumplidos.",
      "Los datos que entrega al registrarse (nombre, correo, teléfono) deben ser verdaderos y estar actualizados.",
      "ELITE FX puede cambiar estos términos; el uso continuado de la plataforma después de un cambio implica que lo acepta (ver apartado 10).",
    ],
  },
  {
    t: "3. Cuentas y tipos de acceso",
    p: ["Cada persona tiene una cuenta personal e intransferible. Hay estos tipos de acceso:"],
    tabla: [
      ["Gratuito nuevo", "Cursos marcados como gratuitos, tutoriales, Broker recomendado y ver el ranking."],
      ["Gratuito alumno", "Todos los cursos y tutoriales; para quien fue miembro VIP y su membresía venció."],
      ["VIP", "Todo lo anterior, más calendario y sesiones en vivo, comunidad, journal, noticias, visitas a la oficina y ranking con premios, mientras la membresía esté vigente."],
      ["Prueba VIP", "Acceso VIP por un tiempo limitado, entregado con un enlace especial; al terminar vuelve a gratuito. No participa del ranking."],
    ],
    p2: ["Responsabilidades de la persona:"],
    items2: [
      "Mantener su contraseña en secreto y avisar si sospecha que alguien accedió a su cuenta.",
      "No compartir su cuenta ni sus accesos con otras personas. Una cuenta compartida puede ser suspendida sin reembolso.",
      "Subir una foto de perfil propia (es obligatoria para usar la plataforma).",
      "Por seguridad, la sesión se cierra tras 30 minutos sin actividad.",
    ],
  },
  {
    t: "4. Membresías, pagos y vencimiento",
    p: ["La membresía VIP da acceso a las funciones indicadas en el apartado 3 por el período contratado (1, 2 o 3 meses u otro plazo acordado). El acceso a los cursos se conserva de por vida para quien los adquirió; el calendario, las sesiones en vivo y las demás funciones VIP solo mientras la membresía esté vigente."],
    items: [
      "Al vencer la membresía, la cuenta pasa automáticamente a gratuito alumno. Renovar es posible en cualquier momento y el nuevo período se cuenta desde la fecha de renovación (o se suma al vigente).",
      "Los precios, medios de pago y promociones vigentes se informan por los canales oficiales (WhatsApp y el sitio) y pueden cambiar sin afectar lo ya pagado.",
      "Política de reembolsos: quien paga por primera vez el acceso completo (US$ 429) tiene 7 días desde la entrega del acceso para solicitar un reembolso, que se concede solo si ELITE FX lo considera justo tras revisar el caso. Por ejemplo: si la persona dice que la plataforma no le funciona, se revisa y se intenta resolver o se reembolsa si el fallo se confirma; si dice que no le gustan las clases pero ELITE FX comprueba que no vio ninguna o apenas una, no se considera un motivo suficiente. Esto no aplica a las renovaciones: las membresías VIP (nuevas o renovadas) no tienen reembolso una vez entregados los accesos.",
      "Una persona con acceso suspendido por incumplir estos términos no tiene derecho a reembolso.",
    ],
  },
  {
    t: "5. Contenido y propiedad intelectual",
    p: [
      "Los cursos, videos, sesiones en vivo, tutoriales, materiales, marcas, logos y demás contenidos de ELITE FX son propiedad de ELITE FX o de sus autores y están protegidos por las leyes de propiedad intelectual. La membresía otorga una licencia personal, limitada, no exclusiva e intransferible para verlos con fines de estudio propio.",
      "Está prohibido, sin autorización escrita de ELITE FX:",
    ],
    items: [
      "Descargar, grabar, copiar, reproducir o redistribuir videos, sesiones en vivo o materiales, incluso parcialmente.",
      "Compartir con personas que no sean miembros, o publicar en grupos, redes sociales u otras plataformas, enlaces, accesos o contenidos que sean propiedad de ELITE FX (por ejemplo, enlaces de videos, de sesiones en vivo, de lecciones o de la zona de miembros). Esto no incluye el enlace de referido personal de cada miembro VIP, que sí se puede compartir libremente para invitar a otras personas.",
      "Revender el contenido, o usarlo para enseñar o promocionar un servicio propio o de terceros.",
      "Intentar eludir las protecciones de la plataforma (restricción por dominio, sin descarga, etc.).",
    ],
    p2: ["El incumplimiento puede causar la suspensión inmediata de la cuenta y las acciones legales que correspondan."],
  },
  {
    t: "6. Comunidad y preguntas a los educadores",
    p: ["La comunidad y las preguntas debajo de cada lección son espacios de aprendizaje. Para mantenerlos útiles y seguros, la persona se compromete a:"],
    items: [
      "Tratar con respeto a miembros y educadores. No se permiten insultos, acoso, discriminación ni amenazas.",
      "No publicar spam, publicidad, enlaces de afiliados, señales pagas, ofertas de servicios ni pedidos de dinero.",
      "No dar \"señales\" o recomendaciones de inversión como si fueran garantía de resultado; las operaciones que se comparten son solo ejemplos educativos.",
      "No publicar datos personales ajenos ni contenido ilegal o que infrinja derechos de terceros.",
      "No presentar capturas o resultados falsos o editados.",
    ],
    p2: [
      "Las preguntas debajo de cada lección las ven los demás alumnos del curso y las responden los educadores. Las respuestas de los educadores tienen fines educativos y no son asesoramiento financiero personalizado.",
      "ELITE FX puede editar o eliminar publicaciones, ajustar puntos y suspender cuentas que incumplan estas reglas, sin previo aviso.",
    ],
  },
  {
    t: "7. Ranking, premios, referidos y pruebas VIP",
    items: [
      "**Ranking:** es mensual y cierra el último viernes de cada mes a las 23:59 (hora de Paraguay). Solo participan los miembros VIP. Los puntos se otorgan por participación de calidad según las reglas publicadas en la plataforma, que ELITE FX puede modificar.",
      "**Premios:** los premios del ranking se pagan por los montos que ELITE FX publique para cada mes, en la criptomoneda USDT por la red TRC20 (Tron), 1 a 2 días después del cierre de cada ranking. La persona debe indicar una dirección de billetera TRC20 válida y es responsable de que sea correcta: un pago enviado a la dirección indicada no se puede revertir. ELITE FX puede ajustar o descalificar puntos, y negar o retirar premios, ante spam, trampa, cuentas duplicadas o cualquier conducta que busque manipular el ranking. Para cobrar, la persona debe tener su cuenta activa y sus datos de contacto al día.",
      "**Referidos:** los miembros VIP pueden invitar con su código personal. Los puntos se otorgan según las reglas vigentes y solo por personas realmente nuevas; no suman quienes ya tenían cuenta ni quienes comparten teléfono u otros datos con el referente.",
      "**Prueba VIP:** es un beneficio temporal para personas nuevas que se registran con un enlace especial. Se pierde al vencer el plazo o ante un uso indebido, y puede limitarse por cupo o por fecha.",
    ],
    p2: ["Participar en el ranking no es un juego de azar ni implica ninguna recomendación de inversión."],
  },
  {
    t: "8. Journal, privacidad y datos personales",
    p: ["ELITE FX recopila los datos que la persona entrega (nombre, correo, teléfono, foto de perfil) y los que genera al usar la plataforma (progreso en los cursos, publicaciones, operaciones del journal, número de cuenta del broker aliado, puntos y visitas). Los usa para prestar el servicio, administrar las membresías, mantener la seguridad y comunicarse con la persona; no los vende a terceros."],
    items: [
      "**Journal:** es personal; solo la persona escribe, importa y borra sus operaciones. Para las mentorías, los administradores pueden verlo en modo de solo lectura y solo en porcentajes sobre el capital inicial, sin montos en dinero. Cada consulta queda registrada.",
      "**Datos visibles:** el nombre y la foto de perfil se muestran a otros miembros en la comunidad y en el ranking.",
      "**Terceros:** el servicio se apoya en proveedores como Supabase (base de datos y acceso), Vercel (alojamiento) y Resend (correos), que tratan los datos para prestarlo.",
      "**Derechos:** la persona puede pedir acceso, corrección o eliminación de sus datos escribiendo al contacto del apartado 10, salvo lo que ELITE FX deba conservar por obligación legal o seguridad.",
    ],
  },
  {
    t: "9. Broker aliado y enlaces de terceros",
    p: ["La plataforma puede mostrar un broker recomendado u otros enlaces de terceros. ELITE FX es independiente de esos terceros y no es responsable de sus servicios, condiciones, políticas, plataformas ni de lo que ocurra con el dinero que la persona deposite u opere con ellos."],
    items: [
      "Elegir un broker, abrir una cuenta y operar es una decisión personal y bajo riesgo propio. Mencionar un broker no es una recomendación de inversión.",
      "Divulgación: ELITE FX puede recibir una comisión o beneficio del broker aliado según los lotes operados por los clientes que abrieron su cuenta con el enlace de ELITE FX. No recibe comisión por el simple registro de una cuenta. Este vínculo comercial no cambia el costo para la persona.",
      "El número de cuenta que la persona registra en la plataforma solo se usa para verificar que es cliente del broker aliado y para los puntos del ranking; no da acceso a ninguna cuenta ni a fondos.",
    ],
  },
  {
    t: "10. Responsabilidad, suspensión, cambios, ley aplicable y contacto",
    items: [
      "**Limitación de responsabilidad:** en la medida que la ley lo permita, ELITE FX y sus educadores no responden por pérdidas, directas o indirectas, derivadas de operar en los mercados, de usar el contenido o de decisiones tomadas por la persona. Tampoco garantiza que la plataforma esté siempre disponible o libre de errores.",
      "**Suspensión:** ELITE FX puede suspender o cerrar una cuenta que incumpla estos términos, sin reembolso.",
      "**Cambios:** ELITE FX puede actualizar estos términos. La versión vigente está siempre en la plataforma, con su fecha de actualización.",
      "**Ley aplicable:** estos términos se rigen por las leyes de la República del Paraguay y las controversias se someten a los tribunales de Asunción.",
      "**Contacto:** correo contacto@elitefx.com.py y WhatsApp +595 987 174 242.",
    ],
  },
];
