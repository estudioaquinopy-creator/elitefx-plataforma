// Aviso de la cabecera de Inicio: cuenta regresiva hasta `hasta` y, cuando llega la hora, el anuncio de la sorpresa.
// Para anunciar otra cosa, cambia los textos y las fechas (con zona de Paraguay: -03:00).
export const SORPRESA = {
  texto: "¡Tenemos una sorpresa para la comunidad!",
  hasta: "2026-10-30T19:00:00-03:00", // viernes 30 de octubre de 2026, 19:00 (hora de Paraguay)
  etiqueta: "Viernes 30 de octubre · 19:00 h (hora de Paraguay)",
  // Anuncio que aparece cuando llega la hora.
  anuncio: {
    titulo: "¡Bajamos los precios!",
    precios: [
      { nombre: "Membresía VIP (mentoría)", antes: "US$ 19", ahora: "US$ 14,99", gs: "≈ Gs. 87.700" },
      { nombre: "Scanner Elite + Membresía VIP", antes: "US$ 69", ahora: "US$ 49,99", gs: "≈ Gs. 292.400" },
    ],
    nota: "Los valores en guaraníes son aproximados, según el cambio del día.",
    visibleDias: 7, // cuántos días queda visible el anuncio después de la hora
  },
};
