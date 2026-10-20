import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import CajaTexto from "@/components/CajaTexto";
import Compositor from "@/components/Compositor";
import PostModal from "@/components/PostModal";
import { borrarPublicacion, publicar, darLike, comentar, borrarComentario } from "./actions";

export const dynamic = "force-dynamic";

type Pub = { id: string; user_id: string; autor: string; canal: string; titulo: string; cuerpo: string; imagen_url: string | null; created_at: string };
type Com = { id: string; post_id: string; user_id: string; autor: string; cuerpo: string; created_at: string };
const CANALES: Record<string, string> = { anuncios: "Anuncios", preguntas: "Preguntas generales", resultados: "Resultados" };
const cuando = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const ini = (n: string) => (n.trim()[0] || "?").toUpperCase();

export default async function Comunidad({ searchParams }: { searchParams: { canal?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  const filtro = searchParams.canal && CANALES[searchParams.canal] ? searchParams.canal : "";
  const sb = createClient();
  let q = sb.from("publicaciones").select("*").order("created_at", { ascending: false }).limit(60);
  if (filtro) q = q.eq("canal", filtro);
  const pubs = ((await q).data ?? []) as Pub[];
  const ids = pubs.map((p) => p.id);
  const { data: lk } = ids.length ? await sb.from("likes").select("post_id, user_id").in("post_id", ids) : { data: [] };
  const { data: cm } = ids.length ? await sb.from("comentarios").select("*").in("post_id", ids).order("created_at") : { data: [] };
  const likes = (lk ?? []) as { post_id: string; user_id: string }[];
  const coms = (cm ?? []) as Com[];
  const opciones = perm.admin ? ["anuncios", "preguntas", "resultados"] : ["preguntas", "resultados"];
  const volver = "/comunidad" + (filtro ? "?canal=" + filtro : "");

  return (
    <>
      <h1>Comunidad</h1>
      <p className="sub">Comparte tus resultados, resuelve dudas y apoya a otros alumnos.</p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {perm.comunidad ? (
        <Compositor action={publicar} iniciales={ini(perfil.nombre || perfil.email)} opciones={opciones.map((c) => ({ value: c, label: CANALES[c] }))} />
      ) : (
        <section className="box">
          <div className="tag">Modo lectura</div>
          <p className="mu">En el plan gratuito puedes leer la comunidad, pero no publicar, dar me gusta ni responder. Hazte miembro para participar.</p>
          <Link className="btn sd" href="/ayuda">Quiero ser miembro</Link>
        </section>
      )}

      <div className="chips">
        <Link href="/comunidad" className={!filtro ? "chip on" : "chip"}>Todo</Link>
        {Object.entries(CANALES).map(([k, n]) => <Link key={k} href={"/comunidad?canal=" + k} className={filtro === k ? "chip on" : "chip"}>{n}</Link>)}
      </div>

      {pubs.length === 0 && <section className="box"><p className="mu">Todavía no hay publicaciones.</p></section>}
      {pubs.map((p) => {
        const nl = likes.filter((l) => l.post_id === p.id).length;
        const mio = likes.some((l) => l.post_id === p.id && l.user_id === perfil.id);
        const rs = coms.filter((c) => c.post_id === p.id);
        const cabecera = (
          <div className="post-h">
            <span className="av2">{ini(p.autor)}</span>
            <div><b>{p.autor}</b><small className="mu" style={{ display: "block" }}>{cuando(p.created_at)}</small></div>
            <span className={"pill c-" + p.canal} style={{ marginLeft: "auto" }}>{CANALES[p.canal]}</span>
          </div>
        );
        const vista = (
          <section className="box post2 pvbox">
            <div className="pv-in">
              <div className="pv-t">
                {cabecera}
                {p.titulo && <b className="pv-ti">{p.titulo}</b>}
                {p.cuerpo && <p className="pv-tx">{p.cuerpo}</p>}
                <small className="mu">♥ {nl} · 💬 {rs.length}</small>
              </div>
              {p.imagen_url && <img className="pv-img" src={p.imagen_url} alt="" loading="lazy" />}
            </div>
          </section>
        );
        return (
          <PostModal key={p.id} id={p.id} vista={vista}>
            <div className="post2">
              {cabecera}
              {p.titulo && <h2 style={{ margin: "4px 0 6px" }}>{p.titulo}</h2>}
              {p.cuerpo && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{p.cuerpo}</p>}
              {p.imagen_url && <img className="pimg" src={p.imagen_url} alt="Imagen de la publicación" />}

              <div className="acc">
                <form action={darLike}>
                  <input type="hidden" name="id" value={p.id} /><input type="hidden" name="volver" value={volver} />
                  <button className={"lkb" + (mio ? " on" : "")} aria-pressed={mio}>{mio ? "♥" : "♡"} {nl > 0 ? nl : ""} Me gusta</button>
                </form>
                <span className="mu">💬 {rs.length} {rs.length === 1 ? "respuesta" : "respuestas"}</span>
                {(perm.admin || p.user_id === perfil.id) && (
                  <form action={borrarPublicacion} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={p.id} /><button className="lk">Eliminar publicación</button></form>
                )}
              </div>

              {rs.map((c) => (
                <div key={c.id} className="resp">
                  <span className="av2 s">{ini(c.autor)}</span>
                  <div style={{ flex: 1 }}>
                    <b>{c.autor}</b> <small className="mu">{cuando(c.created_at)}</small>
                    <p style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}>{c.cuerpo}</p>
                  </div>
                  {(perm.admin || c.user_id === perfil.id) && (
                    <form action={borrarComentario}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="post" value={p.id} /><input type="hidden" name="volver" value={volver} /><button className="lk">Eliminar</button></form>
                  )}
                </div>
              ))}

              {perm.comunidad && (
                <form action={comentar} className="fm resf">
                  <input type="hidden" name="id" value={p.id} /><input type="hidden" name="volver" value={volver} />
                  <CajaTexto name="cuerpo" rows={1} placeholder="Escribe una respuesta…" required maxLength={1000} />
                  <button className="btn g s">Responder</button>
                </form>
              )}
            </div>
          </PostModal>
        );
      })}
    </>
  );
}
