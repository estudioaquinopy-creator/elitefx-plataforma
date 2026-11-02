// Textos, precios y mensajes de WhatsApp del aviso de Inicio para miembros gratuitos (components/AvisoAccesoCompleto.tsx).
export const WHATSAPP_VENTAS = "595987174242"; // número al que escriben quienes quieren adquirir una membresía

// Aviso fijo para quien tiene acceso gratuito (pago único por el acceso completo).
export const ACCESO_COMPLETO = {
  antes: "US$ 1.100", // precio anterior (se muestra tachado: es una promoción)
  precio: "US$ 429",
  gs: "Gs. 2.499.000",
  deporVida: "Curso intermedio, Curso avanzado, Data de nivel 2 y todos los cursos.",
  tresMeses: "Scanner Elite, sesiones de trading en vivo (calendario), comunidad, journal, noticias y una visita por semana a las oficinas de ELITE FX para resolver tus dudas.",
  despues: "Después puedes mantener esos beneficios desde US$ 14,99 (Membresía VIP) o US$ 49,99 (Scanner Elite + Membresía VIP).",
  soloNuevos: "Pago único solo para personas totalmente nuevas, que nunca pasaron por la academia.",
  alumnos: {
    titulo: "Si ya eres alumno de la academia, solo pagas la membresía:",
    planes: [
      { nombre: "Membresía VIP", ahora: "US$ 14,99", gs: "Gs. 88.000", mensaje: "Hola, ya soy alumno de ELITE FX y quiero la Membresía VIP (US$ 14,99 / Gs. 88.000)." },
      { nombre: "Scanner Elite + Membresía VIP", ahora: "US$ 49,99", gs: "Gs. 293.000", mensaje: "Hola, ya soy alumno de ELITE FX y quiero Scanner Elite + Membresía VIP (US$ 49,99 / Gs. 293.000)." },
    ],
  },
  mensaje: "Hola, quiero obtener el acceso completo a ELITE FX (US$ 429 / Gs. 2.499.000).",
};
