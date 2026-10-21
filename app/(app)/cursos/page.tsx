import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import { cambiarPortadaCurso, crearCurso } from "./actions";
import { portadaDe } from "@/lib/portadas";
import { bloqueosExamen } from "@/lib/examen";

export const dynamic = "force-dynamic";

type Curso = { id: string; nombre: string; descripcion: string; grupo: string; orden: number; gratis: boolean; portada_url: string | null };

export default async function Cursos({ searchParams }: { searchParams: { error?: string } }) {
  const perfil = await perfilActual();
  const supabase = createClient();
  const { data: cursosRaw } = await supabase.from("cursos").select("*").order("orden");
  const cursos = (cursosRaw ?? []) as Curso[];
  const { data: lecs } = await supabase.from("lecciones").select("id, curso_id");
  const { data: prog } = await supabase.from("progreso").select("leccion_id").eq("user_id", perfil.id);
  const hechas = new Set((prog ?? []).map((p: { leccion_id: string }) => p.leccion_id));
  const lista = (lecs ?? []) as { id: string; curso_id: string }[];
  const miembro = (await permisos(perfil)).cursos;
  const admin = perfil.rol === "admin";
  const bloqueos = admin ? {} : await bloqueosExamen(supabase, perfil.id, cursos);

  function tarjeta(c: Curso) {
    const total = lista.filter((l) => l.curso_id === c.id).length;
    const ok = lista.filter((l) => l.curso_id === c.id && hechas.has(l.id)).length;
    const pct = total ? Math.round((ok / total) * 100) : 0;
    const faltaExamen = bloqueos[c.id];
    const bloqueado = !(admin || c.gratis || miembro) || !!faltaExamen;
    const img = c.portada_url || portadaDe(c.nombre);
    const estilo = img ? { backgroundImage: "url(" + img + ")" } : undefined;
    const info = (
      <div className="cb">
        <b>{c.nombre}</b>
        <small className="mu">{c.descripcion}</small>
        {bloqueado ? (
          <span className="pill">{faltaExamen ? "Aprueba el examen de " + faltaExamen.nombre : "Miembros"}</span>
        ) : (
          <>
            <div className="bar"><i style={{ width: pct + "%" }} /></div>
            <small className="mu">{ok}/{total} lecciones</small>
          </>
        )}
      </div>
    );
    if (bloqueado) {
      return (
        <div key={c.id} className="crs lk">
          <div className="cov" style={estilo} />
          {info}
        </div>
      );
    }
    return (
      <div key={c.id} className="crs">
        <div className="covw">
          <Link href={"/cursos/" + c.id} className="tlink"><div className="cov" style={estilo} /></Link>
          {admin && (
            <div className="cvb cvc">
              <form action={cambiarPortadaCurso} encType="multipart/form-data" className="cvf">
                <input type="hidden" name="id" value={c.id} />
                <input type="file" name="portada" accept="image/*" required />
                <button>{c.portada_url ? "Cambiar" : "Subir"}</button>
              </form>
              {c.portada_url && (
                <form action={cambiarPortadaCurso}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="quitar" value="1" />
                  <button>Imagen por defecto</button>
                </form>
              )}
            </div>
          )}
        </div>
        <Link href={"/cursos/" + c.id} className="tlink">{info}</Link>
      </div>
    );
  }

  return (
    <>
      <h1>Cursos</h1>
      <p className="sub">Todo tu contenido, con progreso por alumno.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {admin && (
        <details className="box adm">
          <summary>+ Nuevo curso</summary>
          <form action={crearCurso} className="fm" encType="multipart/form-data">
            <label>Nombre<input name="nombre" required /></label>
            <label>Descripción<input name="descripcion" /></label>
            <label>Imagen de portada (archivo)<input type="file" name="portada" accept="image/*" /></label>
            <label>Grupo
              <select name="grupo"><option value="ruta">Ruta de formación</option><option value="extra">Contenido extra</option></select>
            </label>
            <label className="ck"><input type="checkbox" name="gratis" /> Visible para el plan gratuito</label>
            <button className="btn s">Crear curso</button>
          </form>
        </details>
      )}

      <div className="tag">Ruta de formación</div>
      <div className="grid">{cursos.filter((c) => c.grupo === "ruta").map(tarjeta)}</div>
      <div className="tag">Contenido extra</div>
      <div className="grid">{cursos.filter((c) => c.grupo === "extra").map(tarjeta)}</div>
    </>
  );
}
