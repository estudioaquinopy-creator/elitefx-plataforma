import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { cursoSinExamen } from "@/lib/examen";
import BotonImprimir from "@/components/BotonImprimir";

export const dynamic = "force-dynamic";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fechaLarga = (iso: string) => {
  const f = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Asuncion" }); // AAAA-MM-DD
  const [y, m, d] = f.split("-").map(Number);
  return d + " de " + MESES[m - 1] + " de " + y;
};

export default async function Certificado({ params }: { params: { id: string } }) {
  const perfil = await perfilActual();
  const sb = createClient();
  const { data: curso } = await sb.from("cursos").select("id, nombre").eq("id", params.id).single();
  if (!curso || cursoSinExamen(curso.nombre)) notFound();

  const atras = <Link href={"/cursos/" + params.id} className="back no-print">← {curso.nombre}</Link>;
  if (perfil.rol === "admin") {
    return <>{atras}<h1>Certificado</h1><section className="box"><p className="mu">Los certificados los obtienen los alumnos al aprobar el examen del curso.</p></section></>;
  }
  if (!perfil.nombre || !perfil.nombre.trim()) {
    return <>{atras}<h1>Certificado</h1><section className="box"><div className="tag">Falta tu nombre</div><p className="mu">Escribe tu nombre completo en tu perfil para que aparezca en el certificado.</p><Link className="btn sd" href="/perfil?t=editar">Editar perfil</Link></section></>;
  }

  // Emite el certificado si aprobó el examen (si ya lo tenía, devuelve el mismo código).
  const { data: cod, error } = await sb.rpc("emitir_certificado", { p_curso: params.id });
  if (error || !cod) {
    return <>{atras}<h1>Certificado</h1><section className="box"><div className="tag">Aún no disponible</div><p className="mu">{error && /examen/i.test(error.message) ? "Aprueba el examen de este curso para obtener tu certificado." : "Todavía no pudimos emitir tu certificado. Si ya aprobaste el examen, inténtalo de nuevo en unos minutos."}</p><Link className="btn sd" href={"/cursos/" + params.id}>Volver al curso</Link></section></>;
  }
  const { data: fila } = await sb.from("certificados").select("emitido_at").eq("user_id", perfil.id).eq("curso_id", params.id).maybeSingle();
  const emitido = (fila as { emitido_at: string } | null)?.emitido_at ?? new Date().toISOString();

  return (
    <>
      {atras}
      <h1 className="no-print">Tu certificado</h1>
      <p className="sub no-print">Descárgalo como PDF: en la ventana que se abre elige “Guardar como PDF” y, en Más ajustes, activa “Gráficos de fondo”. Usa hoja horizontal.</p>
      <BotonImprimir />
      <div className="cert-wrap">
        <div className="cert">
          <div className="cert-in">
            <img src="/logo-elitefx.png" alt="ELITE FX" className="cert-logo" />
            <div className="cert-k">Certificado de aprobación</div>
            <div className="cert-p">ELITE FX certifica que</div>
            <div className="cert-n">{perfil.nombre.trim()}</div>
            <div className="cert-p">completó todas las lecciones y aprobó el examen del</div>
            <div className="cert-c">{curso.nombre}</div>
            <div className="cert-f">Asunción, Paraguay · {fechaLarga(emitido)}</div>
            <div className="cert-pie">
              <span>Código de verificación: <b>{cod as string}</b></span>
              <span>Verifica en academia.elitefx.com.py/verificar</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
