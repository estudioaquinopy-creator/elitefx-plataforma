import { ACCESO_COMPLETO, WHATSAPP_VENTAS } from "@/lib/sorpresa";

// Aviso fijo en Inicio para quien tiene solo acceso gratuito: no se puede cerrar.
export default function AvisoAccesoCompleto() {
  const href = "https://wa.me/" + WHATSAPP_VENTAS + "?text=" + encodeURIComponent(ACCESO_COMPLETO.mensaje);
  return (
    <section className="acceso-full" role="status">
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="tag" style={{ marginTop: 0 }}>🔒 Hoy tienes acceso gratuito</div>
        <h2 style={{ margin: "4px 0 6px" }}>Obtén el acceso completo</h2>
        <p style={{ margin: 0 }}>{ACCESO_COMPLETO.incluye}</p>
      </div>
      <div className="acceso-precio">
        <b>{ACCESO_COMPLETO.precio}</b>
        <small>{ACCESO_COMPLETO.gs} · pago único</small>
        <a className="btn sd" href={href} target="_blank" rel="noopener noreferrer">Obtener acceso completo</a>
      </div>
    </section>
  );
}
