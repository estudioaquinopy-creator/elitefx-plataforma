import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import { borrarPublicacion, publicar } from "./actions";

export const dynamic = "force-dynamic";

type Pub = { id: string; user_id: string; autor: string; canal: string; titulo: string; cuerpo: string; created_at: string };
const CANALES: Record<string, string> = { anuncios: "Anuncios", preguntas: "Preguntas generales", resultados: "Resultados" };

export default async function Comunidad({ searchParams }: { searchParams: { canal?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const filtro = searchParams.canal && CANALES[searchParams.canal] ? searchParams.canal : "";
  let q = createClient().from("publicaciones").select("*").order("created_at", { ascending: false }).limit(60);
  if (filtro) q = q.eq("canal", filtro);
  const { data } = await q;
  const pubs = (data ?? []) as Pub[];
  const opciones = perm.admin ? ["anuncios", "preguntas", "resultados"] : ["preguntas", "resultados"];

  return (
    <>
      <h1>Comunidad</h1>
      <p className="sub">Un espacio para dudas y resultados.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {perm.comunidad ? (
        <section className="box">
          <h2>Escribir en la comunidad</h2>
          <form action={publicar} className="fm">
            <label>Etiqueta
              <select name="canal" defaultValue="preguntas">
                {opciones.map((c) => <option key={c} value={c}>{CANALES[c]}</option>)}
              </select>
            </label>
            <label>Título<input name="titulo" required maxLength={140} /></label>
            <label>Mensaje<textarea name="cuerpo" rows={4} placeholder="Cuéntanos tu resultado o haz tu pregunta…" /></label>
            <button className="btn s">Publicar</button>
          </form>
          <p className="note">Solo el equipo de ELITE FX publica en Anuncios. Los alumnos pueden publicar con la etiqueta Resultados o Preguntas generales.</p>
        </section>
      ) : (
        <section className="box">
          <div className="tag">Modo lectura</div>
          <p className="mu">En el plan gratuito puedes leer la comunidad, pero no publicar. Hazte miembro para participar con Resultados y Preguntas generales.</p>
          <Link className="btn s" href="/ayuda">Quiero ser miembro</Link>
        </section>
      )}

      <div className="chips">
        <Link href="/comunidad" className={!filtro ? "chip on" : "chip"}>Todo</Link>
        {Object.entries(CANALES).map(([k, n]) => <Link key={k} href={"/comunidad?canal=" + k} className={filtro === k ? "chip on" : "chip"}>{n}</Link>)}
      </div>

      <section className="box">
        <h2>Publicaciones</h2>
        {pubs.length === 0 && <p className="mu">Todavía no hay publicaciones.</p>}
        {pubs.map((p) => (
          <article key={p.id} className="post">
            <div className="post-h">
              <span className={p.canal === "anuncios" ? "pill ok" : "pill"}>{CANALES[p.canal]}</span>
              <small className="mu">{p.autor} · {new Date(p.created_at).toLocaleDateString("es-PY")}</small>
              {(perm.admin || p.user_id === perfil.id) && (
                <form action={borrarPublicacion} style={{ marginLeft: "auto" }}>
                  <input type="hidden" name="id" value={p.id} />
                  <button className="lk">Eliminar</button>
                </form>
              )}
            </div>
            <b>{p.titulo}</b>
            {p.cuerpo && <p className="mu" style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{p.cuerpo}</p>}
          </article>
        ))}
      </section>
    </>
  );
}
