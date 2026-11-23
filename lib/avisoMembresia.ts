// Mensaje y enlace de WhatsApp para avisar a una persona de su membresía (vencida o por vencer).
export function textoAvisoMembresia(nombre: string, clave: string, vence: string | null): string {
  const f = vence ? new Date(vence + "T00:00:00").toLocaleDateString("es-PY") : "";
  return clave === "vencido"
    ? "Hola " + nombre + ", tu acceso al calendario de ELITE FX venció el " + f + ". ¿Quieres renovarlo?"
    : "Hola " + nombre + ", tu acceso al calendario de ELITE FX vence el " + f + ". ¿Quieres renovarlo?";
}

export function enlaceWhatsApp(telefono: string | null | undefined, texto: string): string {
  const tel = String(telefono ?? "").replace(/\D/g, "");
  return tel ? "https://wa.me/" + tel + "?text=" + encodeURIComponent(texto) : "";
}
