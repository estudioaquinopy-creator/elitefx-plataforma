import { notFound } from "next/navigation";
import { perfilActual, esMiembro } from "@/lib/sesion";

const SECCIONES: Record<string, { titulo: string; miembros: boolean }> = {
  calendario: { titulo: "Calendario", miembros: true },
  tutoriales: { titulo: "Tutoriales", miembros: true },
  aliados: { titulo: "Aliados", miembros: false },
  comunidad: { titulo: "Comunidad", miembros: false },
  journal: { titulo: "Journal", miembros: false },
};

export default async function Seccion({ params }: { params: { seccion: string } }) {
  const s = SECCIONES[params.seccion];
  if (!s) notFound();
  const perfil = await perfilActual();
  const bloqueada = s.miembros && !esMiembro(perfil);
  return (
    <>
      <h1>{s.titulo}</h1>
      <section className="box">
        {bloqueada ? (
          <p className="mu">Esta sección es solo para miembros.</p>
        ) : (
          <p className="mu">Esta sección se construye en una próxima etapa.</p>
        )}
      </section>
    </>
  );
}
