import { ACCESO_COMPLETO, WHATSAPP_VENTAS } from "@/lib/sorpresa";

// Aviso fijo en Inicio para quien tiene solo acceso gratuito: no se puede cerrar.
export default function AvisoAccesoCompleto({ prueba }: { prueba?: string }) {
  const dias = prueba ? Math.max(1, Math.ceil((new Date(prueba).getTime() - Date.now()) / 86400000)) : 0;
  const href = "https://wa.me/" + WHATSAPP_VENTAS + "?text=" + encodeURIComponent(ACCESO_COMPLETO.mensaje);
  return (
    <section className="acceso-full" role="status">
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="tag" style={{ marginTop: 0 }}>{prueba ? "⏳ Tu prueba VIP termina en " + dias + (dias === 1 ? " día" : " días") : "🔒 Hoy tienes acceso gratuito"}</div>
        <h2 style={{ margin: "4px 0 6px" }}>Obtén el acceso completo</h2>
        <ul className="acceso-lista">
          <li><b>✅ De por vida:</b> {ACCESO_COMPLETO.deporVida}</li>
          <li><b>⏳ Por 3 meses:</b> {ACCESO_COMPLETO.tresMeses}</li>
        </ul>
        <small className="mu">{ACCESO_COMPLETO.despues}</small>
      </div>
      <div className="acceso-precio">
        <span className="acceso-antes">{ACCESO_COMPLETO.antes}</span>
        <b>{ACCESO_COMPLETO.precio}</b>
        <small>{ACCESO_COMPLETO.gs} · pago único</small>
        <a className="btn sd" href={href} target="_blank" rel="noopener noreferrer">Obtener acceso completo</a>
      </div>
    </section>
  );
}
