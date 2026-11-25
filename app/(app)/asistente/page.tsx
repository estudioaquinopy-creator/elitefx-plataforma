import Link from "next/link";
import { perfilActual, vipVigente } from "@/lib/sesion";
import AsistenteCliente from "./AsistenteCliente";

export const dynamic = "force-dynamic";

// Asistente de IA: ayuda con trading, el broker, el ranking, los puntos y la plataforma.
// Solo lo ven administradores y miembros VIP (igual que Comunidad). La función ia-soporte lo vuelve a comprobar en el servidor.
export default async function Asistente() {
  const perfil = await perfilActual();
  const admin = perfil.rol === "admin"; // en modo alumno se comporta como alumno
  const puede = admin || (vipVigente(perfil) && perfil.plan !== "gratis");

  if (!puede) {
    return (
      <>
        <h1>Asistente</h1>
        <section className="box">
          <div className="tag">Solo miembros VIP</div>
          <p className="mu">El asistente de ELITE FX está disponible para los miembros VIP.</p>
        </section>
      </>
    );
  }

  return (
    <>
      {admin && (
        <p className="mu" style={{ marginTop: 0 }}>
          <Link href="/asistente/panel" style={{ color: "var(--ac)" }}>Abrir el panel de administración del asistente →</Link>
        </p>
      )}
      <AsistenteCliente />
    </>
  );
}
