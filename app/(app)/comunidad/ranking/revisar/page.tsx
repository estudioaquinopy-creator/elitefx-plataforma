import Link from "next/link";
import { notFound } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { cierreISO, ultimoViernes } from "@/lib/ranking";
import { ajustarPuntos } from "../../actions";

export const dynamic = "force-dynamic";

type Post = { id: string; canal: string; titulo: string; cuerpo: string; imagen_url: string | null; created_at: string };
type Com = { id: string; post_id: string; cuerpo: string; created_at: string; util: boolean };
type Ajuste = { id: string; created_at: string; puntos: number; motivo: string };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1] + " de " + m.slice(0, 4);
const sumaMes = (m: string, d: number) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + d; return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0"); };
const cuando = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const CANAL: Record<string, string> = { resultados: "Resultado", preguntas: "Pregunta", anuncios: "Anuncio" };

export default async function Revisar({ searchParams }: { searchParams: { u?: string; m?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") notFound();
  const u = /^[0-9a-f-]{36}$/i.test(searchParams.u ?? "") ? (searchParams.u as string) : "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") ? (searchParams.m as string) : "";
  if (!u || !mes) notFound();
  const sb = createClient();
  // El ranking de un mes va desde el sábado después del último viernes del mes anterior hasta el último viernes de este mes (23:59, hora de Paraguay).
  const desde = cierreISO(sumaMes(mes, -1));
  const hasta = cierreISO(mes);

  const [pf, ps, cs, aj, cert, liq] = await Promise.all([
    sb.from("perfiles").select("nombre, email, plan, avatar_desde").eq("id", u).maybeSingle(),
    sb.from("publicaciones").select("id, canal, titulo, cuerpo, imagen_url, created_at").eq("user_id", u).gte("created_at", desde).lt("created_at", hasta).order("created_at", { ascending: false }).limit(300),
    sb.from("comentarios").select("id, post_id, cuerpo, created_at, util").eq("user_id", u).gte("created_at", desde).lt("created_at", hasta).order("created_at", { ascending: false }).limit(500),
    sb.from("ranking_ajustes").select("id, created_at, puntos, motivo").eq("user_id", u).eq("mes", mes).order("created_at", { ascending: false }),
    sb.from("certificados").select("codigo, emitido_at").eq("user_id", u).gte("emitido_at", desde).lt("emitido_at", hasta),
    sb.from("liquid_cuentas").select("estado, mes").eq("user_id", u).eq("estado", "aprobado"),
  ]);
  const persona = pf.data as { nombre: string; email: string; plan: string; avatar_desde: string | null } | null;
  const posts = (ps.data ?? []) as Post[];
  const coms = (cs.data ?? []) as Com[];
  const ajustes = (aj.data ?? []) as Ajuste[];
  const certs = (cert.data ?? []) as { codigo: string; emitido_at: string }[];

  // Publicación a la que respondió cada comentario + me gusta que recibió cada publicación propia.
  const ids = Array.from(new Set(coms.map((c) => c.post_id)));
  const { data: pp } = ids.length ? await sb.from("publicaciones").select("id, canal, titulo, cuerpo, autor").in("id", ids) : { data: [] };
  const destino = new Map(((pp ?? []) as { id: string; canal: string; titulo: string; cuerpo: string; autor: string }[]).map((x) => [x.id, x]));
  const likes = new Map<string, number>();
  if (posts.length) {
    const { data: lk } = await sb.from("likes").select("post_id, user_id").in("post_id", posts.map((p) => p.id)).neq("user_id", u).limit(5000);
    for (const l of (lk ?? []) as { post_id: string }[]) likes.set(l.post_id, (likes.get(l.post_id) ?? 0) + 1);
  }
  const enlace = (canal: string, id: string) => "/comunidad?canal=" + canal + "#" + id;
  const corto = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);

  return (
    <>
      <Link href={"/comunidad/ranking?m=" + mes} className="back">← Ranking de {nombreMes(mes)}</Link>
      <h1>{persona?.nombre || persona?.email || "Persona"}</h1>
      <p className="sub">Todo lo que publicó y respondió en el ranking de {nombreMes(mes)} (hasta el {ultimoViernes(mes).split("-").reverse().join("/")}). Revisa que los aportes sean reales; si ves spam o texto sin sentido, descuenta los puntos abajo.</p>

      <section className="box">
        <h2>Publicaciones ({posts.length})</h2>
        {posts.length === 0 && <p className="mu">No publicó nada en este período.</p>}
        {posts.map((p) => (
          <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--bd)" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="pill">{CANAL[p.canal] ?? p.canal}</span>
              <small className="mu">{cuando(p.created_at)} · {p.cuerpo.length} caracteres · {likes.get(p.id) ?? 0} me gusta de otros</small>
              <Link href={enlace(p.canal, p.id)} style={{ marginLeft: "auto" }}>Abrir en la comunidad →</Link>
            </div>
            {p.titulo && <b style={{ display: "block", marginTop: 6 }}>{p.titulo}</b>}
            <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{p.cuerpo || <span className="mu">(sin texto)</span>}</p>
            {p.imagen_url && <a href={p.imagen_url} target="_blank" rel="noopener noreferrer"><img src={p.imagen_url} alt="Imagen de la publicación" style={{ maxWidth: 220, maxHeight: 160, borderRadius: 8, marginTop: 4 }} /></a>}
          </div>
        ))}
      </section>

      <section className="box">
        <h2>Respuestas ({coms.length})</h2>
        {coms.length === 0 && <p className="mu">No respondió a nadie en este período.</p>}
        {coms.map((c) => {
          const d = destino.get(c.post_id);
          return (
            <div key={c.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--bd)" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {c.util && <span className="pill ok">Marcada útil · 5 pts</span>}
                <small className="mu">{cuando(c.created_at)} · {c.cuerpo.length} caracteres{c.cuerpo.length < 20 ? " (menos de 20: no suma)" : ""}</small>
                {d && <Link href={enlace(d.canal, c.post_id)} style={{ marginLeft: "auto" }}>Abrir la publicación →</Link>}
              </div>
              <p style={{ margin: "6px 0 2px", whiteSpace: "pre-wrap" }}>{c.cuerpo}</p>
              {d && <small className="mu">En respuesta a {d.autor ? d.autor + ": " : ""}«{corto(d.titulo || d.cuerpo)}»</small>}
            </div>
          );
        })}
      </section>

      <section className="box">
        <h2>Otros puntos</h2>
        <div className="ses"><div style={{ flex: 1 }}>📸 Foto de perfil</div><span className="mu">{persona?.avatar_desde ? "subida el " + cuando(persona.avatar_desde) : "sin foto"}</span></div>
        <div className="ses"><div style={{ flex: 1 }}>🏦 Cuenta de Liquid</div><span className="mu">{((liq.data ?? []) as { mes: string }[]).some((x) => x.mes === mes) ? "aprobada este mes" : "—"}</span></div>
        <div className="ses"><div style={{ flex: 1 }}>🎓 Certificados</div><span className="mu">{certs.length ? certs.map((c) => c.codigo).join(", ") : "—"}</span></div>
        {ajustes.length > 0 && <><h3>Ajustes manuales de este mes</h3>{ajustes.map((a) => <div key={a.id} className="ses"><div style={{ flex: 1 }}>{a.motivo}<small className="mu" style={{ display: "block" }}>{cuando(a.created_at)}</small></div><b>{a.puntos > 0 ? "+" : ""}{a.puntos} pts</b></div>)}</>}
      </section>

      <details className="box adm" open>
        <summary>Sumar o descontar puntos a esta persona</summary>
        <form action={ajustarPuntos} className="fm">
          <input type="hidden" name="mes" value={mes} />
          <input type="hidden" name="user_id" value={u} />
          <input type="hidden" name="volver" value={"/comunidad/ranking/revisar?u=" + u + "&m=" + mes} />
          <div className="f2">
            <label>Puntos (negativo para restar)<input name="puntos" type="number" step="1" required placeholder="-5" /></label>
            <label>Motivo<input name="motivo" required maxLength={200} placeholder="Ej.: respuestas sin sentido para sumar puntos" /></label>
          </div>
          <button className="btn s">Guardar ajuste en {nombreMes(mes)}</button>
        </form>
      </details>
    </>
  );
}
