import Link from "next/link";
import { notFound } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { cierreISO, ultimoViernes } from "@/lib/ranking";
import { ajustarPuntos } from "../../actions";

export const dynamic = "force-dynamic";

type Post = { id: string; canal: string; titulo: string; cuerpo: string; imagen_url: string | null; imagenes_extra?: string[] | null; created_at: string };
type Com = { id: string; post_id: string; cuerpo: string; created_at: string; util: boolean; imagen_url?: string | null; imagenes_extra?: string[] | null };
type Ajuste = { id: string; created_at: string; puntos: number; motivo: string };
type Item = {
  key: string; tipo: "pub" | "resp"; at: string; dia: string; pts: number; nota: string; // pts: lo que suma esa cosa (sin contar el tope diario); nota: por qué no suma
  post?: Post; com?: Com; likesSuman?: number; likesTotal?: number; util?: boolean; utilNota?: string;
};
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1] + " de " + m.slice(0, 4);
const sumaMes = (m: string, d: number) => { const t = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + d; return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0"); };
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit" });
const cuando = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const diaDe = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Asuncion" }); // AAAA-MM-DD
const diaLargo = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("es-PY", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const CANAL: Record<string, string> = { resultados: "Resultado", preguntas: "Pregunta", anuncios: "Anuncio" };
const TOPE_DIA = 12;

export default async function Revisar({ searchParams }: { searchParams: { u?: string; m?: string; f?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") notFound();
  const u = /^[0-9a-f-]{36}$/i.test(searchParams.u ?? "") ? (searchParams.u as string) : "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") ? (searchParams.m as string) : "";
  if (!u || !mes) notFound();
  const filtro = searchParams.f === "suman" || searchParams.f === "nosuman" ? searchParams.f : "";
  const sb = createClient();
  // El ranking de un mes va desde el sábado después del último viernes del mes anterior hasta el último viernes de este mes (23:59, hora de Paraguay).
  const desde = cierreISO(sumaMes(mes, -1));
  const hasta = cierreISO(mes);

  const [pf, ps, cs, aj, cert, liq, rk, ut] = await Promise.all([
    sb.from("perfiles").select("nombre, email, plan, avatar_desde").eq("id", u).maybeSingle(),
    sb.from("publicaciones").select("*").eq("user_id", u).gte("created_at", desde).lt("created_at", hasta).order("created_at", { ascending: true }).limit(400),
    sb.from("comentarios").select("*").eq("user_id", u).gte("created_at", desde).lt("created_at", hasta).order("created_at", { ascending: true }).limit(600),
    sb.from("ranking_ajustes").select("id, created_at, puntos, motivo").eq("user_id", u).eq("mes", mes).order("created_at", { ascending: false }),
    sb.from("certificados").select("codigo, emitido_at").eq("user_id", u).gte("emitido_at", desde).lt("emitido_at", hasta),
    sb.from("liquid_cuentas").select("estado, mes").eq("user_id", u).eq("estado", "aprobado"),
    sb.rpc("ranking_mes", { p_mes: mes }),
    sb.from("comentarios").select("id", { count: "exact", head: true }).eq("user_id", u).eq("util", true),
  ]);
  const utilTotal = ut.count ?? 0;
  const persona = pf.data as { nombre: string; email: string; plan: string; avatar_desde: string | null } | null;
  const posts = (ps.data ?? []) as Post[];
  const coms = (cs.data ?? []) as Com[];
  const ajustes = (aj.data ?? []) as Ajuste[];
  const certs = (cert.data ?? []) as { codigo: string; emitido_at: string }[];
  const tabla = (rk.error ? [] : rk.data ?? []) as { user_id: string; puntos: number }[];
  const puesto = tabla.findIndex((x) => x.user_id === u) + 1;
  const puntosReales = puesto ? tabla[puesto - 1].puntos : null;

  // Publicación a la que respondió cada comentario (con su autor) + TODAS las respuestas de esta persona en esas publicaciones (para saber cuál fue la primera).
  const idsDest = Array.from(new Set(coms.map((c) => c.post_id)));
  const [pp, todas] = await Promise.all([
    idsDest.length ? sb.from("publicaciones").select("id, canal, titulo, cuerpo, autor, user_id").in("id", idsDest) : Promise.resolve({ data: [] }),
    idsDest.length ? sb.from("comentarios").select("id, post_id, created_at, util").eq("user_id", u).in("post_id", idsDest).order("created_at", { ascending: true }).limit(2000) : Promise.resolve({ data: [] }),
  ]);
  type Dest = { id: string; canal: string; titulo: string; cuerpo: string; autor: string; user_id: string };
  const destino = new Map(((pp.data ?? []) as Dest[]).map((x) => [x.id, x]));
  const primera = new Map<string, string>(); // post_id -> id de su primera respuesta
  const primeraUtil = new Map<string, string>(); // post_id -> id de su primera respuesta marcada útil
  for (const c of (todas.data ?? []) as { id: string; post_id: string; util: boolean }[]) {
    if (!primera.has(c.post_id)) primera.set(c.post_id, c.id);
    if (c.util && !primeraUtil.has(c.post_id)) primeraUtil.set(c.post_id, c.id);
  }

  // Me gusta de cada publicación propia: cuentan los primeros 10 de la publicación (incluido el de su autor, que no suma) y solo en el período.
  const likesPts = new Map<string, number>();
  const likesTot = new Map<string, number>();
  const likesDia = new Map<string, number>(); // día -> puntos por me gusta
  if (posts.length) {
    const { data: lk } = await sb.from("likes").select("post_id, user_id, created_at").in("post_id", posts.map((p) => p.id)).order("created_at", { ascending: true }).limit(8000);
    const orden = new Map<string, number>();
    const canalDe = new Map(posts.map((p) => [p.id, p.canal]));
    for (const l of (lk ?? []) as { post_id: string; user_id: string; created_at: string }[]) {
      const n = (orden.get(l.post_id) ?? 0) + 1;
      orden.set(l.post_id, n);
      if (l.user_id === u) continue;
      likesTot.set(l.post_id, (likesTot.get(l.post_id) ?? 0) + 1);
      const c = canalDe.get(l.post_id);
      if (n <= 10 && (c === "preguntas" || c === "resultados") && l.created_at >= desde && l.created_at < hasta) {
        likesPts.set(l.post_id, (likesPts.get(l.post_id) ?? 0) + 1);
        const d = diaDe(l.created_at);
        likesDia.set(d, (likesDia.get(d) ?? 0) + 1);
      }
    }
  }

  // Cada publicación y respuesta con lo que suma (o por qué no).
  const items: Item[] = [];
  const nPub = new Map<string, number>(); // día|canal -> publicaciones puntuables ya vistas
  for (const p of posts) {
    const dia = diaDe(p.created_at);
    let pts = 0, nota = "";
    if (p.canal !== "preguntas" && p.canal !== "resultados") nota = "No puntúa (canal de anuncios)";
    else if (!((p.cuerpo.trim().length + p.titulo.trim().length) >= 15 || p.imagen_url)) nota = "No suma: muy corta (menos de 15 caracteres y sin imagen)";
    else {
      const k = dia + "|" + p.canal;
      const n = (nPub.get(k) ?? 0) + 1;
      nPub.set(k, n);
      if (n > 2) nota = "No suma: ya llevaba 2 " + (p.canal === "resultados" ? "resultados" : "preguntas") + " ese día";
      else pts = p.canal === "resultados" ? 3 + (p.imagen_url ? 1 : 0) : 2;
    }
    items.push({ key: "p" + p.id, tipo: "pub", at: p.created_at, dia, pts, nota, post: p, likesSuman: likesPts.get(p.id) ?? 0, likesTotal: likesTot.get(p.id) ?? 0 });
  }
  const topIds = new Set(tabla.slice(0, 3).map((x) => x.user_id));
  const nResp = new Map<string, number>(); // día -> respuestas puntuables ya vistas
  for (const c of coms) {
    const dia = diaDe(c.created_at);
    const d = destino.get(c.post_id);
    let pts = 0, nota = "";
    if (c.cuerpo.trim().length < 20) nota = "No suma: menos de 20 caracteres";
    else if (d && d.user_id === u) nota = "No suma: respondió en su propia publicación";
    else if (primera.get(c.post_id) !== c.id) nota = "No suma: no es su primera respuesta en esa publicación";
    else {
      const n = (nResp.get(dia) ?? 0) + 1;
      nResp.set(dia, n);
      if (n > 5) nota = "No suma: ya llevaba 5 respuestas puntuables ese día";
      else pts = 1;
    }
    let utilNota = "";
    if (c.util) {
      if (d && d.user_id === u) utilNota = "Marcada útil, pero es su propia publicación: no suma";
      else if (primeraUtil.get(c.post_id) !== c.id) utilNota = "Útil que no suma: solo cuenta 1 útil por publicación y persona";
      else if (d && topIds.has(d.user_id) && topIds.has(u)) utilNota = "Útil que no suma: quien preguntó también está en el Top 3";
    }
    const util = c.util && !utilNota;
    items.push({ key: "c" + c.id, tipo: "resp", at: c.created_at, dia, pts, nota, com: c, util, utilNota });
  }

  // Resumen por día (con el tope de 12 puntos al día; las respuestas útiles van aparte).
  const dias = Array.from(new Set([...items.map((i) => i.dia), ...Array.from(likesDia.keys())])).sort().reverse();
  const resumenDia = new Map<string, { crudo: number; util: number; total: number }>();
  for (const d of dias) {
    const crudo = items.filter((i) => i.dia === d).reduce((s, i) => s + i.pts, 0) + (likesDia.get(d) ?? 0);
    const util = items.filter((i) => i.dia === d && i.util).length * 5;
    resumenDia.set(d, { crudo, util, total: Math.min(crudo, TOPE_DIA) + util });
  }
  const estimado = Array.from(resumenDia.values()).reduce((s, x) => s + x.total, 0);

  const suman = (i: Item) => i.pts > 0 || !!i.util || (i.likesSuman ?? 0) > 0;
  const mostrar = (i: Item) => (filtro === "suman" ? suman(i) : filtro === "nosuman" ? !suman(i) : true);
  const nPubSuman = items.filter((i) => i.tipo === "pub" && i.pts > 0).length;
  const nRespSuman = items.filter((i) => i.tipo === "resp" && i.pts > 0).length;
  const nUtil = items.filter((i) => i.util).length;
  const nUtilMarcadas = items.filter((i) => i.com?.util).length;
  const nLikes = Array.from(likesPts.values()).reduce((s, x) => s + x, 0);
  const enlacePub = (id: string) => "/comunidad?p=" + id + "#p" + id;
  const enlaceResp = (postId: string, cid: string) => "/comunidad?p=" + postId + "&c=" + cid + "#p" + postId;
  const corto = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);
  const chip = (f: string, t: string) => <Link key={f} href={"/comunidad/ranking/revisar?u=" + u + "&m=" + mes + (f ? "&f=" + f : "")} className={filtro === f ? "chip on" : "chip"}>{t}</Link>;
  const imgs = (x: { imagen_url?: string | null; imagenes_extra?: string[] | null }) => [x.imagen_url, ...(x.imagenes_extra ?? [])].filter((s): s is string => !!s);
  const miniaturas = (x: { imagen_url?: string | null; imagenes_extra?: string[] | null }) => imgs(x).map((s, i) => (
    <a key={s} href={s} target="_blank" rel="noopener noreferrer"><img src={s} alt={"Imagen " + (i + 1)} style={{ maxWidth: 160, maxHeight: 120, borderRadius: 8, marginRight: 6, marginTop: 4 }} /></a>
  ));

  return (
    <>
      <Link href={"/comunidad/ranking?m=" + mes} className="back">← Ranking de {nombreMes(mes)}</Link>
      <h1>{persona?.nombre || persona?.email || "Persona"}</h1>
      <p className="sub">Todo lo que publicó y respondió en el ranking de {nombreMes(mes)} (hasta el {ultimoViernes(mes).split("-").reverse().join("/")}), por día y con lo que suma cada cosa. Revisa que los aportes sean reales; si ves spam o texto sin sentido, descuenta los puntos abajo.</p>

      <section className="box">
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <div><b style={{ fontSize: 22 }}>{puntosReales ?? "—"}</b><small className="mu" style={{ display: "block" }}>puntos reales en el ranking{puesto ? " · puesto " + puesto : ""}</small></div>
          <div><b style={{ fontSize: 22 }}>{estimado}</b><small className="mu" style={{ display: "block" }}>por publicaciones, respuestas y me gusta</small></div>
          <div><b style={{ fontSize: 22 }}>{posts.length}</b><small className="mu" style={{ display: "block" }}>publicaciones · suman {nPubSuman}</small></div>
          <div><b style={{ fontSize: 22 }}>{coms.length}</b><small className="mu" style={{ display: "block" }}>respuestas · suman {nRespSuman}</small></div>
          <div><b style={{ fontSize: 22 }}>{nUtil}</b><small className="mu" style={{ display: "block" }}>útiles que cuentan · {nUtilMarcadas} marcadas en el período · {utilTotal} en total</small></div>
          <div><b style={{ fontSize: 22 }}>{nLikes}</b><small className="mu" style={{ display: "block" }}>me gusta que suman</small></div>
        </div>
        <small className="mu" style={{ display: "block", marginTop: 8 }}>Los puntos reales incluyen además el chat en vivo, la foto, Liquid, certificados, referidos y ajustes, y descuentan las interacciones entre las personas del Top 10 y la penalización del Top 3. Por eso pueden diferir del cálculo de abajo, que es una guía para revisar.</small>
      </section>

      <p style={{ margin: "0 0 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>{chip("", "Todo")}{chip("suman", "Solo lo que suma")}{chip("nosuman", "Solo lo que NO suma")}</p>

      {items.length === 0 && <section className="box"><p className="mu">No publicó ni respondió nada en este período.</p></section>}
      {dias.map((d) => {
        const lista = items.filter((i) => i.dia === d && mostrar(i)).sort((a, b) => (a.at < b.at ? 1 : -1));
        const r = resumenDia.get(d)!;
        if (!lista.length) return null;
        return (
          <section className="box" key={d}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, textTransform: "capitalize" }}>{diaLargo(d)}</h2>
              <b className="pill ok">{r.total} pts</b>
              <small className="mu">
                {r.crudo > TOPE_DIA ? "llegó al tope de " + TOPE_DIA + " al día (se pierden " + (r.crudo - TOPE_DIA) + ")" : r.crudo + " de " + TOPE_DIA + " posibles"}
                {r.util > 0 ? " · +" + r.util + " por útiles (fuera del tope)" : ""}
                {(likesDia.get(d) ?? 0) > 0 ? " · " + likesDia.get(d) + " por me gusta recibidos ese día" : ""}
              </small>
            </div>
            {lista.map((i) => (
              <div key={i.key} style={{ padding: "10px 0", borderBottom: "1px solid var(--bd)" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {i.tipo === "pub"
                    ? <span className="pill">{CANAL[i.post!.canal] ?? i.post!.canal}</span>
                    : <span className="pill">Respuesta</span>}
                  {i.pts > 0 && <span className="pill ok">+{i.pts} pt{i.pts === 1 ? "" : "s"}</span>}
                  {i.util && <span className="pill ok">Útil · +5 pts</span>}
                  {i.utilNota && <span className="pill" style={{ color: "#e0a458" }}>{i.utilNota}</span>}
                  {i.pts === 0 && !i.util && i.nota && !i.com?.util && <span className="pill" style={{ color: "#e0a458" }}>{i.nota}</span>}
                  <small className="mu">{hora(i.at)} · {i.tipo === "pub" ? i.post!.cuerpo.length : i.com!.cuerpo.length} caracteres{i.tipo === "pub" ? " · " + (i.likesTotal ?? 0) + " me gusta de otros" + ((i.likesSuman ?? 0) > 0 ? " (suman " + i.likesSuman + ")" : "") : ""}</small>
                  <Link href={i.tipo === "pub" ? enlacePub(i.post!.id) : enlaceResp(i.com!.post_id, i.com!.id)} style={{ marginLeft: "auto", fontWeight: 600 }}>
                    {i.tipo === "pub" ? "Abrir esta publicación →" : "Ver esta respuesta →"}
                  </Link>
                </div>
                {i.tipo === "pub" ? (
                  <>
                    {i.post!.titulo && <b style={{ display: "block", marginTop: 6 }}>{i.post!.titulo}</b>}
                    <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{i.post!.cuerpo || <span className="mu">(sin texto)</span>}</p>
                    {miniaturas(i.post!)}
                  </>
                ) : (
                  <>
                    <p style={{ margin: "6px 0 2px", whiteSpace: "pre-wrap" }}>{i.com!.cuerpo || <span className="mu">(solo imagen)</span>}</p>
                    {miniaturas(i.com!)}
                    {(() => { const dd = destino.get(i.com!.post_id); return dd ? <small className="mu" style={{ display: "block", marginTop: 4 }}>En respuesta a {dd.autor ? dd.autor + ": " : ""}«{corto(dd.titulo || dd.cuerpo)}»</small> : null; })()}
                  </>
                )}
              </div>
            ))}
          </section>
        );
      })}
      {items.length > 0 && items.filter(mostrar).length === 0 && <section className="box"><p className="mu">Nada con este filtro.</p></section>}

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
