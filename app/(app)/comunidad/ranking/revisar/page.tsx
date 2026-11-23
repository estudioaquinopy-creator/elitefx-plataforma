import Link from "next/link";
import { notFound } from "next/navigation";
import { perfilActual } from "@/lib/sesion";
import { createClient } from "@/lib/supabase/server";
import { ultimoViernes } from "@/lib/ranking";
import { ajustarPuntos } from "../../actions";

export const dynamic = "force-dynamic";

// Esta pantalla muestra SOLO lo que suma de verdad: los datos salen de ranking_detalle (migración 0076),
// que aplica las mismas reglas que el ranking (tope diario, Top 3, me gusta del Top 10, redondeo y penalización).
type Fila = { tipo: string; dia: string | null; cuando: string | null; pts: number; post_id: string | null; com_id: string | null; otro: string | null };
type Post = { id: string; canal: string; titulo: string; cuerpo: string; autor?: string | null; imagen_url?: string | null; imagenes_extra?: string[] | null };
type Com = { id: string; post_id: string; cuerpo: string; imagen_url?: string | null; imagenes_extra?: string[] | null };
type Bloque = { key: string; kind: "pub" | "resp" | "util" | "like" | "otros"; dia: string; at: string; pts: number; tipo: string; filas: Fila[] };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (m: string) => MESES[Number(m.slice(5, 7)) - 1] + " de " + m.slice(0, 4);
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PY", { timeZone: "America/Asuncion", hour: "2-digit", minute: "2-digit" });
const cuando = (iso: string) => new Date(iso).toLocaleString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const diaLargo = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("es-PY", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const num = (n: number) => { const r = Math.round(n * 10) / 10; return Number.isInteger(r) ? String(r) : String(r).replace(".", ","); };
const con = (n: number) => (n > 0 ? "+" : "") + num(n);
const CANAL: Record<string, string> = { resultados: "Resultado", preguntas: "Pregunta" };
const SIN_TOPE = ["util", "certificado", "ref", "refvip", "foto", "liquid", "liquidreal"]; // lo que no cuenta para el tope de 12 al día
const TOPE_DIA = 12;
const FILTROS = ["pub", "resp", "util", "like", "otros"];

const LINEAS: { id: string; txt: string; tipos: string[] }[] = [
  { id: "pub", txt: "Publicaciones", tipos: ["resultados", "preguntas"] },
  { id: "resp", txt: "Respuestas", tipos: ["respuesta"] },
  { id: "util", txt: "Respuestas marcadas útiles", tipos: ["util"] },
  { id: "like", txt: "Me gusta recibidos", tipos: ["like"] },
  { id: "chat", txt: "Chat en vivo", tipos: ["chat"] },
  { id: "cert", txt: "Certificados", tipos: ["certificado"] },
  { id: "ref", txt: "Referidos activos", tipos: ["ref"] },
  { id: "refvip", txt: "Referidos que pasaron a VIP", tipos: ["refvip"] },
  { id: "foto", txt: "Foto de perfil", tipos: ["foto"] },
  { id: "liquid", txt: "Cuenta de Liquid", tipos: ["liquid", "liquidreal"] },
  { id: "ajuste", txt: "Ajustes del administrador", tipos: ["ajuste"] },
  { id: "redondeo", txt: "Redondeo hacia abajo", tipos: ["redondeo"] },
  { id: "penal", txt: "Penalización del Top 3", tipos: ["penal"] },
];

// Trae filas por id en trozos (una lista larga de ids no cabe en la dirección de la consulta).
async function porIds<T>(sb: ReturnType<typeof createClient>, tabla: string, ids: string[]): Promise<T[]> {
  const trozos: string[][] = [];
  for (let i = 0; i < ids.length; i += 80) trozos.push(ids.slice(i, i + 80));
  const res = await Promise.all(trozos.map((t) => sb.from(tabla).select("*").in("id", t)));
  return res.flatMap((r) => (r.data ?? []) as T[]);
}

export default async function Revisar({ searchParams }: { searchParams: { u?: string; m?: string; f?: string } }) {
  const perfil = await perfilActual();
  if (perfil.rol !== "admin") notFound();
  const u = /^[0-9a-f-]{36}$/i.test(searchParams.u ?? "") ? (searchParams.u as string) : "";
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.m ?? "") ? (searchParams.m as string) : "";
  if (!u || !mes) notFound();
  const filtro = FILTROS.includes(searchParams.f ?? "") ? (searchParams.f as string) : "";
  const sb = createClient();

  const [pf, rk, det] = await Promise.all([
    sb.from("perfiles").select("nombre, email").eq("id", u).maybeSingle(),
    sb.rpc("ranking_mes", { p_mes: mes }),
    sb.rpc("ranking_detalle", { p_mes: mes, p_user: u }),
  ]);
  const persona = pf.data as { nombre: string; email: string } | null;
  const tabla = (rk.error ? [] : rk.data ?? []) as { user_id: string; puntos: number }[];
  const puesto = tabla.findIndex((x) => x.user_id === u) + 1;
  const puntosReales = puesto ? tabla[puesto - 1].puntos : null;
  const volver = "/comunidad/ranking?m=" + mes;
  const titulo = persona?.nombre || persona?.email || "Persona";

  if (det.error) {
    const falta = det.error.message.includes("ranking_detalle");
    return (
      <>
        <Link href={volver} className="back">← Ranking de {nombreMes(mes)}</Link>
        <h1>{titulo}</h1>
        <section className="box"><p className="mu">{falta ? "Falta correr la migración 0076 en Supabase (SQL Editor) para ver el detalle de puntos." : "No se pudo cargar el detalle: " + det.error.message}</p></section>
      </>
    );
  }

  const filas = ((det.data ?? []) as Fila[]).map((r) => ({ ...r, pts: Number(r.pts) }));
  const suma = Math.round(filas.reduce((s, r) => s + r.pts, 0) * 10) / 10;

  // Publicaciones y respuestas que aparecen en el detalle.
  const postIds = Array.from(new Set(filas.map((r) => r.post_id).filter((x): x is string => !!x)));
  const comIds = Array.from(new Set(filas.map((r) => r.com_id).filter((x): x is string => !!x)));
  const [posts, coms] = await Promise.all([porIds<Post>(sb, "publicaciones", postIds), porIds<Com>(sb, "comentarios", comIds)]);
  const post = new Map(posts.map((p) => [p.id, p]));
  const com = new Map(coms.map((c) => [c.id, c]));

  // Bloques: cada publicación, respuesta y útil por separado; los me gusta de una misma publicación juntos (con quién los dio); el chat de cada día junto.
  const bloques: Bloque[] = [];
  const likes = new Map<string, Bloque>();
  const chats = new Map<string, Bloque>();
  for (const r of filas) {
    if (!r.dia || !r.cuando || r.tipo === "ajuste") continue;
    if (r.tipo === "resultados" || r.tipo === "preguntas") bloques.push({ key: "p" + r.post_id, kind: "pub", dia: r.dia, at: r.cuando, pts: r.pts, tipo: r.tipo, filas: [r] });
    else if (r.tipo === "respuesta") bloques.push({ key: "r" + r.com_id, kind: "resp", dia: r.dia, at: r.cuando, pts: r.pts, tipo: r.tipo, filas: [r] });
    else if (r.tipo === "util") bloques.push({ key: "u" + r.com_id, kind: "util", dia: r.dia, at: r.cuando, pts: r.pts, tipo: r.tipo, filas: [r] });
    else if (r.tipo === "like") {
      const k = "l" + r.dia + (r.post_id ?? "");
      const b = likes.get(k);
      if (b) { b.pts += r.pts; b.filas.push(r); if (r.cuando > b.at) b.at = r.cuando; }
      else { const nb: Bloque = { key: k, kind: "like", dia: r.dia, at: r.cuando, pts: r.pts, tipo: "like", filas: [r] }; likes.set(k, nb); bloques.push(nb); }
    } else if (r.tipo === "chat") {
      const k = "c" + r.dia;
      const b = chats.get(k);
      if (b) { b.pts += r.pts; b.filas.push(r); if (r.cuando > b.at) b.at = r.cuando; }
      else { const nb: Bloque = { key: k, kind: "otros", dia: r.dia, at: r.cuando, pts: r.pts, tipo: "chat", filas: [r] }; chats.set(k, nb); bloques.push(nb); }
    } else bloques.push({ key: r.tipo + (r.cuando ?? "") + (r.otro ?? ""), kind: "otros", dia: r.dia, at: r.cuando, pts: r.pts, tipo: r.tipo, filas: [r] });
  }

  const resumen = LINEAS.map((l) => {
    const fs = filas.filter((r) => l.tipos.includes(r.tipo));
    return { ...l, n: fs.length, pts: fs.reduce((s, r) => s + r.pts, 0) };
  }).filter((l) => l.n > 0);
  const nDe = (kind: string) => bloques.filter((b) => b.kind === kind).reduce((s, b) => s + b.filas.length, 0);
  const mostrados = filtro ? bloques.filter((b) => b.kind === filtro) : bloques;
  const dias = Array.from(new Set(mostrados.map((b) => b.dia))).sort().reverse();
  const coincide = puntosReales === null ? suma === 0 : Math.abs(suma - puntosReales) < 0.001;
  const ajustes = filas.filter((r) => r.tipo === "ajuste");

  const enlacePub = (id: string) => "/comunidad?p=" + id + "#p" + id;
  const enlaceResp = (postId: string, cid: string) => "/comunidad?p=" + postId + "&c=" + cid + "#p" + postId;
  const corto = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);
  const chip = (f: string, t: string, n?: number) => (
    <Link key={f} href={"/comunidad/ranking/revisar?u=" + u + "&m=" + mes + (f ? "&f=" + f : "")} className={filtro === f ? "chip on" : "chip"}>{t}{n !== undefined ? " · " + n : ""}</Link>
  );
  const miniaturas = (x: { imagen_url?: string | null; imagenes_extra?: string[] | null }) =>
    [x.imagen_url, ...(x.imagenes_extra ?? [])].filter((s): s is string => !!s).map((s, i) => (
      <a key={s} href={s} target="_blank" rel="noopener noreferrer"><img src={s} alt={"Imagen " + (i + 1)} style={{ maxWidth: 160, maxHeight: 120, borderRadius: 8, marginRight: 6, marginTop: 4 }} /></a>
    ));
  const destino = (postId: string | null) => {
    const d = postId ? post.get(postId) : undefined;
    return d ? <small className="mu" style={{ display: "block", marginTop: 4 }}>En la publicación {d.autor ? "de " + d.autor + ": " : ""}«{corto(d.titulo || d.cuerpo)}»</small> : null;
  };

  const cuerpoBloque = (b: Bloque) => {
    const r = b.filas[0];
    const p = r.post_id ? post.get(r.post_id) : undefined;
    const c = r.com_id ? com.get(r.com_id) : undefined;
    if (b.kind === "pub") {
      if (!p) return <p className="mu" style={{ margin: "6px 0" }}>(publicación eliminada)</p>;
      return (
        <>
          {p.titulo && <b style={{ display: "block", marginTop: 6 }}>{p.titulo}</b>}
          <p style={{ margin: "4px 0", whiteSpace: "pre-wrap" }}>{p.cuerpo || <span className="mu">(sin texto)</span>}</p>
          {miniaturas(p)}
        </>
      );
    }
    if (b.kind === "resp" || b.kind === "util") {
      if (!c) return <p className="mu" style={{ margin: "6px 0" }}>(respuesta eliminada)</p>;
      return (
        <>
          <p style={{ margin: "6px 0 2px", whiteSpace: "pre-wrap" }}>{c.cuerpo || <span className="mu">(solo imagen)</span>}</p>
          {miniaturas(c)}
          {destino(r.post_id)}
        </>
      );
    }
    if (b.kind === "like") {
      return (
        <>
          <p style={{ margin: "6px 0 2px" }}>
            {b.filas.length === 1 ? "1 me gusta" : b.filas.length + " me gusta"} de: {b.filas.sort((x, y) => ((x.cuando ?? "") < (y.cuando ?? "") ? -1 : 1)).map((f, i) => (
              <span key={i} title={f.cuando ? cuando(f.cuando) : ""}>{i ? ", " : ""}{f.otro || "—"}{f.pts < 1 ? " (½)" : ""}</span>
            ))}
          </p>
          {destino(r.post_id)}
        </>
      );
    }
    // otros
    if (b.tipo === "chat") {
      const m = b.filas.filter((f) => f.otro === "msg").length, re = b.filas.filter((f) => f.otro === "reac").length, im = b.filas.filter((f) => f.otro === "img").length;
      const partes = [m ? m + (m === 1 ? " mensaje" : " mensajes") : "", re ? re + (re === 1 ? " reacción recibida" : " reacciones recibidas") : "", im ? im + (im === 1 ? " imagen" : " imágenes") : ""].filter(Boolean);
      return <p style={{ margin: "6px 0 2px" }}>💬 Chat en vivo: {partes.join(" · ")}</p>;
    }
    if (b.tipo === "certificado") return <p style={{ margin: "6px 0 2px" }}>🎓 Certificado: {r.otro}</p>;
    if (b.tipo === "ref") return <p style={{ margin: "6px 0 2px" }}>👥 Referido activo (completó su primera lección): {r.otro}</p>;
    if (b.tipo === "refvip") return <p style={{ margin: "6px 0 2px" }}>⭐ Referido que pasó a VIP: {r.otro}</p>;
    if (b.tipo === "foto") return <p style={{ margin: "6px 0 2px" }}>📸 Foto de perfil subida</p>;
    if (b.tipo === "liquid") return <p style={{ margin: "6px 0 2px" }}>🏦 Cuenta de Liquid aprobada: {r.otro}</p>;
    return <p style={{ margin: "6px 0 2px" }}>🏦 Cuenta de Liquid operando en real: {r.otro}</p>;
  };
  const etiqueta = (b: Bloque) => {
    if (b.kind === "pub") return CANAL[b.tipo] ?? b.tipo;
    if (b.kind === "resp") return "Respuesta";
    if (b.kind === "util") return "Respuesta útil";
    if (b.kind === "like") return "Me gusta";
    return "Otros puntos";
  };
  const enlaceBloque = (b: Bloque) => {
    const r = b.filas[0];
    if (!r.post_id) return null;
    if (b.kind === "pub" || b.kind === "like") return { href: enlacePub(r.post_id), txt: "Abrir esta publicación →" };
    if (r.com_id) return { href: enlaceResp(r.post_id, r.com_id), txt: "Ver esta respuesta →" };
    return null;
  };

  return (
    <>
      <Link href={volver} className="back">← Ranking de {nombreMes(mes)}</Link>
      <h1>{titulo}</h1>
      <p className="sub">Aquí aparece SOLO lo que suma en el ranking de {nombreMes(mes)} (hasta el {ultimoViernes(mes).split("-").reverse().join("/")}), con todo su detalle. Lo que no suma no se muestra, y el total de abajo es exactamente el del ranking. Si ves spam o texto sin sentido, descuenta los puntos al final.</p>

      <section className="box">
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "baseline" }}>
          <div><b style={{ fontSize: 28 }}>{puntosReales ?? 0}</b><small className="mu" style={{ display: "block" }}>puntos en el ranking{puesto ? " · puesto " + puesto : ""}</small></div>
        </div>
        {filas.length === 0 ? (
          <p className="mu" style={{ marginTop: 10 }}>No suma ningún punto en este período{puntosReales === null ? " (o no participa en el ranking de este mes)" : ""}.</p>
        ) : (
          <table style={{ marginTop: 12, width: "100%", maxWidth: 520, borderCollapse: "collapse" }}>
            <tbody>
              {resumen.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--bd)" }}>
                  <td style={{ padding: "6px 0" }}>{l.txt}</td>
                  <td className="mu" style={{ padding: "6px 8px", textAlign: "right" }}>{l.n}</td>
                  <td style={{ padding: "6px 0", textAlign: "right", fontWeight: 600, color: l.pts < 0 ? "#e0a458" : undefined }}>{con(l.pts)}</td>
                </tr>
              ))}
              <tr>
                <td style={{ padding: "8px 0", fontWeight: 700 }}>Total</td>
                <td />
                <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700 }}>{num(suma)}</td>
              </tr>
            </tbody>
          </table>
        )}
        {!coincide && (
          <p style={{ margin: "10px 0 0", color: "#e0a458" }}>
            ⚠ El detalle suma {num(suma)} pero el ranking muestra {puntosReales ?? 0}. Suele pasar con un mes ya cerrado cuyas reglas cambiaron después de guardarse, o si se acaba de correr una migración. Avísale a Claude con una captura.
          </p>
        )}
      </section>

      {filas.length > 0 && (
        <p style={{ margin: "0 0 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {chip("", "Todo")}
          {nDe("pub") > 0 && chip("pub", "Publicaciones", nDe("pub"))}
          {nDe("resp") > 0 && chip("resp", "Respuestas", nDe("resp"))}
          {nDe("util") > 0 && chip("util", "Útiles", nDe("util"))}
          {nDe("like") > 0 && chip("like", "Me gusta", nDe("like"))}
          {nDe("otros") > 0 && chip("otros", "Otros puntos")}
        </p>
      )}

      {dias.map((d) => {
        const lista = mostrados.filter((b) => b.dia === d).sort((a, b) => (a.at < b.at ? 1 : -1));
        const delDia = bloques.filter((b) => b.dia === d);
        const total = delDia.reduce((s, b) => s + b.pts, 0);
        const conTope = delDia.reduce((s, b) => s + b.filas.filter((f) => !SIN_TOPE.includes(f.tipo)).reduce((x, f) => x + f.pts, 0), 0);
        return (
          <section className="box" key={d}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
              <h2 style={{ margin: 0, textTransform: "capitalize" }}>{diaLargo(d)}</h2>
              <b className="pill ok">{num(total)} pts</b>
              {conTope >= TOPE_DIA && <small className="mu">llegó al tope de {TOPE_DIA} puntos al día</small>}
            </div>
            {lista.map((b) => {
              const en = enlaceBloque(b);
              return (
                <div key={b.key} style={{ padding: "10px 0", borderBottom: "1px solid var(--bd)" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="pill">{etiqueta(b)}</span>
                    <span className="pill ok">{con(b.pts)} pt{Math.abs(b.pts) === 1 ? "" : "s"}</span>
                    <small className="mu">{hora(b.at)}</small>
                    {en && <Link href={en.href} style={{ marginLeft: "auto", fontWeight: 600 }}>{en.txt}</Link>}
                  </div>
                  {cuerpoBloque(b)}
                </div>
              );
            })}
          </section>
        );
      })}

      {ajustes.length > 0 && !filtro && (
        <section className="box">
          <h2>Ajustes manuales de este mes</h2>
          {ajustes.map((a, i) => (
            <div key={i} className="ses"><div style={{ flex: 1 }}>{a.otro}{a.cuando && <small className="mu" style={{ display: "block" }}>{cuando(a.cuando)}</small>}</div><b>{con(a.pts)} pts</b></div>
          ))}
        </section>
      )}

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
