import type { Seccion } from "@/lib/terminos";

// Política de privacidad de ELITE FX. Si cambias el texto, cambia PRIVACIDAD_FECHA.
// Cuando se tenga el RUC de ELITE FX EAS, escríbelo aquí (aparece en el apartado 1).
export const PRIVACIDAD_RUC = "80173533-5";
export const PRIVACIDAD_FECHA = "7 de noviembre de 2026";

export const SECCIONES_PRIVACIDAD: Seccion[] = [
  {
    t: "1. Quién es responsable y a quién aplica",
    p: ["Esta política explica qué datos personales recopila ELITE FX a través de su plataforma de estudio (academia.elitefx.com.py), para qué los usa, con quién los comparte y qué derechos tiene cada persona. Aplica a todas las personas con una cuenta (gratuita, alumno, VIP o en prueba) y a quienes visitan las páginas públicas."],
    items: [
      "**Responsable del tratamiento:** ELITE FX EAS, Asunción, Paraguay." + (PRIVACIDAD_RUC ? " RUC: " + PRIVACIDAD_RUC + "." : ""),
      "**Contacto para temas de privacidad:** contacto@elitefx.com.py o WhatsApp +595 987 174 242.",
      "Esta política se lee junto con los Términos y condiciones.",
    ],
  },
  {
    t: "2. Qué datos recopilamos",
    tabla: [
      ["Registro", "Nombre completo, correo electrónico, teléfono, contraseña (se guarda cifrada, no podemos verla), foto de perfil."],
      ["Uso de la plataforma", "Progreso en lecciones, resultados de exámenes y certificados, preguntas y respuestas, publicaciones, comentarios, me gusta, puntos del ranking, referidos, visitas agendadas, aceptación de los términos."],
      ["Journal", "Operaciones que la persona carga o importa (por ejemplo, desde MetaTrader 5), su capital inicial y las métricas calculadas a partir de ellas."],
      ["Broker aliado", "El número de cuenta de trading que la persona registra para verificar que es cliente."],
      ["Membresía", "Tipo de acceso, fecha de vencimiento y, si corresponde, el código de invitación o de referido usado al registrarse."],
      ["Técnicos", "Datos de la sesión y del dispositivo (como dirección IP y navegador) que generan el acceso y la seguridad, y un registro de las acciones administrativas sobre las cuentas."],
    ],
    p2: ["No pedimos números de tarjeta ni claves de brokers o billeteras. Los datos que la persona escribe en publicaciones o preguntas son visibles según se explica en el apartado 4."],
  },
  {
    t: "3. Para qué usamos los datos",
    items: [
      "Crear y mantener la cuenta, verificar la identidad de quien entra y proteger la plataforma contra accesos indebidos.",
      "Dar acceso a los cursos, sesiones en vivo, comunidad, journal y demás funciones según el tipo de membresía.",
      "Administrar membresías, vencimientos, pagos informados y renovaciones.",
      "Calcular el ranking, los puntos, los referidos y pagar los premios.",
      "Emitir certificados verificables (la página pública de verificación solo muestra nombre, curso y fecha).",
      "Confirmar que la persona es cliente del broker aliado.",
      "Responder consultas y moderar la comunidad.",
      "Enviar los correos del servicio: confirmación, invitación, recuperación de contraseña y avisos de la cuenta.",
      "Mejorar la plataforma y cumplir obligaciones legales.",
    ],
    p2: ["No usamos los datos para tomar decisiones automatizadas que afecten a la persona fuera de las reglas públicas del ranking, ni para vender publicidad."],
  },
  {
    t: "4. Con quién se comparten los datos",
    p: ["ELITE FX no vende los datos personales. Se comparten solo en estos casos:"],
    items: [
      "**Otros miembros:** el nombre y la foto de perfil se muestran en la comunidad, en las preguntas de las lecciones y en el ranking. Lo que la persona publica es visible para quienes tengan acceso a esa sección.",
      "**Educadores y administradores:** acceden a los datos de las cuentas para gestionar las membresías, dar soporte, moderar y, en las mentorías, ver el journal en modo de solo lectura (apartado 5).",
      "**Proveedores que prestan el servicio:** Supabase (base de datos, acceso y archivos), Vercel (alojamiento de la plataforma), Resend (envío de correos), Cloudflare Turnstile (verificación anti-robots, si está activa), Vimeo y YouTube (reproducción de videos), Google Meet (sesiones en vivo) y TradingView (cinta de cotizaciones). Cada uno trata los datos para prestar su servicio y con sus propias políticas.",
      "**Broker aliado:** no le enviamos los datos de la persona. Para verificar la cuenta, comparamos el número que la persona registró con el listado de clientes que el broker nos entrega.",
      "**Autoridades:** cuando una ley o una orden judicial lo exija.",
    ],
  },
  {
    t: "5. Journal y acceso de los mentores",
    p: ["El journal es personal: solo la persona escribe, importa y borra sus operaciones. Para las mentorías, los administradores pueden abrirlo en modo de solo lectura, y solo ven los resultados como porcentaje sobre el capital inicial de la persona, sin montos en dinero. Cada consulta queda registrada con quién la hizo y cuándo. Los datos del journal no se publican ni se comparten con otros miembros."],
  },
  {
    t: "6. Cookies y almacenamiento en el navegador",
    p: ["La plataforma usa solo cookies y almacenamiento necesarios para funcionar; no usa cookies de publicidad."],
    items: [
      "**Sesión:** mantienen la cuenta iniciada y cierran la sesión tras 30 minutos sin actividad.",
      "**Preferencias:** tema claro u oscuro, monedas elegidas para las noticias y, en el caso de los administradores, el modo \"ver como alumno\".",
      "**Servicios de terceros:** los videos (Vimeo, YouTube) y la cinta de cotizaciones (TradingView) pueden colocar sus propias cookies al cargarse.",
    ],
    p2: ["Se pueden borrar desde la configuración del navegador; si se bloquean las necesarias, la plataforma no funcionará correctamente."],
  },
  {
    t: "7. Conservación, seguridad y transferencias internacionales",
    items: [
      "**Conservación:** guardamos los datos mientras la cuenta exista y el tiempo necesario después para cumplir obligaciones legales, resolver reclamos y mantener registros de seguridad. El plazo de conservación es de 5 años desde el cierre de la cuenta; pasado ese tiempo, los datos se eliminan o se anonimizan, salvo los que una ley nos obligue a guardar por más tiempo.",
      "**Seguridad:** las contraseñas se guardan cifradas, el acceso a los datos está limitado por reglas de seguridad en la base de datos (cada persona solo ve lo suyo, salvo lo que se muestra a la comunidad), las acciones administrativas quedan registradas y la sesión se cierra por inactividad. Ningún sistema es completamente infalible; si ocurre un incidente que afecte los datos, lo informaremos a las personas afectadas.",
      "**Transferencias internacionales:** algunos proveedores (apartado 4) procesan datos en servidores fuera de Paraguay. Los usamos solo para prestar el servicio y bajo sus condiciones de seguridad.",
    ],
  },
  {
    t: "8. Derechos de las personas",
    p: ["Cada persona puede, en cualquier momento:"],
    items: [
      "**Acceder** a los datos que tenemos sobre ella.",
      "**Corregirlos**: el nombre, el teléfono y la foto se editan desde el perfil; el correo, escribiéndonos para que lo cambiemos.",
      "**Pedir la eliminación** de su cuenta y sus datos. Podremos conservar lo que la ley o la seguridad nos obliguen a mantener, y eliminar la cuenta implica perder el acceso a la plataforma, a sus cursos y a su membresía sin reembolso.",
      "**Oponerse** a ciertos usos o pedir que se limite el tratamiento, cuando corresponda.",
    ],
    p2: ["Para ejercer estos derechos, escribe a contacto@elitefx.com.py desde el correo de la cuenta, o por WhatsApp al +595 987 174 242. Responderemos en un plazo de 15 días hábiles. Podemos pedir una verificación de identidad antes de entregar o borrar datos."],
  },
  {
    t: "9. Menores, cambios y contacto",
    items: [
      "**Menores:** la plataforma es solo para personas de 18 años o más. Si detectamos la cuenta de un menor, la cerraremos y eliminaremos sus datos.",
      "**Cambios:** podemos actualizar esta política. La versión vigente está siempre en la plataforma, con su fecha; si el cambio es importante, avisaremos dentro de la plataforma.",
      "**Contacto:** contacto@elitefx.com.py · WhatsApp +595 987 174 242.",
    ],
  },
];
