// Aviso de la cabecera de Inicio: cuenta regresiva hasta `hasta` y, cuando llega la hora, el anuncio de la sorpresa.
// Para anunciar otra cosa, cambia los textos y las fechas (con zona de Paraguay: -03:00).
export const WHATSAPP_VENTAS = "595987174242"; // número al que escriben quienes quieren adquirir una membresía

// Aviso fijo para quien tiene acceso gratuito (pago único por el acceso completo).
export const ACCESO_COMPLETO = {
  precio: "US$ 429",
  gs: "Gs. 2.499.000",
  incluye: "Cursos intermedio y avanzado, Data de nivel 2, sesiones en vivo, comunidad, journal y noticias.",
  mensaje: "Hola, quiero obtener el acceso completo a ELITE FX (US$ 429 / Gs. 2.499.000).",
};

export const SORPRESA = {
  texto: "¡Tenemos una sorpresa para la comunidad!",
  hasta: "2026-10-30T19:00:00-03:00", // viernes 30 de octubre de 2026, 19:00 (hora de Paraguay)
  etiqueta: "Viernes 30 de octubre · 19:00 h (hora de Paraguay)",
  // Anuncio que aparece cuando llega la hora.
  anuncio: {
    titulo: "¡Bajamos los precios!",
    motivo: "Con nuestra nueva plataforma tenemos menos costos operativos para mantenerla, y ese beneficio lo trasladamos a ti.",
    precios: [
      { nombre: "Membresía VIP", antes: "US$ 19", ahora: "US$ 14,99", gs: "Gs. 88.000", mensaje: "Hola, quiero adquirir la Membresía VIP de ELITE FX (US$ 14,99 / Gs. 88.000)." },
      { nombre: "Scanner Elite + Membresía VIP", antes: "US$ 69", ahora: "US$ 49,99", gs: "Gs. 293.000", mensaje: "Hola, quiero adquirir Scanner Elite + Membresía VIP de ELITE FX (US$ 49,99 / Gs. 293.000)." },
    ],
    nota: "", // texto pequeño opcional debajo de las tarjetas (vacío = no se muestra)
    visibleDias: 7, // cuántos días queda visible el anuncio después de la hora
  },
};
