import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { perfilActual, permisos } from "@/lib/sesion";
import CajaTexto from "@/components/CajaTexto";
import Compositor from "@/components/Compositor";
import BotonEnvio from "@/components/BotonEnvio";
import PostModal from "@/components/PostModal";
import FormRespuesta from "@/components/FormRespuesta";
import FormEditarPublicacion from "@/components/FormEditarPublicacion";
import BotonReportar from "@/components/BotonReportar";
import ImagenZoom from "@/components/ImagenZoom";
import TextoMenciones from "@/components/TextoMenciones";
import { MOTIVOS_REPORTE, reportar, alternarFijada, editarPublicacion, borrarPublicacion, publicar, alternarLike, comentar, borrarComentario, marcarUtil } from "./actions";

export const dynamic = "force-dynamic";

type Pub = { id: string; user_id: string; autor: string; canal: string; titulo: string; cuerpo: string; imagen_url: string | null; created_at: string; editado_at?: string | null; fijada_at?: string | null };
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
  // Publicaciones fijadas como importantes (hasta 3): van arriba. Se piden aparte para que, si aún no se corrió la migración 0050, la comunidad siga funcionando.
  let pf = sb.from("publicaciones").select("*").not("fijada_at", "is", null).order("fijada_at", { ascending: false }).limit(3);
  if (filtro) pf = pf.eq("canal", filtro);
  const [{ data: dRec }, { data: dFij }] = await Promise.all([q, pf]);
  const fijadas = (dFij ?? []) as Pub[];
  const idsFijadas = new Set(fijadas.map((p) => p.id));
  const pubs = [...fijadas, ...((dRec ?? []) as Pub[]).filter((p) => !idsFijadas.has(p.id))];
  const nFijadas = fijadas.length;
  let nReportes = 0;
  if (perm.admin) {
    const rc = await sb.from("reportes").select("id", { count: "exact", head: true }).eq("estado", "pendiente");
    nReportes = rc.error ? 0 : rc.count ?? 0;
  }
  const rr = await sb.from("reportes").select("tipo, post_id, comentario_id").eq("reportado_por", perfil.id).limit(300);
  const misReportes = new Set(((rr.error ? [] : rr.data ?? []) as { tipo: string; post_id: string; comentario_id: string | null }[]).map((x) => x.tipo + ":" + (x.comentario_id ?? x.post_id)));
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
      <p style={{ margin: "0 0 14px", display: "flex", gap: 8, flexWrap: "wrap" }}><Link className="btn sd s" href="/comunidad/ranking">🏆 Ranking del mes</Link>{perm.admin && <Link className="btn sd s" href="/comunidad/reportes">⚑ Reportes{nReportes > 0 ? " (" + nReportes + ")" : ""}</Link>}</p>
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
            <div><b>{p.autor}</b><small className="mu" style={{ display: "block" }}>{cuando(p.created_at)}{p.editado_at ? " · editado" : ""}</small></div>
            {p.fijada_at && <span className="pill fijada" style={{ marginLeft: "auto" }}>📌 Importante</span>}
            <span className={"pill c-" + p.canal} style={{ marginLeft: p.fijada_at ? 6 : "auto" }}>{CANALES[p.canal]}</span>
          </div>
        );
        const vista = (
          <section className="box post2 pvbox">
            <div className="pv-in">
              <div className="pv-t">
                {cabecera}
                {p.titulo && <b className="pv-ti">{p.titulo}</b>}
                {p.cuerpo && <p className="pv-tx"><TextoMenciones texto={p.cuerpo} /></p>}
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
                {p.cuerpo && <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0" }}><TextoMenciones texto={p.cuerpo} /></p>}
                {p.imagen_url && <ImagenZoom className="pimg" src={p.imagen_url} alt="Imagen de la publicación" />}
              </div>
            }
            extras={(perm.admin || p.user_id === perfil.id || perm.comunidad) ? (
              <>
                {perm.admin && (p.fijada_at || nFijadas < 3) && (
                  <form action={alternarFijada}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="fijar" value={p.fijada_at ? "0" : "1"} /><button className="lk">{p.fijada_at ? "Quitar de importantes" : "📌 Fijar como importante"}</button></form>
                )}
                {p.user_id === perfil.id && perm.comunidad && <FormEditarPublicacion action={editarPublicacion} id={p.id} titulo={p.titulo} cuerpo={p.cuerpo} />}
                {p.user_id !== perfil.id && perm.comunidad && <BotonReportar action={reportar} motivos={MOTIVOS_REPORTE} campos={{ tipo: "publicacion", post_id: p.id }} ya={misReportes.has("publicacion:" + p.id)} />}
                {(perm.admin || p.user_id === perfil.id) && <form action={borrarPublicacion} style={{ marginLeft: "auto" }}><input type="hidden" name="id" value={p.id} /><button className="lk">Eliminar publicación</button></form>}
              </>
            ) : null}
            respuestas={
              <>
                {rs.map((c) => (
                  <div key={c.id} className="resp">
                    <span className="av2 s">{avatar(c.user_id, c.autor)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{c.autor}</b> <small className="mu">{cuando(c.created_at)}</small>{c.util && <span className="pill pos" style={{ marginLeft: 8 }}>✓ Respuesta útil</span>}
                      <p style={{ whiteSpace: "pre-wrap", margin: "2px 0 0" }}><TextoMenciones texto={c.cuerpo} /></p>
                      <div className="resp-acc">
                      {(perm.admin || p.user_id === perfil.id) && c.user_id !== p.user_id && (
                        <form action={marcarUtil}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="post" value={p.id} /><input type="hidden" name="volver" value={volver} /><input type="hidden" name="util" value={c.util ? "0" : "1"} /><button className="lk">{c.util ? "Quitar útil" : "Marcar útil"}</button></form>
                      )}
                      {c.user_id !== perfil.id && perm.comunidad && <BotonReportar action={reportar} motivos={MOTIVOS_REPORTE} campos={{ tipo: "comentario", post_id: p.id, comentario_id: c.id }} ya={misReportes.has("comentario:" + c.id)} />}
                      {(perm.admin || c.user_id === perfil.id) && (
                        <form action={borrarComentario}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="post" value={p.id} /><input type="hidden" name="volver" value={volver} /><button className="lk">Eliminar</button></form>
                      )}
                      </div>
                    </div>
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
