import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import { leerAjustes } from "@/lib/ajustes";
import { miniatura } from "@/lib/miniatura";
import { embedUrl } from "@/lib/video";
import Portada from "@/components/Portada";
import { agregarTutorial, eliminarTutorial } from "./actions";

export const dynamic = "force-dynamic";

type Tut = { id: string; titulo: string; categoria: string; youtube_url: string };

export default async function Tutoriales({ searchParams }: { searchParams: { c?: string; v?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const aj = await leerAjustes();
  const portada = <Portada url={aj.portada_tutoriales} clave="portada_tutoriales" ruta="/tutoriales" admin={perm.admin} titulo="Tutoriales" />;

  if (!perm.tutoriales) {
    return (
      <>
        <h1>Tutoriales</h1>
        {portada}
        <section className="box"><div className="tag">Solo miembros</div><p className="mu">La biblioteca de tutoriales es para miembros.</p></section>
      </>
    );
  }

  const { data } = await createClient().from("tutoriales").select("*").order("created_at", { ascending: false });
  const todos = (data ?? []) as Tut[];
  const cats = Array.from(new Set(todos.map((t) => t.categoria)));
  const lista = searchParams.c ? todos.filter((t) => t.categoria === searchParams.c) : todos;
  const minis = new Map(await Promise.all(lista.map(async (t) => [t.id, await miniatura(t.youtube_url)] as const)));
  const actual = todos.find((t) => t.id === searchParams.v);
  const vid = actual ? embedUrl(actual.youtube_url, "&autoplay=1") : null;

  return (
    <>
      <h1>Tutoriales</h1>
      <p className="sub">Tu biblioteca de videos, ordenada por categoría.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}
      {portada}

      {perm.admin && (
        <details className="box adm">
          <summary>+ Agregar tutorial</summary>
          <form action={agregarTutorial} className="fm">
            <label>Título<input name="titulo" required /></label>
            <label>Categoría<input name="categoria" list="cats" placeholder="Plataforma, Análisis, Cripto, Broker…" /></label>
            <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
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

      <div className="chips">
        <Link href="/tutoriales" className={!searchParams.c ? "chip on" : "chip"}>Todos</Link>
        {cats.map((c) => <Link key={c} href={"/tutoriales?c=" + encodeURIComponent(c)} className={searchParams.c === c ? "chip on" : "chip"}>{c}</Link>)}
      </div>

      {lista.length === 0 && <section className="box"><p className="mu">Todavía no hay tutoriales.</p></section>}
      <div className="grid">
        {lista.map((t) => {
          const mini = minis.get(t.id);
          return (
            <div key={t.id} className="crs">
              <Link href={"/tutoriales?v=" + t.id + (searchParams.c ? "&c=" + encodeURIComponent(searchParams.c) : "")} className="tlink">
                <div className="cov" style={mini ? { backgroundImage: "url(" + mini + ")" } : undefined} />
                <div className="cb"><b>{t.titulo}</b><small className="mu">{t.categoria}</small></div>
              </Link>
              {perm.admin && (
                <form action={eliminarTutorial} style={{ padding: "0 14px 14px" }}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn g s">Eliminar</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
