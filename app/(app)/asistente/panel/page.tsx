import Link from "next/link";
import { perfilActual } from "@/lib/sesion";
import PanelCliente from "./PanelCliente";

export const dynamic = "force-dynamic";

// Panel de administración del asistente: alertas del ranking, revisión de textos y consultas derivadas.
// Solo administradores (la función ia-panel también lo comprueba en el servidor).
export default async function PanelAsistente() {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") {
    return (
      <>
        <h1>Panel del asistente</h1>
        <section className="box"><p className="mu">Esta página es solo para administradores.</p></section>
      </>
    );
  }
  return (
    <>
      <p className="mu" style={{ marginTop: 0 }}><Link href="/asistente" style={{ color: "var(--ac)" }}>← Volver al asistente</Link></p>
      <PanelCliente />
    </>
  );
}
