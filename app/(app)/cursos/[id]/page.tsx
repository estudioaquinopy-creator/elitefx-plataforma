import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { perfilActual } from "@/lib/sesion";
import { embedUrl } from "@/lib/video";
import { bloqueosExamen } from "@/lib/examen";
import { alternarCompletada, editarCurso, eliminarCurso, eliminarLeccion, guardarLeccion, reordenarLecciones } from "../actions";
import ListaLeccionesAdmin from "@/components/ListaLeccionesAdmin";

export const dynamic = "force-dynamic";

type Material = { tipo: string; titulo: string; url: string };
type Leccion = { id: string; curso_id: string; orden: number; titulo: string; descripcion: string; youtube_url: string; materiales: Material[] };

export default async function CursoPage({ params, searchParams }: { params: { id: string }; searchParams: { l?: string; edit?: string; error?: string } }) {
  const perfil = await perfilActual();
  const supabase = createClient();
  const { data: curso } = await supabase.from("cursos").select("*").eq("id", params.id).single();
  if (!curso) notFound();
  const { data: lecsRaw } = await supabase.from("lecciones").select("*").eq("curso_id", params.id).order("orden");
  const lecs = (lecsRaw ?? []) as Leccion[];
  const admin = perfil.rol === "admin";
  const { data: prog } = await supabase.from("progreso").select("leccion_id").eq("user_id", perfil.id);
  const hechas = new Set((prog ?? []).map((p: { leccion_id: string }) => p.leccion_id));

  // Examen: el curso siguiente se desbloquea al aprobar el examen del anterior.
  const { data: todos } = await supabase.from("cursos").select("id, nombre, grupo, orden");
  const falta = admin ? undefined : (await bloqueosExamen(supabase, perfil.id, (todos ?? []) as { id: string; nombre: string; grupo: string; orden: number }[], perfil.plan === "gratis"))[params.id];
  if (falta) {
    return (
      <>
        <Link href="/cursos" className="back">← Cursos</Link>
        <h1>{curso.nombre}</h1>
        <section className="box"><div className="tag">Bloqueado</div><p className="mu">Para acceder a este curso primero tienes que aprobar el examen de {falta.nombre}.</p><Link className="btn sd" href={"/cursos/" + falta.id + "/examen"}>Ir al examen de {falta.nombre}</Link></section>
      </>
    );
  }
  const { data: cfgE } = await supabase.from("examen_config").select("activo, preguntas, minimo").eq("curso_id", params.id).maybeSingle();
  const { data: apE } = await supabase.from("examen_intentos").select("aciertos, total").eq("user_id", perfil.id).eq("curso_id", params.id).eq("aprobado", true).order("aciertos", { ascending: false }).limit(1);
  const aprobE = (apE ?? [])[0] as { aciertos: number; total: number } | undefined;
  const completo = lecs.length > 0 && lecs.every((l) => hechas.has(l.id));

  if (!admin && lecs.length === 0 && !curso.gratis && perfil.plan === "gratis") {
    return (
      <>
        <h1>{curso.nombre}</h1>
        <section className="box"><p className="mu">Este curso es solo para miembros.</p></section>
      </>
    );
  }

  const actual = lecs.find((l) => l.id === searchParams.l) ?? lecs[0];
  const vid = actual ? embedUrl(actual.youtube_url) : null;
  const hecha = actual ? hechas.has(actual.id) : false;
  const editando = admin && searchParams.edit ? lecs.find((l) => l.id === searchParams.edit) : undefined;
  const matTxt = (m: Material[]) => m.map((x) => x.tipo + " | " + x.titulo + " | " + x.url).join("\n");

  return (
    <>
      <Link href="/cursos" className="back">← Cursos</Link>
      <h1>{curso.nombre}</h1>
      <p className="sub">{curso.descripcion}</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {admin && (
        <details className="box adm">
          <summary>Editar curso</summary>
          <form action={editarCurso} className="fm" encType="multipart/form-data">
            <input type="hidden" name="id" value={curso.id} />
            <label>Nombre<input name="nombre" defaultValue={curso.nombre} required /></label>
            <label>Descripción<input name="descripcion" defaultValue={curso.descripcion} /></label>
            <label>Cambiar imagen de portada (archivo)<input type="file" name="portada" accept="image/*" /></label>
            <label className="ck"><input type="checkbox" name="gratis" defaultChecked={curso.gratis} /> Visible para el plan gratuito</label>
            <button className="btn s">Guardar</button>
          </form>
          <form action={eliminarCurso}>
            <input type="hidden" name="id" value={curso.id} />
            <button className="btn d">Eliminar curso y sus lecciones</button>
          </form>
        </details>
      )}

      <div className="cols">
        <section className="box">
          {actual ? (
            <>
              {vid ? (
                <div className="vid">
                  <iframe
                    src={vid}
                    title={actual.titulo}
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="vid empty">Esta lección aún no tiene video.</div>
              )}
              <h2>{actual.titulo}</h2>
              {actual.descripcion && <p className="mu">{actual.descripcion}</p>}
              {actual.materiales.length > 0 && (
                <div className="mats">
                  <b>Materiales</b>
                  {actual.materiales.map((m, i) => (
                    <a key={i} href={m.url} target="_blank" rel="noopener noreferrer">{m.tipo === "pdf" ? "📄 " : "🔗 "}{m.titulo}</a>
                  ))}
                </div>
              )}
              <form action={alternarCompletada}>
                <input type="hidden" name="leccion_id" value={actual.id} />
                <input type="hidden" name="curso_id" value={curso.id} />
                <input type="hidden" name="hecha" value={hecha ? "1" : "0"} />
                <button className={hecha ? "btn g" : "btn s"}>{hecha ? "✓ Lección completada (desmarcar)" : "Marcar lección como completada"}</button>
              </form>
              {admin && (
                <p className="adm-links">
                  <Link href={"?l=" + actual.id + "&edit=" + actual.id}>Editar esta lección</Link>
                </p>
              )}
            </>
          ) : (
            <p className="mu">Este curso aún no tiene lecciones.</p>
          )}
        </section>

        <section className="box">
          <h2>Lecciones</h2>
          {admin ? (
            <ListaLeccionesAdmin cursoId={curso.id} lecciones={lecs.map((l) => ({ id: l.id, titulo: l.titulo, hecha: hechas.has(l.id) }))} actualId={actual ? actual.id : null} guardar={reordenarLecciones} />
          ) : (
            <div className="lst">
              {lecs.map((l, i) => (
                <Link key={l.id} href={"?l=" + l.id} className={actual && l.id === actual.id ? "li on" : "li"}>
                  <span className="n">{hechas.has(l.id) ? "✓" : i + 1}</span>
                  <span>{l.titulo}</span>
                </Link>
              ))}
            </div>
          )}
          {(cfgE?.activo || admin) && (
            <div className="exam-card">
              <b>Examen del curso</b>
              {admin ? (
                <small className="mu">Administra las preguntas y el mínimo para aprobar.</small>
              ) : aprobE ? (
                <small className="pos">✓ Aprobado ({aprobE.aciertos}/{aprobE.total})</small>
              ) : completo ? (
                <small className="mu">{cfgE?.preguntas} preguntas · aprueba con {cfgE?.minimo}.</small>
              ) : (
                <small className="mu">Completa todas las lecciones para desbloquearlo.</small>
              )}
              {(admin || completo || aprobE) && <Link className="btn sd s" href={"/cursos/" + curso.id + "/examen"}>{admin ? "Configurar examen" : aprobE ? "Repetir examen" : "Rendir examen"}</Link>}
            </div>
          )}
        </section>
      </div>

      {admin && (
        <details className="box adm" open={!!editando}>
          <summary>{editando ? "Editar lección" : "+ Nueva lección"}</summary>
          <form action={guardarLeccion} className="fm" key={editando ? editando.id : "nueva"}>
            <input type="hidden" name="id" value={editando ? editando.id : ""} />
            <input type="hidden" name="curso_id" value={curso.id} />
            <label>Título<input name="titulo" defaultValue={editando?.titulo ?? ""} required /></label>
            <label>Enlace del video (Vimeo o YouTube)<input name="youtube_url" defaultValue={editando?.youtube_url ?? ""} placeholder="Pega el código o enlace de Incrustar de Vimeo" /></label>
            <label>Descripción<textarea name="descripcion" rows={3} defaultValue={editando?.descripcion ?? ""} /></label>
            <label>Materiales (uno por línea: <code>pdf | Título | enlace</code> o <code>link | Título | enlace</code>)
              <textarea name="materiales" rows={4} defaultValue={editando ? matTxt(editando.materiales) : ""} />
            </label>
            <button className="btn s">{editando ? "Guardar cambios" : "Agregar lección"}</button>
          </form>
          {editando && (
            <form action={eliminarLeccion}>
              <input type="hidden" name="id" value={editando.id} />
              <input type="hidden" name="curso_id" value={curso.id} />
              <button className="btn d">Eliminar esta lección</button>
            </form>
          )}
        </details>
      )}
    </>
  );
}
