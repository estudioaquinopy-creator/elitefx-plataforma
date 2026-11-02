import { ACCESO_COMPLETO, WHATSAPP_VENTAS } from "@/lib/sorpresa";

const wa = (mensaje: string) => "https://wa.me/" + WHATSAPP_VENTAS + "?text=" + encodeURIComponent(mensaje);

// Único aviso de Inicio para miembros gratuitos (y para quien está en prueba VIP): no se puede cerrar.
// Dos desplegables: "Ya soy alumno" (solo paga la membresía) y "Soy nuevo" (acceso completo, pago único).
export default function AvisoAccesoCompleto({ prueba }: { prueba?: string }) {
  const dias = prueba ? Math.max(1, Math.ceil((new Date(prueba).getTime() - Date.now()) / 86400000)) : 0;
  return (
    <section className="acceso-full" role="status">
      <div className="tag" style={{ marginTop: 0 }}>{prueba ? "⏳ Tu prueba VIP termina en " + dias + (dias === 1 ? " día" : " días") : "🔒 Hoy tienes acceso gratuito"}</div>
      <h2 style={{ margin: "4px 0 12px" }}>Obtén el acceso completo</h2>
      <div className="acceso-ops">
        <details className="acceso-op" name="acceso">
          <summary>🎓 Ya soy alumno</summary>
          <div className="acceso-cuerpo">
            <p style={{ margin: "0 0 10px" }}>{ACCESO_COMPLETO.alumnos.titulo}</p>
            <div className="acceso-planes">
              {ACCESO_COMPLETO.alumnos.planes.map((p) => (
                <div key={p.nombre} className="acceso-plan">
                  <b>{p.nombre}</b>
                  <span className="acceso-pr">{p.ahora}</span>
                  <small className="mu">{p.gs}</small>
                  <a className="btn sd s" href={wa(p.mensaje)} target="_blank" rel="noopener noreferrer">Adquirir membresía</a>
                </div>
              ))}
            </div>
          </div>
        </details>
        <details className="acceso-op" name="acceso">
          <summary>✨ Soy nuevo</summary>
          <div className="acceso-cuerpo">
            <div className="acceso-precio">
              <span className="acceso-antes">{ACCESO_COMPLETO.antes}</span>
              <b>{ACCESO_COMPLETO.precio}</b>
              <small>{ACCESO_COMPLETO.gs} · pago único</small>
              <small className="acceso-nota">{ACCESO_COMPLETO.soloNuevos}</small>
            </div>
            <ul className="acceso-lista">
              <li><b>✅ De por vida:</b> {ACCESO_COMPLETO.deporVida}</li>
              <li><b>⏳ Por 3 meses:</b> {ACCESO_COMPLETO.tresMeses}</li>
            </ul>
            <small className="mu" style={{ display: "block", marginBottom: 12 }}>{ACCESO_COMPLETO.despues}</small>
            <a className="btn sd" href={wa(ACCESO_COMPLETO.mensaje)} target="_blank" rel="noopener noreferrer">Obtener acceso completo</a>
          </div>
        </details>
      </div>
    </section>
  );
}
