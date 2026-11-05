import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { leerAjustes } from "@/lib/ajustes";
import { miniatura } from "@/lib/miniatura";
import { embedUrl } from "@/lib/video";
import Portada from "@/components/Portada";
import { agregarTutorial, eliminarTutorial } from "@/app/(app)/tutoriales/actions";

type Tut = { id: string; titulo: string; categoria: string; youtube_url: string };

// Biblioteca de videos (antes en /tutoriales); se muestra dentro del curso "Tutoriales".
export default async function BibliotecaTutoriales({ base, nombre, descripcion, admin, c, v, vista, error }: { base: string; nombre: string; descripcion: string; admin: boolean; c?: string; v?: string; vista?: string; error?: string }) {
  const aj = await leerAjustes();
  const { data } = await createClient().from("tutoriales").select("*").order("created_at", { ascending: false });
  const todos = (data ?? []) as Tut[];
  const cats = Array.from(new Set(todos.map((t) => t.categoria)));
  const lista = c ? todos.filter((t) => t.categoria === c) : todos;
  const minis = new Map(await Promise.all(lista.map(async (t) => [t.id, await miniatura(t.youtube_url)] as const)));
  const actual = todos.find((t) => t.id === v);
  const vid = actual ? embedUrl(actual.youtube_url, "&autoplay=1") : null;
  const lis = vista === "lista";
  // Enlace que conserva categoría y vista (cuadros o lista)
  const enlace = (o: { c?: string; v?: string; vista?: string }) => {
    const q = new URLSearchParams();
    const cc = "c" in o ? o.c : c, vv = "v" in o ? o.v : v, vi = "vista" in o ? o.vista : vista;
    if (cc) q.set("c", cc);
    if (vv) q.set("v", vv);
    if (vi === "lista") q.set("vista", "lista");
    const t = q.toString();
    return base + (t ? "?" + t : "");
  };

  return (
    <>
      <Link href="/cursos" className="back">← Cursos</Link>
      <h1>{nombre}</h1>
      <p className="sub">{descripcion || "Tu biblioteca de videos, ordenada por categoría."}</p>
      {error && <p className="alerta">{error}</p>}
      <Portada url={aj.portada_tutoriales} clave="portada_tutoriales" ruta={base} admin={admin} titulo="Tutoriales" />

      {admin && (
        <details className="box adm">
          <summary>+ Agregar tutorial</summary>
          <form action={agregarTutorial} className="fm">
            <label>Título<input name="titulo" required /></label>
            <label>Categoría<input name="categoria" list="cats" placeholder="Plataforma, Análisis, Cripto, Broker…" /></label>
            <datalist id="cats">{cats.map((x) => <option key={x} value={x} />)}</datalist>
            <label>Enlace del video (Vimeo o YouTube)<input type="text" name="youtube_url" placeholder="Pega el código o enlace de Incrustar de Vimeo" required /></label>
            <button className="btn s">Publicar tutorial</button>
          </form>
        </details>
      )}

      {actual && vid && (
        <section className="box">
          <div className="vid">
            <iframe src={vid} title={actual.titulo} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
          <h2>{actual.titulo}</h2>
          <p className="mu">{actual.categoria}</p>
        </section>
      )}

      <div className="tut-barra">
        <div className="chips">
          <Link href={enlace({ c: undefined, v: undefined })} className={!c ? "chip on" : "chip"}>Todos</Link>
          {cats.map((x) => <Link key={x} href={enlace({ c: x, v: undefined })} className={c === x ? "chip on" : "chip"}>{x}</Link>)}
        </div>
        <div className="tut-vista" role="group" aria-label="Vista">
          <Link href={enlace({ vista: undefined })} className={!lis ? "on" : ""} title="Ver en cuadros">▦ Cuadros</Link>
          <Link href={enlace({ vista: "lista" })} className={lis ? "on" : ""} title="Ver en lista">☰ Lista</Link>
        </div>
      </div>

      {lista.length === 0 && <section className="box"><p className="mu">Todavía no hay tutoriales.</p></section>}
      {lis ? (
        <div className="tut-lista">
          {lista.map((t) => {
            const mini = minis.get(t.id);
            return (
              <div key={t.id} className={"tut-fila" + (actual && actual.id === t.id ? " on" : "")}>
                <Link href={enlace({ v: t.id })} className="tut-fl">
                  <span className="tut-mini" style={mini ? { backgroundImage: "url(" + mini + ")" } : undefined}>▶</span>
                  <span className="tut-tx"><b>{t.titulo}</b><small className="mu">{t.categoria}</small></span>
                </Link>
                {admin && (
                  <form action={eliminarTutorial}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn g s">Eliminar</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid">
          {lista.map((t) => {
            const mini = minis.get(t.id);
            return (
              <div key={t.id} className="crs">
                <Link href={enlace({ v: t.id })} className="tlink">
                  <div className="cov" style={mini ? { backgroundImage: "url(" + mini + ")" } : undefined} />
                  <div className="cb"><b>{t.titulo}</b><small className="mu">{t.categoria}</small></div>
                </Link>
                {admin && (
                  <form action={eliminarTutorial} style={{ padding: "0 14px 14px" }}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn g s">Eliminar</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
