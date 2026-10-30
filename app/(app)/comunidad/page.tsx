import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import CajaTexto from "@/components/CajaTexto";
import Compositor from "@/components/Compositor";
import BotonEnvio from "@/components/BotonEnvio";
import PostModal from "@/components/PostModal";
import FormRespuesta from "@/components/FormRespuesta";
import { borrarPublicacion, publicar, alternarLike, comentar, borrarComentario, marcarUtil } from "./actions";

export const dynamic = "force-dynamic";

type Pub = { id: string; user_id: string; autor: string; canal: string; titulo: string; cuerpo: string; imagen_url: string | null; created_at: string };
type Com = { id: string; post_id: string; user_id: string; autor: string; cuerpo: string; created_at: string; util?: boolean };
const CANALES: Record<string, string> = { anuncios: "Anuncios", preguntas: "Preguntas generales", resultados: "Resultados" };
const cuando = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const ini = (n: string) => (n.trim()[0] || "?").toUpperCase();

export default async function Comunidad({ searchParams }: { searchParams: { canal?: string; error?: string } }) {
  const perfil = await perfilActual();
  const perm = await permisos(perfil);
  if (!perm.comunidad) {
    return (
      <>
        <h1>Comunidad</h1>
        <section className="box"><div className="tag">Solo miembros</div><p className="mu">La comunidad es para miembros.</p><Link className="btn sd" href="/ayuda">Quiero ser miembro</Link></section>
      </>
    );
  }
  const filtro = searchParams.canal && CANALES[searchParams.canal] ? searchParams.canal : "";
  const sb = createClient();
  let q = sb.from("publicaciones").select("*").order("created_at", { ascending: false }).limit(60);
  if (filtro) q = q.eq("canal", filtro);
  const pubs = ((await q).data ?? []) as Pub[];
  const ids = pubs.map((p) => p.id);
  // Me gusta y respuestas se piden a la vez (antes iban una detrás de otra).
  const [{ data: lk }, { data: cm }] = await Promise.all([
    ids.length ? sb.from("likes").select("post_id, user_id").in("post_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? sb.from("comentarios").select("*").in("post_id", ids).order("created_at") : Promise.resolve({ data: [] }),
  ]);
  const likes = (lk ?? []) as { post_id: string; user_id: string }[];
  const coms = (cm ?? []) as Com[];
  // Fotos de perfil de quienes publican o responden (si la migración 0036 aún no se corrió, se muestran las iniciales).
  const quienes = Array.from(new Set([...pubs.map((p) => p.user_id), ...coms.map((c) => c.user_id)]));
  const fotos = new Map<string, string>();
  if (quienes.length) {
    const { data: av } = await sb.rpc("avatares_comunidad", { p_ids: quienes });
    for (const a of (av ?? []) as { id: string; avatar_url: string }[]) fotos.set(a.id, a.avatar_url);
  }
  const avatar = (uid: string, nombre: string) => (fotos.get(uid) ? <img src={fotos.get(uid)} alt="" loading="lazy" /> : ini(nombre));
  const opciones = perm.admin ? ["anuncios", "preguntas", "resultados"] : ["preguntas", "resultados"];
  const volver = "/comunidad" + (filtro ? "?canal=" + filtro : "");

  return (
    <>
      <h1>Comunidad</h1>
      <p className="sub">Comparte tus resultados, resuelve dudas y apoya a otros alumnos.</p>
      <p style={{ margin: "0 0 14px" }}><Link className="btn sd s" href="/comunidad/ranking">🏆 Ranking del mes</Link></p>
      {searchParams.error && <p className="alerta">{searchParams.error}</p>}

      {perm.comunidad ? (
        <Compositor action={publicar} iniciales={perfil.avatar_url ? <img src={perfil.avatar_url} alt="" /> : ini(perfil.nombre || perfil.email)} opciones={opciones.map((c) => ({ value: c, label: CANALES[c] }))} />
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
            <span className="av2">{avatar(p.user_id, p.autor)}</span>
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
              </div>
              {p.imagen_url && <img className="pv-img" src={p.imagen_url} alt="" loading="lazy" />}
            </div>
          </section>
        );
        return (
          <PostModal
            key={p.id} id={p.id} vista={vista} nl={nl} mio={mio} nc={rs.length} puedeLike={perm.comunidad} alternar={alternarLike}
            detalle={
              <div className="post2">
                {cabecera}
                {p.titulo && <h2 style={{ margin: "4px 0 6px" }}>{p.titulo}</h2>}
                {p.cuerpo && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}>{p.cuerpo}</p>}
                {p.imagen_url && <img className="pimg" src={p.imagen_url} alt="Imagen de la publicación" />}
              </div>
            }
            extras={(perm.admin || p.user_id === perfil.id) ? (
              <form action={borrarPublicacion} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={p.id} /><button className="lk">Eliminar publicación</button></form>
            ) : null}
            respuestas={
              <>
                {rs.map((c) => (
                  <div key={c.id} className="resp">
                    <span className="av2 s">{avatar(c.user_id, c.autor)}</span>
                    <div style={{ flex: 1 }}>
                      <b>{c.autor}</b> <small className="mu">{cuando(c.created_at)}</small>{c.util && <span className="pill pos" style={{ marginLeft: 8 }}>✓ Respuesta útil</span>}
                      <p style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}>{c.cuerpo}</p>
                    </div>
                    {(perm.admin || p.user_id === perfil.id) && c.user_id !== p.user_id && (
                      <form action={marcarUtil}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="post" value={p.id} /><input type="hidden" name="volver" value={volver} /><input type="hidden" name="util" value={c.util ? "0" : "1"} /><button className="lk">{c.util ? "Quitar útil" : "Marcar útil"}</button></form>
                    )}
                    {(perm.admin || c.user_id === perfil.id) && (
                      <form action={borrarComentario}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="post" value={p.id} /><input type="hidden" name="volver" value={volver} /><button className="lk">Eliminar</button></form>
                    )}
                  </div>
                ))}
                {perm.comunidad && (
                  <FormRespuesta action={comentar} id={p.id} />
                )}
              </>
            }
          />
        );
      })}
    </>
  );
}
