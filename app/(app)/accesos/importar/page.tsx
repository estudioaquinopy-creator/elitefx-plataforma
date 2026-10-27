import Link from "next/link";
import { notFound } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import ImportarAlumnos from "@/components/ImportarAlumnos";
import { importarLote } from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function Importar() {
  const p = await perfilActual();
  if (p.rol !== "admin") notFound();
  return (
    <>
      <Link href="/accesos" className="back">← Accesos</Link>
      <h1>Importar alumnos desde CSV</h1>
      <p className="sub">Crea muchas cuentas de una vez desde una planilla (Excel o Google Sheets guardada como CSV).</p>
      <ImportarAlumnos enviar={importarLote} />
    </>
  );
}
